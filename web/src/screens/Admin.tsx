import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BEREAVEMENT_RELATIONSHIP_LABELS,
  type BereavementRelationship,
  INTERN_NOTICE_PERIOD_DAYS,
  LEAVE_TYPE_LABELS,
  type LeaveType,
  SELECTABLE_LEAVE_TYPES,
  SEPARATION_CLAWBACK_DAY,
} from '@hc/shared';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Pill, Spinner } from '@/components/ui';
import { Collapsible } from '@/components/Collapsible';
import { Modal } from '@/components/Modal';
import { IconChevronLeft, IconPlus } from '@/components/Icons';
import { fmtDate, fmtTime12, minutesToHuman } from '@/lib/format';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isFounder: boolean;
  isActive: boolean;
  fullName: string | null;
}
/** The slice of GET /profiles the console needs — Admin sees everyone's notice dates. */
interface MemberProfile {
  userId: string;
  noticeStartDate: string | null;
  noticeLastDate: string | null;
  onNoticePeriod: boolean;
  onProbation: boolean;
  employmentType: 'intern' | 'full_time';
}
interface OverviewTask {
  id: string;
  title: string;
  status: string;
  estimatedMinutes: number;
  actualMinutes: number | null;
  timeliness: 'before_time' | 'on_time' | 'delayed' | null;
}
interface OverviewPerson {
  userId: string;
  name: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string | null;
  isLate: boolean;
  taskCount: number;
  doneCount: number;
  allDone: boolean;
  tasks: OverviewTask[];
}
interface AdminCampaign {
  id: string;
  name: string;
  clientName: string | null;
  deadline: string;
  status: string;
  memberCount: number;
}
interface Pending {
  leave: LeaveReq[];
  compOff: CompOffReq[];
}
interface LeaveReq {
  id: string;
  userId: string;
  name: string;
  leaveType: LeaveType;
  start: string;
  end: string;
  isHalfDay: boolean;
  bereavementRelationship: string | null;
  requestedDays: number;
  reason: string;
  createdAt: string;
}
interface CompOffReq {
  id: string;
  userId: string;
  name: string;
  offDate: string;
  plannedWork: string;
  reason: string;
  createdAt: string;
}
interface Holiday {
  id: string;
  day: string;
  name: string;
  type: 'mandatory_holiday' | 'optional_holiday';
  seeded: boolean;
}

const TIMELINESS_LABEL: Record<string, { label: string; tone: 'mint' | 'coral' }> = {
  before_time: { label: 'Before time', tone: 'mint' },
  on_time: { label: 'On time', tone: 'mint' },
  delayed: { label: 'Delayed', tone: 'coral' },
};

/**
 * The type selector offers the self-service list, but a request may already sit on a type a
 * member cannot pick (a policy conversion to Leave Without Pay, or a manual maternity entry) —
 * so the current type is always among the options, otherwise the select would render blank.
 */
function typeOptions(current: LeaveType): LeaveType[] {
  const selectable = SELECTABLE_LEAVE_TYPES as readonly LeaveType[];
  return selectable.includes(current) ? [...selectable] : [current, ...selectable];
}

export function Admin() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const [allotFor, setAllotFor] = useState<AdminUser | null>(null);
  const [noticeFor, setNoticeFor] = useState<AdminUser | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState('');
  const [confirmDeleteHoliday, setConfirmDeleteHoliday] = useState<string | null>(null);
  const [holidayModal, setHolidayModal] = useState(false);
  // Per-request type override, keyed by request id — untouched rows fall back to their own type.
  const [approveAs, setApproveAs] = useState<Record<string, LeaveType>>({});

  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<{ date: string; people: OverviewPerson[] }>('/admin/daily-overview') });
  const pending = useQuery({ queryKey: ['admin', 'pending'], queryFn: () => api.get<Pending>('/admin/pending-requests') });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get<{ users: AdminUser[] }>('/admin/users') });
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: () => api.get<{ profiles: MemberProfile[] }>('/profiles') });
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<{ campaigns: AdminCampaign[] }>('/campaigns') });
  const holidays = useQuery({ queryKey: ['holidays'], queryFn: () => api.get<{ holidays: Holiday[] }>('/holidays') });
  const late = useQuery({ queryKey: ['admin', 'late'], queryFn: () => api.get<{ report: { userId: string; name: string; lateCount: number }[] }>('/admin/late-report') });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
    // A decision here changes what the member sees on their own leave / comp-off screens too.
    void qc.invalidateQueries({ queryKey: ['leave'] });
    void qc.invalidateQueries({ queryKey: ['compoff'] });
  };
  const toggleAdmin = useMutation({
    mutationFn: (v: { id: string; isAdmin: boolean }) => api.patch(`/admin/users/${v.id}/admin-toggle`, { isAdmin: v.isAdmin }),
    onSuccess: invalidate,
  });
  const toggleActive = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => api.patch(`/admin/users/${v.id}/active`, { isActive: v.isActive }),
    onSuccess: invalidate,
  });
  const deleteCampaign = useMutation({
    mutationFn: (id: string) => api.del(`/campaigns/${id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
  const approveLeave = useMutation({
    // The leave type only travels when Admin actually changed it, so a plain approval stays
    // exactly what it was before — the override is opt-in, never implied.
    mutationFn: (v: { id: string; leaveType?: LeaveType }) =>
      api.post(`/leave/requests/${v.id}/approve`, v.leaveType ? { leaveType: v.leaveType } : {}),
    onSuccess: invalidate,
  });
  const reclassifyLeave = useMutation({
    mutationFn: (v: { id: string; leaveType: LeaveType }) => api.patch(`/leave/requests/${v.id}/type`, { leaveType: v.leaveType }),
    onSuccess: invalidate,
  });
  const rejectLeave = useMutation({
    mutationFn: (v: { id: string; note: string }) => api.post(`/leave/requests/${v.id}/reject`, { note: v.note }),
    onSuccess: () => {
      setDecliningId(null);
      setDeclineNote('');
      invalidate();
    },
  });
  const approveCompOff = useMutation({
    mutationFn: (id: string) => api.post(`/comp-off/requests/${id}/approve`),
    onSuccess: invalidate,
  });
  const rejectCompOff = useMutation({
    mutationFn: (id: string) => api.post(`/comp-off/requests/${id}/reject`),
    onSuccess: invalidate,
  });
  const deleteHoliday = useMutation({
    mutationFn: (id: string) => api.del(`/holidays/${id}`),
    onSuccess: () => {
      setConfirmDeleteHoliday(null);
      void qc.invalidateQueries({ queryKey: ['holidays'] });
    },
  });

  const profileFor = (userId: string) => profiles.data?.profiles.find((p) => p.userId === userId) ?? null;
  const pendingCount = (pending.data?.leave.length ?? 0) + (pending.data?.compOff.length ?? 0);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>
      <div className="mb-1">
        <h1 className="font-display text-xl font-extrabold text-ink">Admin console</h1>
        <p className="text-[13px] text-muted">Open a section to work on it. Tap anyone to see their day.</p>
      </div>

      {/* A Collapsible fixes its open state on mount, so remounting once the counts land is what
          lets "open when something is waiting" actually take effect. */}
      <Collapsible
        key={pending.isSuccess ? 'pending-ready' : 'pending-loading'}
        title="Pending requests"
        badge={pendingCount > 0 ? <Pill tone="coral">{pendingCount}</Pill> : <Pill tone="mint">clear</Pill>}
        defaultOpen={pendingCount > 0}
      >
        {pending.isLoading ? (
          <Spinner />
        ) : pendingCount === 0 ? (
          <EmptyState emoji="✅" title="Nothing waiting on you" hint="New leave and comp-off requests will land here." />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {pending.data!.leave.map((l) => {
              const chosen = approveAs[l.id] ?? l.leaveType;
              const changed = chosen !== l.leaveType;
              return (
                <Card key={l.id} className="!p-3">
                  <p className="font-display font-semibold text-ink">{l.name}</p>
                  <p className="text-[12px] text-muted">
                    {LEAVE_TYPE_LABELS[l.leaveType]} · {fmtDate(l.start)}
                    {l.start !== l.end ? ' → ' + fmtDate(l.end) : ''} · {l.isHalfDay ? 'Half day' : l.requestedDays + 'd'}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">{l.reason}</p>
                  {l.bereavementRelationship && (
                    <div className="mt-1.5 flex gap-1.5">
                      <Pill tone="default">{BEREAVEMENT_RELATIONSHIP_LABELS[l.bereavementRelationship as BereavementRelationship]}</Pill>
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="label" htmlFor={`leave-type-${l.id}`}>
                      Approve as
                    </label>
                    <select
                      id={`leave-type-${l.id}`}
                      className="input !py-2 text-[13px]"
                      value={chosen}
                      onChange={(e) => setApproveAs((m) => ({ ...m, [l.id]: e.target.value as LeaveType }))}
                    >
                      {typeOptions(l.leaveType).map((t) => (
                        <option key={t} value={t}>
                          {LEAVE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[12px] text-muted">
                      Change this to grant the leave as a different type — a request the policy pushed to Leave Without Pay can still
                      be approved as Privilege Leave.
                    </p>
                    {changed && (
                      <button
                        className="mt-1.5 text-[12px] text-muted underline"
                        disabled={reclassifyLeave.isPending}
                        onClick={() => reclassifyLeave.mutate({ id: l.id, leaveType: chosen })}
                      >
                        Re-classify without deciding
                      </button>
                    )}
                  </div>

                  {decliningId === l.id ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <input
                        className="input"
                        placeholder="Reason (optional)"
                        value={declineNote}
                        onChange={(e) => setDeclineNote(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className="flex-1"
                          onClick={() => {
                            setDecliningId(null);
                            setDeclineNote('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="coral"
                          className="flex-1"
                          disabled={rejectLeave.isPending}
                          onClick={() => rejectLeave.mutate({ id: l.id, note: declineNote })}
                        >
                          Confirm decline
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="mint"
                        className="flex-1"
                        disabled={approveLeave.isPending}
                        onClick={() => approveLeave.mutate({ id: l.id, leaveType: changed ? chosen : undefined })}
                      >
                        {changed ? `Approve as ${LEAVE_TYPE_LABELS[chosen]}` : 'Approve'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={() => {
                          setDecliningId(l.id);
                          setDeclineNote('');
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
            {pending.data!.compOff.map((c) => (
              <Card key={c.id} className="!p-3">
                <p className="font-display font-semibold text-ink">{c.name}</p>
                <p className="text-[12px] text-muted">
                  {fmtDate(c.offDate)} · {c.plannedWork}
                </p>
                <p className="mt-1 text-[12px] text-muted">{c.reason}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="mint" className="flex-1" disabled={approveCompOff.isPending} onClick={() => approveCompOff.mutate(c.id)}>
                    Approve
                  </Button>
                  <Button variant="ghost" className="flex-1" disabled={rejectCompOff.isPending} onClick={() => rejectCompOff.mutate(c.id)}>
                    Decline
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Collapsible>

      <Collapsible title="Today at a glance" badge={<Pill tone="default">{overview.data?.people.length ?? '—'}</Pill>}>
        {overview.isLoading ? (
          <Spinner />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {overview.data!.people.map((p) => (
              <PersonRow key={p.userId} p={p} onOpen={() => navigate(`/admin/member/${p.userId}`)} />
            ))}
          </div>
        )}
      </Collapsible>

      <Collapsible title="Team" badge={<Pill tone="default">{users.data?.users.length ?? '—'}</Pill>}>
        <Button variant="ghost" className="self-start !px-4 !py-2.5" onClick={() => setNoteOpen(true)}>
          ✉️ Send a note
        </Button>
        {users.isLoading ? (
          <Spinner />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {users.data!.users.map((u) => {
              const profile = profileFor(u.id);
              return (
                <Card key={u.id} className="!p-3">
                  <button className="w-full min-w-0 text-left" onClick={() => navigate(`/admin/member/${u.id}`)}>
                    <p className="truncate font-display font-semibold text-ink">{u.fullName ?? u.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Pill tone="primary">{u.role.replaceAll('_', ' ')}</Pill>
                      {u.id === me.id && <Pill tone="default">you</Pill>}
                      {u.isFounder && <Pill tone="sunny">founder</Pill>}
                      {!u.isActive && <Pill tone="coral">disabled</Pill>}
                      {profile?.onProbation && <Pill tone="lavender">on probation</Pill>}
                      {profile?.onNoticePeriod && <Pill tone="coral">on notice</Pill>}
                    </div>
                    {profile?.noticeStartDate && (
                      <p className="mt-1.5 text-[12px] text-muted">
                        Notice from {fmtDate(profile.noticeStartDate)}
                        {profile.noticeLastDate ? ` · last day ${fmtDate(profile.noticeLastDate)}` : ''}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted/70">Tap to see their day →</p>
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="pill justify-center bg-mint/15 text-mint" onClick={() => setAllotFor(u)}>
                      Paid leaves
                    </button>
                    <button className="pill justify-center bg-white/8 text-muted" onClick={() => setNoticeFor(u)}>
                      Notice period
                    </button>
                    {!u.isFounder && (
                      <>
                        <button
                          className={`pill justify-center ${u.isAdmin ? 'bg-sunny/20 text-sunny' : 'bg-white/8 text-muted'}`}
                          disabled={toggleAdmin.isPending}
                          onClick={() => toggleAdmin.mutate({ id: u.id, isAdmin: !u.isAdmin })}
                        >
                          {u.isAdmin ? 'Revoke admin' : 'Make admin'}
                        </button>
                        <button
                          className={`pill justify-center ${u.isActive ? 'bg-white/8 text-muted' : 'bg-mint/20 text-mint'}`}
                          disabled={toggleActive.isPending}
                          onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Collapsible>

      <Collapsible title="Campaigns" badge={<Pill tone="default">{campaigns.data?.campaigns.length ?? '—'}</Pill>}>
        {campaigns.isLoading ? (
          <Spinner />
        ) : (campaigns.data?.campaigns.length ?? 0) === 0 ? (
          <Card className="text-sm text-muted">No campaigns yet.</Card>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {campaigns.data!.campaigns.map((c) => (
              <Card key={c.id} className="flex items-center justify-between gap-3 !p-3">
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">{c.clientName ?? c.name}</p>
                  <p className="text-[12px] text-muted">
                    Due {fmtDate(c.deadline)} · {c.memberCount} member{c.memberCount === 1 ? '' : 's'} · {c.status.replaceAll('_', ' ')}
                  </p>
                </div>
                {confirmDelete === c.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button className="text-[12px] text-muted" onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </button>
                    <button
                      className="pill bg-coral/20 text-coral"
                      disabled={deleteCampaign.isPending}
                      onClick={() => deleteCampaign.mutate(c.id)}
                    >
                      Confirm delete
                    </button>
                  </div>
                ) : (
                  <button className="pill shrink-0 bg-white/8 text-coral" onClick={() => setConfirmDelete(c.id)}>
                    Delete
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </Collapsible>

      <Collapsible title="Holidays" badge={<Pill tone="default">{holidays.data?.holidays.length ?? '—'}</Pill>}>
        <Button variant="ghost" className="self-start !px-4 !py-2.5" onClick={() => setHolidayModal(true)}>
          <IconPlus /> Add a holiday
        </Button>
        {holidays.isLoading ? (
          <Spinner />
        ) : (holidays.data?.holidays.length ?? 0) === 0 ? (
          <Card className="text-sm text-muted">No holidays added yet.</Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {holidays.data!.holidays.map((h) => (
              <Card key={h.id} className="flex items-center justify-between gap-2 !p-3">
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">{h.name}</p>
                  <p className="text-[12px] text-muted">{fmtDate(h.day)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {h.type === 'mandatory_holiday' ? <Pill tone="coral">Mandatory</Pill> : <Pill tone="sunny">Optional</Pill>}
                  {confirmDeleteHoliday === h.id ? (
                    <div className="flex items-center gap-2">
                      <button className="text-[12px] text-muted" onClick={() => setConfirmDeleteHoliday(null)}>
                        Cancel
                      </button>
                      <button
                        className="pill bg-coral/20 text-coral"
                        disabled={deleteHoliday.isPending}
                        onClick={() => deleteHoliday.mutate(h.id)}
                      >
                        Confirm delete
                      </button>
                    </div>
                  ) : (
                    <button className="pill bg-white/8 text-coral" onClick={() => setConfirmDeleteHoliday(h.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Collapsible>

      <Collapsible title="Late arrivals" badge={<Pill tone="default">this month</Pill>}>
        {late.isLoading ? (
          <Spinner />
        ) : (late.data?.report.length ?? 0) === 0 ? (
          <Card className="text-sm text-muted">No late arrivals this month.</Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {late.data!.report.map((r) => (
              <Card key={r.userId} className="flex items-center justify-between gap-2 !p-3 text-sm">
                <span className="truncate text-ink">{r.name}</span>
                <Pill tone={r.lateCount >= 3 ? 'coral' : 'sunny'} className="shrink-0">
                  {r.lateCount} late arrival{r.lateCount === 1 ? '' : 's'}
                </Pill>
              </Card>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted/70">Surfaced for coaching — there is no automatic penalty.</p>
      </Collapsible>

      <AllotLeaveModal user={allotFor} onClose={() => setAllotFor(null)} />
      {/* Keyed on the member so the form opens pre-filled with their dates, not the last person's. */}
      {noticeFor && (
        <NoticePeriodModal key={noticeFor.id} user={noticeFor} profile={profileFor(noticeFor.id)} onClose={() => setNoticeFor(null)} />
      )}
      <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} users={users.data?.users ?? []} />
      <HolidayModal open={holidayModal} onClose={() => setHolidayModal(false)} />
    </div>
  );
}

function PersonRow({ p, onOpen }: { p: OverviewPerson; onOpen: () => void }) {
  const [expand, setExpand] = useState(false);
  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between gap-2">
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="truncate font-display font-semibold text-ink">{p.name}</p>
          <p className="text-[12px] text-muted">
            {p.checkInAt ? `In at ${fmtTime12(p.checkInAt)}` : 'Not checked in'}
            {p.checkOutAt ? ` · Out ${fmtTime12(p.checkOutAt)}` : ''}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {p.isLate && <Pill tone="coral">late</Pill>}
          {p.allDone ? (
            <Pill tone="mint">all done</Pill>
          ) : (
            <Pill tone={p.taskCount ? 'sunny' : 'default'}>
              {p.doneCount}/{p.taskCount} tasks
            </Pill>
          )}
          <button
            onClick={() => setExpand((v) => !v)}
            aria-expanded={expand}
            aria-label={`${expand ? 'Hide' : 'Show'} today's tasks for ${p.name}`}
            className={`text-muted transition-transform ${expand ? 'rotate-180' : ''}`}
          >
            ▾
          </button>
        </div>
      </div>
      {expand && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-white/10 pt-3">
          {p.tasks.length === 0 ? (
            <p className="text-[12px] text-muted">No tasks added today.</p>
          ) : (
            p.tasks.map((t) => {
              const meta = t.timeliness ? TIMELINESS_LABEL[t.timeliness] : null;
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className={`min-w-0 truncate ${t.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>{t.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
                    {t.status === 'done' && t.actualMinutes != null
                      ? `${minutesToHuman(t.actualMinutes)} / ${minutesToHuman(t.estimatedMinutes)}`
                      : t.status === 'active'
                        ? 'in progress'
                        : `est ${minutesToHuman(t.estimatedMinutes)}`}
                    {meta && <Pill tone={meta.tone}>{meta.label}</Pill>}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

/** Allot / adjust a person's Paid Leave balance at the admin's discretion. */
function AllotLeaveModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('1');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const balance = useQuery({
    queryKey: ['balance', user?.id],
    queryFn: () => api.get<{ pl: number; compOff: number; advanceDebt: number }>(`/profiles/${user!.id}/leave-balance`),
    enabled: !!user,
  });

  const adjust = useMutation({
    mutationFn: () => api.post('/leave/adjust', { userId: user!.id, amount: Number(amount), note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['balance'] });
      onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!note.trim()) return setErr('Please add a short note for the record.');
    if (!Number.isFinite(Number(amount)) || Number(amount) === 0) return setErr('Enter a non-zero number of days.');
    adjust.mutate();
  }

  return (
    <Modal open={!!user} onClose={onClose} title={`Paid leaves — ${user?.fullName ?? ''}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Current balance: <span className="text-ink">{balance.data ? `${balance.data.pl} Paid Leave` : '…'}</span>
        </p>
        <div>
          <label className="label">Days to add (use a negative number to reduce)</label>
          <input className="input" type="number" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Note</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Eg. Annual allotment on joining" />
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={adjust.isPending}>
          {adjust.isPending ? 'Saving…' : 'Update balance'}
        </Button>
      </form>
    </Modal>
  );
}

/** Put a member on notice, or lift it. The server tells them — this form never has to. */
function NoticePeriodModal({ user, profile, onClose }: { user: AdminUser; profile: MemberProfile | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState(profile?.noticeStartDate ?? '');
  const [lastDate, setLastDate] = useState(profile?.noticeLastDate ?? '');
  const [err, setErr] = useState('');
  const serving = !!profile?.noticeStartDate;

  const save = useMutation({
    mutationFn: (v: { noticeStartDate: string | null; noticeLastDate: string | null }) =>
      api.patch(`/profiles/${user.id}/notice-period`, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profiles'] });
      onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!startDate) return setErr('Please pick the date the notice period starts.');
    if (lastDate && lastDate < startDate) return setErr('The last working day cannot fall before the notice starts.');
    save.mutate({ noticeStartDate: startDate, noticeLastDate: lastDate || null });
  }

  return (
    <Modal open onClose={onClose} title={`Notice period — ${user.fullName ?? user.email}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Notice starts</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Last working day</label>
            <input className="input" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} />
          </div>
        </div>
        <p className="text-[12px] text-muted">
          Notice starting on or before the {SEPARATION_CLAWBACK_DAY}th makes that month&apos;s earned leave unpaid; from the{' '}
          {SEPARATION_CLAWBACK_DAY + 1}th it stays paid. Interns serve a {INTERN_NOTICE_PERIOD_DAYS}-day notice period
          {profile?.employmentType === 'intern' ? ' — this member is an intern.' : '; full-time notice length is yours to set.'}
        </p>
        <p className="text-[12px] text-muted">{user.fullName ?? 'They'} will get a note about this automatically.</p>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : serving ? 'Update notice period' : 'Put on notice'}
        </Button>
        {serving && (
          <Button
            type="button"
            variant="ghost"
            className="!text-coral"
            disabled={save.isPending}
            onClick={() => save.mutate({ noticeStartDate: null, noticeLastDate: null })}
          >
            Lift notice period
          </Button>
        )}
      </form>
    </Modal>
  );
}

/** Drop an in-app note to whoever needs to hear it — one person, a few, or everyone. */
function NoteModal({ open, onClose, users }: { open: boolean; onClose: () => void; users: AdminUser[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [sentTo, setSentTo] = useState<number | null>(null);
  // A disabled account cannot read anything, so it is never offered as a recipient.
  const recipients = users.filter((u) => u.isActive);

  const send = useMutation({
    mutationFn: () => api.post<{ notified: number }>('/admin/notify', { userIds: selected, title: title.trim(), body: body.trim() }),
    onSuccess: (res) => setSentTo(res.notified),
    onError: (e: Error) => setErr(e.message),
  });

  function reset() {
    setSelected([]);
    setTitle('');
    setBody('');
    setErr('');
    setSentTo(null);
  }

  function close() {
    reset();
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (selected.length === 0) return setErr('Please pick at least one person.');
    if (!title.trim()) return setErr('Please add a title.');
    if (!body.trim()) return setErr('Please write the note.');
    send.mutate();
  }

  return (
    <Modal open={open} onClose={close} title="Send a note">
      {sentTo != null ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink">
            Sent to {sentTo} {sentTo === 1 ? 'person' : 'people'}. They will see it in their notifications.
          </p>
          <Button onClick={close}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="label !mb-0">Who should see this?</span>
              <button
                type="button"
                className="text-[12px] text-muted underline"
                onClick={() => setSelected(selected.length === recipients.length ? [] : recipients.map((u) => u.id))}
              >
                {selected.length === recipients.length ? 'Clear' : 'Select everyone'}
              </button>
            </div>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {recipients.map((u) => {
                const on = selected.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected((s) => (on ? s.filter((id) => id !== u.id) : [...s, u.id]))}
                    className={`pill border ${on ? 'border-primary bg-primary/20 text-[#c9beff]' : 'border-white/15 text-muted'}`}
                  >
                    {u.fullName ?? u.email}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eg. Office closed on Friday" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea
              className="input min-h-[96px]"
              maxLength={1000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write it the way you would say it."
            />
          </div>
          {err && <p className="text-sm text-coral">{err}</p>}
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? 'Sending…' : `Send to ${selected.length || 'no one'} ${selected.length === 1 ? 'person' : 'people'}`}
          </Button>
        </form>
      )}
    </Modal>
  );
}

/** Add a company holiday (mandatory or optional). Visible live to everyone once saved. */
function HolidayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [day, setDay] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'mandatory_holiday' | 'optional_holiday'>('mandatory_holiday');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/holidays', { day, name, type }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['holidays'] });
      setDay('');
      setName('');
      setType('mandatory_holiday');
      onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!day) return setErr('Please pick a date.');
    if (!name.trim()) return setErr('Please add a holiday name.');
    create.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add holiday">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Independence Day" />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as 'mandatory_holiday' | 'optional_holiday')}>
            <option value="mandatory_holiday">Mandatory Holiday</option>
            <option value="optional_holiday">Optional Holiday</option>
          </select>
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Add holiday'}
        </Button>
      </form>
    </Modal>
  );
}
