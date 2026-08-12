import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Button, Card, Pill, Section, Spinner } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { IconChevronLeft, IconPlus } from '@/components/Icons';
import { fmtDate, fmtTime12, minutesToHuman } from '@/lib/format';
import { BEREAVEMENT_RELATIONSHIP_LABELS, type BereavementRelationship, LEAVE_TYPE_LABELS, type LeaveType } from '@hc/shared';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isFounder: boolean;
  isActive: boolean;
  fullName: string | null;
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
  leaveType: string;
  start: string;
  end: string;
  isHalfDay: boolean;
  isSick: boolean;
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

export function Admin() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const [allotFor, setAllotFor] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState('');
  const [confirmDeleteHoliday, setConfirmDeleteHoliday] = useState<string | null>(null);
  const [holidayModal, setHolidayModal] = useState(false);

  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<{ date: string; people: OverviewPerson[] }>('/admin/daily-overview') });
  const pending = useQuery({ queryKey: ['admin', 'pending'], queryFn: () => api.get<Pending>('/admin/pending-requests') });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get<{ users: AdminUser[] }>('/admin/users') });
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<{ campaigns: AdminCampaign[] }>('/campaigns') });
  const holidays = useQuery({ queryKey: ['holidays'], queryFn: () => api.get<{ holidays: Holiday[] }>('/holidays') });
  const late = useQuery({ queryKey: ['admin', 'late'], queryFn: () => api.get<{ report: { userId: string; name: string; lateCount: number }[] }>('/admin/late-report') });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin'] });
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
    mutationFn: (id: string) => api.post(`/leave/requests/${id}/approve`, {}),
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

  return (
    <div className="flex flex-col gap-5 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>
      <h1 className="font-display text-xl font-extrabold text-ink">Admin console</h1>

      <Section title="Pending requests">
        {pending.isLoading ? (
          <Spinner />
        ) : pending.data!.leave.length + pending.data!.compOff.length === 0 ? (
          <Card className="text-sm text-muted">No pending requests right now.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.data!.leave.map((l) => (
              <Card key={l.id} className="!p-3">
                <p className="font-display font-semibold text-ink">{l.name}</p>
                <p className="text-[12px] text-muted">
                  {LEAVE_TYPE_LABELS[l.leaveType as LeaveType]} · {fmtDate(l.start)}
                  {l.start !== l.end ? ' → ' + fmtDate(l.end) : ''} · {l.isHalfDay ? 'Half day' : l.requestedDays + 'd'}
                </p>
                <p className="mt-1 text-[12px] text-muted">{l.reason}</p>
                {(l.isSick || l.bereavementRelationship) && (
                  <div className="mt-1.5 flex gap-1.5">
                    {l.isSick && <Pill tone="lavender">Sick</Pill>}
                    {l.bereavementRelationship && (
                      <Pill tone="default">{BEREAVEMENT_RELATIONSHIP_LABELS[l.bereavementRelationship as BereavementRelationship]}</Pill>
                    )}
                  </div>
                )}
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
                    <Button variant="mint" className="flex-1" disabled={approveLeave.isPending} onClick={() => approveLeave.mutate(l.id)}>
                      Approve
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
            ))}
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
      </Section>

      <Section title="Today — who's in & what's moving">
        {overview.isLoading ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-2">
            {overview.data!.people.map((p) => (
              <PersonRow key={p.userId} p={p} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Campaigns">
        {campaigns.isLoading ? (
          <Spinner />
        ) : (campaigns.data?.campaigns.length ?? 0) === 0 ? (
          <Card className="text-sm text-muted">No campaigns yet.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {campaigns.data!.campaigns.map((c) => (
              <Card key={c.id} className="flex items-center justify-between !p-3">
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">{c.clientName ?? c.name}</p>
                  <p className="text-[12px] text-muted">
                    Due {fmtDate(c.deadline)} · {c.memberCount} member{c.memberCount === 1 ? '' : 's'} · {c.status.replaceAll('_', ' ')}
                  </p>
                </div>
                {confirmDelete === c.id ? (
                  <div className="flex items-center gap-2">
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
                  <button className="pill bg-white/8 text-coral" onClick={() => setConfirmDelete(c.id)}>
                    Delete
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Holidays"
        action={
          <Button variant="ghost" className="!px-3 !py-2" onClick={() => setHolidayModal(true)}>
            <IconPlus /> Add
          </Button>
        }
      >
        {holidays.isLoading ? (
          <Spinner />
        ) : (holidays.data?.holidays.length ?? 0) === 0 ? (
          <Card className="text-sm text-muted">No holidays added yet.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {holidays.data!.holidays.map((h) => (
              <Card key={h.id} className="flex items-center justify-between !p-3">
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">{h.name}</p>
                  <p className="text-[12px] text-muted">{fmtDate(h.day)}</p>
                </div>
                <div className="flex items-center gap-2">
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
      </Section>

      <Section title="Team">
        {users.isLoading ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-2">
            {users.data!.users.map((u) => (
              <Card key={u.id} className="!p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-ink">{u.fullName ?? u.email}</p>
                    <div className="mt-1 flex gap-1.5">
                      <Pill tone="primary">{u.role.replaceAll('_', ' ')}</Pill>
                      {u.isFounder && <Pill tone="sunny">founder</Pill>}
                      {!u.isActive && <Pill tone="coral">disabled</Pill>}
                    </div>
                  </div>
                  <button className="pill bg-mint/15 text-mint" onClick={() => setAllotFor(u)}>
                    Paid leaves
                  </button>
                </div>
                {!u.isFounder && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className={`pill flex-1 justify-center ${u.isAdmin ? 'bg-sunny/20 text-sunny' : 'bg-white/8 text-muted'}`}
                      disabled={toggleAdmin.isPending}
                      onClick={() => toggleAdmin.mutate({ id: u.id, isAdmin: !u.isAdmin })}
                    >
                      {u.isAdmin ? 'Revoke admin' : 'Make admin'}
                    </button>
                    <button
                      className={`pill flex-1 justify-center ${u.isActive ? 'bg-white/8 text-muted' : 'bg-mint/20 text-mint'}`}
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Late arrivals — this month">
        {late.isLoading ? (
          <Spinner />
        ) : (late.data?.report.length ?? 0) === 0 ? (
          <Card className="text-sm text-muted">No late arrivals this month.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {late.data!.report.map((r) => (
              <Card key={r.userId} className="flex items-center justify-between !p-3 text-sm">
                <span className="text-ink">{r.name}</span>
                <Pill tone={r.lateCount >= 3 ? 'coral' : 'sunny'}>
                  {r.lateCount} late arrival{r.lateCount === 1 ? '' : 's'}
                </Pill>
              </Card>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted/70">Surfaced for coaching — there is no automatic penalty. {me.isAdmin ? '' : ''}</p>
      </Section>

      <AllotLeaveModal user={allotFor} onClose={() => setAllotFor(null)} />
      <HolidayModal open={holidayModal} onClose={() => setHolidayModal(false)} />
    </div>
  );
}

function PersonRow({ p }: { p: OverviewPerson }) {
  const [expand, setExpand] = useState(false);
  return (
    <Card className="!p-3">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setExpand((v) => !v)}>
        <div>
          <p className="font-display font-semibold text-ink">{p.name}</p>
          <p className="text-[12px] text-muted">
            {p.checkInAt ? `In at ${fmtTime12(p.checkInAt)}` : 'Not checked in'}
            {p.checkOutAt ? ` · Out ${fmtTime12(p.checkOutAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {p.isLate && <Pill tone="coral">late</Pill>}
          {p.allDone ? (
            <Pill tone="mint">all done</Pill>
          ) : (
            <Pill tone={p.taskCount ? 'sunny' : 'default'}>
              {p.doneCount}/{p.taskCount} tasks
            </Pill>
          )}
        </div>
      </button>
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
