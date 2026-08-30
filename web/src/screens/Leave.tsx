import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BEREAVEMENT_RELATIONSHIP_LABELS,
  BEREAVEMENT_RELATIONSHIPS,
  type BereavementRelationship,
  LEAVE_TYPE_LABELS,
  type LeaveType,
  SELECTABLE_LEAVE_TYPES,
} from '@hc/shared';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Pill, Section, Spinner } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { IconChevronLeft, IconPlus } from '@/components/Icons';
import { fmtClock, fmtDate } from '@/lib/format';
import { useAuth } from '@/store/auth';

interface LeaveRequest {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayArrival: string | null;
  halfDayLeave: string | null;
  bereavementRelationship: BereavementRelationship | null;
  requestedDays: number;
  reason: string;
  status: string;
}

interface Holiday {
  id: string;
  day: string;
  name: string;
  type: 'mandatory_holiday' | 'optional_holiday';
}

/** GET /leave/balances/:userId — the entitlement figures the type rows show on their right. */
interface LeaveBalances {
  employmentType: 'intern' | 'full_time';
  /** Interns hold ONE pool across Privilege + Sick, so both rows show the same figure. */
  sharedPool: boolean;
  privilege: { total: number; remaining: number };
  sick: { total: number; remaining: number };
  compOff: number;
  advanceDebt: number;
  advanceCap: number;
  probationEndDate: string | null;
  onProbation: boolean;
  noticeStartDate: string | null;
  noticeLastDate: string | null;
  onNoticePeriod: boolean;
}

/** POST /leave/requests — `notices` are the policy sentences shown back to the member verbatim. */
interface CreateLeaveResult {
  request: LeaveRequest;
  notices: string[];
  convertedToLwp: boolean;
  appliedAs: LeaveType;
}

const STATUS_TONE: Record<string, 'mint' | 'coral' | 'sunny' | 'default'> = {
  approved: 'mint',
  rejected: 'coral',
  pending: 'sunny',
  cancelled: 'default',
};

/** Balances move in half-days, so 8.5 stays 8.5 while 11 never shows as 11.0. */
const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function Leave() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['leave', 'mine'], queryFn: () => api.get<{ requests: LeaveRequest[] }>('/leave/requests') });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/leave/requests/${id}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leave'] }),
  });

  return (
    <div className="flex flex-col gap-4 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>
      <Section
        title="Your leave"
        action={
          <Button variant="ghost" className="!px-3 !py-2" onClick={() => setOpen(true)}>
            <IconPlus /> Request
          </Button>
        }
      >
        {q.isLoading ? (
          <Spinner />
        ) : (q.data?.requests.length ?? 0) === 0 ? (
          <EmptyState emoji="🗓️" title="No leave requests yet" hint="When you need time off, raise a request here and track its status." />
        ) : (
          <div className="flex flex-col gap-2">
            {q.data!.requests.map((r) => (
              <Card key={r.id} className="flex items-center justify-between !p-3">
                <div>
                  {/* Sick is a leave type of its own since v4 — the title already says it, so no extra pill. */}
                  <p className="font-display font-semibold text-ink">
                    {LEAVE_TYPE_LABELS[r.leaveType]} · {r.isHalfDay ? 'Half day' : `${r.requestedDays}d`}
                  </p>
                  <p className="text-[12px] text-muted">
                    {fmtDate(r.startDate)}
                    {r.startDate !== r.endDate ? ` → ${fmtDate(r.endDate)}` : ''}
                    {r.isHalfDay && r.halfDayArrival && r.halfDayLeave
                      ? ` · in ${fmtClock(r.halfDayArrival)}, out ${fmtClock(r.halfDayLeave)}`
                      : ''}
                    {' · '}
                    {r.reason}
                  </p>
                  {r.bereavementRelationship && (
                    <p className="text-[12px] text-muted">{BEREAVEMENT_RELATIONSHIP_LABELS[r.bereavementRelationship]}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
                  {r.status === 'pending' && (
                    <button className="text-[11px] text-coral" onClick={() => cancel.mutate(r.id)}>
                      cancel
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
      <RequestModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function RequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user)!;
  const [leaveType, setLeaveType] = useState<LeaveType>('pl');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayArrival, setHalfDayArrival] = useState('10:00');
  const [halfDayLeave, setHalfDayLeave] = useState('14:00');
  const [bereavementRelationship, setBereavementRelationship] = useState<BereavementRelationship | ''>('');
  const [optionalHolidayId, setOptionalHolidayId] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [notices, setNotices] = useState<string[]>([]);

  const today = new Date().toLocaleDateString('en-CA');

  // Entitlements for the counters and the standing banners. Keyed under 'leave' so raising or
  // cancelling a request refreshes the remaining counts along with the list.
  const balancesQ = useQuery({
    queryKey: ['leave', 'balances', user.id],
    queryFn: () => api.get<LeaveBalances>(`/leave/balances/${user.id}`),
    enabled: open,
  });
  const balances = balancesQ.data;

  // An optional-holiday leave is claimed against a specific holiday, so offer the list to pick from.
  const holidaysQ = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.get<{ holidays: Holiday[] }>('/holidays'),
    enabled: open,
  });
  const optionalHolidays = (holidaysQ.data?.holidays ?? []).filter(
    (h) => h.type === 'optional_holiday' && h.day >= today,
  );
  const chosenHoliday = optionalHolidays.find((h) => h.id === optionalHolidayId);

  // Bereavement and optional-holiday requests carry their own context (relationship / the holiday
  // itself), so neither shows a half-day tick or a free-text reason — the reason is derived.
  const isBereavement = leaveType === 'bereavement';
  const isOptionalHoliday = leaveType === 'optional_holiday';
  const isSick = leaveType === 'sick';
  const isCompOff = leaveType === 'comp_off';
  // Only a full-day leave a member plans themselves can be split into a half day.
  const showHalfDay = leaveType === 'pl' || leaveType === 'lwp';
  const showReason = !isBereavement && !isOptionalHoliday;
  // Sick is same-day, comp-off is one banked day, and picking a holiday fixes its date — all single-date.
  const singleDate = isSick || isCompOff || isOptionalHoliday || isHalfDay;

  /** The remaining/total counter on the right of a row — only the pools a member draws down. */
  function counterFor(t: LeaveType): string | null {
    if (!balances) return null;
    if (t === 'pl') return `${fmtDays(balances.privilege.remaining)}/${fmtDays(balances.privilege.total)}`;
    if (t === 'sick') return `${fmtDays(balances.sick.remaining)}/${fmtDays(balances.sick.total)}`;
    if (t === 'comp_off') return balances.compOff > 0 ? `${balances.compOff} banked` : null;
    return null;
  }

  function changeType(next: LeaveType) {
    setLeaveType(next);
    setErr('');
    if (next !== 'bereavement') setBereavementRelationship('');
    if (next !== 'optional_holiday') setOptionalHolidayId('');
    if (next !== 'pl' && next !== 'lwp') setIsHalfDay(false);
    // Sick leave is only ever for today, so the date is fixed rather than asked for.
    if (next === 'sick') {
      setStartDate(today);
      setEndDate(today);
    }
  }

  function pickOptionalHoliday(id: string) {
    setOptionalHolidayId(id);
    const h = optionalHolidays.find((x) => x.id === id);
    if (h) {
      setStartDate(h.day);
      setEndDate(h.day);
    }
  }

  /** Bereavement / optional-holiday requests derive their reason from the selection made above. */
  function resolveReason(): string {
    if (isBereavement) {
      return bereavementRelationship
        ? `Bereavement — ${BEREAVEMENT_RELATIONSHIP_LABELS[bereavementRelationship]}`
        : 'Bereavement';
    }
    if (isOptionalHoliday) return `Optional holiday — ${chosenHoliday?.name ?? ''}`.trim();
    return reason;
  }

  const create = useMutation({
    mutationFn: () =>
      api.post<CreateLeaveResult>('/leave/requests', {
        leaveType,
        startDate,
        endDate: singleDate ? startDate : endDate || startDate,
        isHalfDay,
        halfDayArrival: isHalfDay ? halfDayArrival : undefined,
        halfDayLeave: isHalfDay ? halfDayLeave : undefined,
        bereavementRelationship: isBereavement ? bereavementRelationship : undefined,
        reason: resolveReason(),
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['leave'] });
      // The server decides what the policy did to this request — show its wording, unedited.
      if (res.notices.length > 0) setNotices(res.notices);
      else onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function dismissNotices() {
    setNotices([]);
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (isOptionalHoliday && !optionalHolidayId) {
      setErr('Please choose which optional holiday you would like to take.');
      return;
    }
    if (isBereavement && !bereavementRelationship) {
      setErr('Please select your relationship to the deceased.');
      return;
    }
    if (!startDate) {
      setErr('Please choose a date.');
      return;
    }
    if (showReason && !reason) {
      setErr('Please add a reason.');
      return;
    }
    create.mutate();
  }

  return (
    <>
      {/* The policy pop-up replaces the form while it is up, then closes both together. */}
      <Modal open={open && notices.length === 0} onClose={onClose} title="Request leave">
        <form onSubmit={submit} className="flex flex-col gap-3">
          {balances?.onNoticePeriod && (
            <p className="rounded-xl border border-sunny/25 bg-sunny/10 px-3 py-2 text-[12px] text-sunny">
              As per the policy, any leave taken and approved will be considered as leave without pay.
            </p>
          )}
          {balances?.onProbation && (
            <p className="rounded-xl border border-sunny/25 bg-sunny/10 px-3 py-2 text-[12px] text-sunny">
              Paid leaves become available once your probation is complete. Until then, leave is taken as Leave Without
              Pay.
            </p>
          )}

          <div>
            <label className="label">Type</label>
            <div className="flex flex-col gap-1.5">
              {SELECTABLE_LEAVE_TYPES.map((t) => {
                const counter = counterFor(t);
                const selected = leaveType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => changeType(t)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      selected ? 'border-primary bg-primary/15 text-ink' : 'border-white/10 bg-black/20 text-ink/85'
                    }`}
                  >
                    <span className="text-[15px]">{LEAVE_TYPE_LABELS[t]}</span>
                    {counter && <span className="font-display text-[13px] font-semibold text-muted">{counter}</span>}
                  </button>
                );
              })}
            </div>
            {balances?.sharedPool && (
              <p className="mt-1 text-[12px] text-muted">
                {`Privilege and Sick leave share one pool of ${fmtDays(balances.privilege.total)} for interns.`}
              </p>
            )}
            {leaveType === 'pl' && (
              <p className="mt-1 text-[12px] text-muted">
                Privilege leave must be applied at least 5 calendar days in advance, otherwise it is taken as Leave
                Without Pay.
              </p>
            )}
            {leaveType === 'wfh' && (
              <p className="mt-1 text-[12px] text-muted">Work-from-home must be requested at least 24 hours in advance.</p>
            )}
          </div>

          {isBereavement && (
            <div>
              <label className="label">Relationship to Deceased</label>
              <select
                className="input"
                value={bereavementRelationship}
                onChange={(e) => setBereavementRelationship(e.target.value as BereavementRelationship | '')}
              >
                <option value="" disabled>
                  — Select —
                </option>
                {BEREAVEMENT_RELATIONSHIPS.map((rel) => (
                  <option key={rel} value={rel}>
                    {BEREAVEMENT_RELATIONSHIP_LABELS[rel]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-muted">Bereavement leave is up to 3 working days.</p>
            </div>
          )}

          {isOptionalHoliday && (
            <div>
              <label className="label">Which optional holiday?</label>
              <select className="input" value={optionalHolidayId} onChange={(e) => pickOptionalHoliday(e.target.value)}>
                <option value="" disabled>
                  — Select —
                </option>
                {optionalHolidays.map((h) => (
                  <option key={h.id} value={h.id}>
                    {`${h.name} — ${fmtDate(h.day)}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-muted">
                {optionalHolidays.length === 0
                  ? 'No optional holidays are coming up.'
                  : 'You may take up to 2 optional holidays in a financial year.'}
              </p>
            </div>
          )}

          {showHalfDay && (
            <div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} /> Half day
              </label>
              <p className="mt-1 text-[12px] text-muted">
                A half day must be informed at least 24 hours before you leave.
              </p>
            </div>
          )}

          {isSick ? (
            <div>
              <label className="label">For date:</label>
              {/* Same-day only — the date is shown for confirmation, never chosen. */}
              <input className="input text-muted" type="date" value={startDate} readOnly disabled />
              <p className="mt-1 text-[12px] text-muted">
                Sick leave is raised on the day itself, from 5:30 AM — file it before 9:30 AM for it to stay paid.
              </p>
            </div>
          ) : isCompOff ? (
            <div>
              <label className="label">On which date:</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          ) : isOptionalHoliday ? null : isHalfDay ? (
            <>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Arrival time</label>
                  <input className="input" type="time" value={halfDayArrival} onChange={(e) => setHalfDayArrival(e.target.value)} />
                </div>
                <div>
                  <label className="label">Leaving time</label>
                  <input className="input" type="time" value={halfDayLeave} onChange={(e) => setHalfDayLeave(e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">From</label>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">To</label>
                <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          {showReason && (
            <div>
              <label className="label">Reason</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Eg. Family Function" />
            </div>
          )}

          {err && <p className="text-sm text-coral">{err}</p>}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Sending…' : 'Submit request'}
          </Button>
        </form>
      </Modal>

      <Modal open={notices.length > 0} onClose={dismissNotices} title="Leave request sent" dismissible={false}>
        <div className="flex flex-col gap-3">
          {notices.map((n) => (
            <p key={n} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-ink/85">
              {n}
            </p>
          ))}
          <Button onClick={dismissNotices}>Got it</Button>
        </div>
      </Modal>
    </>
  );
}
