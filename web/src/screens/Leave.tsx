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

interface LeaveRequest {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayArrival: string | null;
  halfDayLeave: string | null;
  isSick: boolean;
  bereavementRelationship: BereavementRelationship | null;
  requestedDays: number;
  reason: string;
  status: string;
}

const STATUS_TONE: Record<string, 'mint' | 'coral' | 'sunny' | 'default'> = {
  approved: 'mint',
  rejected: 'coral',
  pending: 'sunny',
  cancelled: 'default',
};

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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-semibold text-ink">
                      {LEAVE_TYPE_LABELS[r.leaveType]} · {r.isHalfDay ? 'Half day' : `${r.requestedDays}d`}
                    </p>
                    {r.isSick && <Pill tone="lavender">Sick</Pill>}
                  </div>
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
  const [leaveType, setLeaveType] = useState<LeaveType>('pl');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayArrival, setHalfDayArrival] = useState('10:00');
  const [halfDayLeave, setHalfDayLeave] = useState('14:00');
  const [isSick, setIsSick] = useState(false);
  const [bereavementRelationship, setBereavementRelationship] = useState<BereavementRelationship | ''>('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  function changeType(next: LeaveType) {
    setLeaveType(next);
    if (next !== 'pl') setIsSick(false);
    if (next !== 'bereavement') setBereavementRelationship('');
    if (next === 'wfh') setIsHalfDay(false);
  }

  const create = useMutation({
    mutationFn: () =>
      api.post('/leave/requests', {
        leaveType,
        startDate,
        endDate: isHalfDay ? startDate : endDate || startDate,
        isHalfDay,
        halfDayArrival: isHalfDay ? halfDayArrival : undefined,
        halfDayLeave: isHalfDay ? halfDayLeave : undefined,
        isSick: leaveType === 'pl' ? isSick : false,
        bereavementRelationship: leaveType === 'bereavement' ? bereavementRelationship : undefined,
        reason,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave'] });
      onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!startDate || !reason) {
      setErr('Please choose a date and add a reason.');
      return;
    }
    if (leaveType === 'bereavement' && !bereavementRelationship) {
      setErr('Please select your relationship to the deceased.');
      return;
    }
    create.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Request leave">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input" value={leaveType} onChange={(e) => changeType(e.target.value as LeaveType)}>
            {SELECTABLE_LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {LEAVE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {leaveType === 'pl' && !isSick && (
            <p className="mt-1 text-[12px] text-muted">
              Paid leave must be applied at least 5 calendar days in advance, otherwise it is taken as Leave Without Pay.
            </p>
          )}
          {leaveType === 'wfh' && (
            <p className="mt-1 text-[12px] text-muted">Work-from-home must be requested at least 24 hours in advance.</p>
          )}
        </div>
        {leaveType === 'pl' && (
          <div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={isSick} onChange={(e) => setIsSick(e.target.checked)} /> This is a sick leave request
            </label>
            {isSick && (
              <p className="mt-1 text-[12px] text-muted">
                Sick leave can be same-day, but must be submitted before 9:30 AM — otherwise it is taken as Leave Without Pay.
              </p>
            )}
          </div>
        )}
        {leaveType === 'bereavement' && (
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
        {leaveType !== 'wfh' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} /> Half day
          </label>
        )}
        {isHalfDay ? (
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
        <div>
          <label className="label">Reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Eg. Family Function" />
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Sending…' : 'Submit request'}
        </Button>
      </form>
    </Modal>
  );
}
