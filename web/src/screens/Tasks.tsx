import { type DragEvent, type FormEvent, type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemeEventKey } from '@hc/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToasts } from '@/store/toast';
import { Button, EmptyState, Pill, Section, Spinner } from '@/components/ui';
import { TASK_STATUS_META, TaskCard, type TaskDto } from '@/components/TaskCard';
import { Modal } from '@/components/Modal';
import { TimePicker } from '@/components/TimePicker';
import { IconPlus } from '@/components/Icons';
import type { CampaignDto } from '@/components/CampaignCard';
import { fmtDate, istToday, minutesBetween, minutesToHuman } from '@/lib/format';

const NEW_CAMPAIGN = '__new__';

/** The Mon–Sat working week (Sunday is off) containing the given day. */
function workWeek(iso: string): string[] {
  const start = new Date(`${iso}T00:00:00`);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toLocaleDateString('en-CA');
  });
}

const weekdayShort = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });

interface HistoryDay {
  date: string;
  total: number;
  done: number;
  delayed: number;
  pending: number;
  tasks: TaskDto[];
}

export function Tasks() {
  const qc = useQueryClient();
  const meme = useToasts((s) => s.meme);
  const today = istToday();
  const [open, setOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [delayFor, setDelayFor] = useState<TaskDto | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // carryOver=1 keeps unfinished work from earlier days on the list until it is closed out.
  const tasksKey = ['tasks', today];
  const tasksQ = useQuery({
    queryKey: tasksKey,
    queryFn: () => api.get<{ tasks: TaskDto[] }>(`/tasks?date=${today}&carryOver=1`),
  });
  const campaignsQ = useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<{ campaigns: CampaignDto[] }>('/campaigns') });
  const campaignName = (id: string | null) =>
    id ? campaignsQ.data?.campaigns.find((c) => c.id === id)?.name.split(' — ')[0] : undefined;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    void qc.invalidateQueries({ queryKey: ['focus'] });
  };

  const start = useMutation({ mutationFn: (id: string) => api.post(`/tasks/${id}/start`), onSuccess: invalidate });
  const complete = useMutation({
    mutationFn: (v: { id: string; delayReason?: string }) =>
      api.post<{ memeEvent: MemeEventKey }>(`/tasks/${v.id}/complete`, v.delayReason ? { delayReason: v.delayReason } : undefined),
    onSuccess: (res) => {
      void meme(res.memeEvent);
      invalidate();
    },
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.post('/tasks/reorder', { ids }),
    // Re-sync either way: on success to confirm the saved order, on failure to drop the local one.
    onSettled: invalidate,
  });

  // A task that has already run past its estimate should prompt for a reason before completing.
  function handleComplete(t: TaskDto) {
    const startedMs = t.startedAt ? Date.parse(t.startedAt) : null;
    const elapsedMin = startedMs ? (Date.now() - startedMs) / 60000 : 0;
    if (elapsedMin > t.estimatedMinutes) setDelayFor(t);
    else complete.mutate({ id: t.id });
  }

  const tasks = tasksQ.data?.tasks ?? [];
  // One list, server order (sortOrder). Completing or starting a task never moves it (v4 feedback).
  const carried = tasks.filter((t) => t.carriedOver);
  const todays = tasks.filter((t) => !t.carriedOver);

  /** Paint the new sequence straight away, then persist it. Only today's tasks reorder. */
  function applyOrder(next: TaskDto[]) {
    qc.setQueryData<{ tasks: TaskDto[] }>(tasksKey, (prev) => (prev ? { tasks: [...carried, ...next] } : prev));
    reorder.mutate(next.map((t) => t.id));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= todays.length) return;
    const next = [...todays];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    applyOrder(next);
  }

  function dropOn(index: number) {
    const from = todays.findIndex((t) => t.id === draggingId);
    setDraggingId(null);
    if (from >= 0 && from !== index) move(from, index);
  }

  return (
    <div className="flex flex-col gap-5 pt-1">
      <Section
        title="What's your plan for the day?"
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" className="!px-3 !py-2 !text-[13px]" onClick={() => setPlanOpen(true)}>
              Week plan
            </Button>
            <Button variant="ghost" className="!px-3 !py-2" onClick={() => setOpen(true)}>
              <IconPlus /> Add
            </Button>
          </div>
        }
      >
        {tasksQ.isLoading ? (
          <Spinner />
        ) : tasks.length === 0 ? (
          <EmptyState
            emoji="🎯"
            title="Nothing planned yet"
            hint="Plan your day by adding your first task."
            action={<Button onClick={() => setOpen(true)}>Add a task</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {carried.length > 0 && (
              <>
                <p className="text-[12px] font-medium text-coral">Pending from earlier</p>
                {carried.map((t) => (
                  <TaskCard
                    key={t.id}
                    t={t}
                    campaignName={campaignName(t.campaignId)}
                    busy={start.isPending || complete.isPending}
                    onStart={() => start.mutate(t.id)}
                    onComplete={() => handleComplete(t)}
                  />
                ))}
                <p className="mt-1 text-[12px] font-medium text-muted">Today</p>
              </>
            )}
            {todays.map((t, i) => (
              <TaskCard
                key={t.id}
                t={t}
                campaignName={campaignName(t.campaignId)}
                busy={start.isPending || complete.isPending}
                onStart={() => start.mutate(t.id)}
                onComplete={() => handleComplete(t)}
                onMoveUp={() => move(i, i - 1)}
                onMoveDown={() => move(i, i + 1)}
                canMoveUp={i > 0}
                canMoveDown={i < todays.length - 1}
                onDragStart={() => setDraggingId(t.id)}
                onDragOver={(e: DragEvent<HTMLDivElement>) => e.preventDefault()}
                onDrop={() => dropOn(i)}
              />
            ))}
          </div>
        )}
      </Section>

      <AddTaskModal
        open={open}
        onClose={() => setOpen(false)}
        campaigns={campaignsQ.data?.campaigns ?? []}
        onCreated={() => {
          invalidate();
          setOpen(false);
        }}
      />

      <TaskPlanModal open={planOpen} onClose={() => setPlanOpen(false)} today={today} />

      <DelayReasonModal
        task={delayFor}
        busy={complete.isPending}
        onClose={() => setDelayFor(null)}
        onSubmit={(reason) => {
          if (delayFor) complete.mutate({ id: delayFor.id, delayReason: reason });
          setDelayFor(null);
        }}
      />
    </div>
  );
}

function AddTaskModal({
  open,
  onClose,
  campaigns,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  campaigns: CampaignDto[];
  onCreated: () => void;
}) {
  const user = useAuth((s) => s.user)!;
  const canCreateCampaign = user.isAdmin || user.role === 'reporting_manager';
  const [title, setTitle] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [newCampaign, setNewCampaign] = useState(false);
  const [err, setErr] = useState('');

  const estimate = minutesBetween(startTime, endTime);

  const create = useMutation({
    mutationFn: () =>
      api.post('/tasks', {
        title,
        campaignId: campaignId || null,
        estimatedMinutes: estimate,
        plannedStartTime: startTime,
        plannedEndTime: endTime,
      }),
    onSuccess: () => {
      setTitle('');
      setCampaignId('');
      setStartTime('10:00');
      setEndTime('11:00');
      onCreated();
    },
    // The server explains an overlapping slot in plain English — show it and keep the form open.
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!title.trim()) return setErr('Give your task a title.');
    if (!estimate) return setErr('The end time must be after the start time.');
    create.mutate();
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="New task">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="label">What are you working on?</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eg. Shortlist 100 creator profiles" autoFocus />
          </div>
          <div>
            <label className="label">Campaign (optional)</label>
            <select
              className="input"
              value={campaignId}
              onChange={(e) => {
                if (e.target.value === NEW_CAMPAIGN) {
                  setNewCampaign(true);
                } else {
                  setCampaignId(e.target.value);
                }
              }}
            >
              <option value="">— None —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName ?? c.name}
                </option>
              ))}
              {canCreateCampaign && <option value={NEW_CAMPAIGN}>＋ Add a campaign…</option>}
            </select>
          </div>
          {/* Stacked, not side by side: three selects each need the room on a phone. */}
          <TimePicker label="Start time" value={startTime} onChange={setStartTime} disabled={create.isPending} />
          <TimePicker label="End time" value={endTime} onChange={setEndTime} disabled={create.isPending} />
          <p className="text-[12px] text-muted">
            {estimate ? `Estimated time: ${minutesToHuman(estimate)}` : 'Set an end time after the start time.'}
          </p>
          {err && <p className="text-sm text-coral">{err}</p>}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add task'}
          </Button>
        </form>
      </Modal>

      <QuickCampaignModal
        open={newCampaign}
        onClose={() => setNewCampaign(false)}
        leadId={user.id}
        onCreated={(id) => {
          setCampaignId(id);
          setNewCampaign(false);
        }}
      />
    </>
  );
}

/** Lightweight inline campaign creator so a lead/admin never leaves the add-task flow. */
function QuickCampaignModal({
  open,
  onClose,
  leadId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.post<{ campaign: { id: string } }>('/campaigns', {
        name,
        clientName: clientName || undefined,
        leadId,
        deadline,
        memberIds: [],
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      setName('');
      setClientName('');
      setDeadline('');
      onCreated(res.campaign.id);
    },
    onError: (e: Error) => setErr(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (name.trim() && deadline) create.mutate();
    else setErr('A campaign needs a name and a deadline.');
  }

  return (
    <Modal open={open} onClose={onClose} title="New campaign">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label">Campaign name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Eg. Diwali Creator Push" autoFocus />
        </div>
        <div>
          <label className="label">Client (optional)</label>
          <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Eg. Acme Foods" />
        </div>
        <div>
          <label className="label">Deadline</label>
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create campaign'}
        </Button>
      </form>
    </Modal>
  );
}

/** Read-only plan and log: this week's Mon–Sat plan, and the past 30 days day by day. */
function TaskPlanModal({ open, onClose, today }: { open: boolean; onClose: () => void; today: string }) {
  const [view, setView] = useState<'week' | 'history'>('week');
  const [weekDay, setWeekDay] = useState(today);
  const [historyDay, setHistoryDay] = useState<string | null>(null);
  const week = workWeek(today);

  const weekQ = useQuery({
    queryKey: ['tasks', 'week', week[0]],
    queryFn: () => api.get<{ tasks: TaskDto[] }>(`/tasks?from=${week[0]}&to=${week[week.length - 1]}`),
    enabled: open && view === 'week',
  });
  const historyQ = useQuery({
    queryKey: ['tasks', 'history'],
    queryFn: () => api.get<{ from: string; to: string; days: HistoryDay[] }>('/tasks/history'),
    enabled: open && view === 'history',
  });

  const weekTasks = weekQ.data?.tasks ?? [];
  const historyDays = historyQ.data?.days ?? [];
  // Newest day first, so the log opens on the most recent day the member logged anything.
  const selectedHistory = historyDay ?? historyDays[0]?.date ?? null;
  const loading = view === 'week' ? weekQ.isLoading : historyQ.isLoading;
  const dayTasks =
    view === 'week'
      ? weekTasks.filter((t) => t.workDate === weekDay)
      : (historyDays.find((d) => d.date === selectedHistory)?.tasks ?? []);
  const selectedDate = view === 'week' ? weekDay : selectedHistory;

  return (
    <Modal open={open} onClose={onClose} title="Task plan & history">
      <div className="flex flex-col gap-3">
        <div className="flex rounded-full bg-white/5 p-1">
          <SegmentButton selected={view === 'week'} onClick={() => setView('week')}>
            This week
          </SegmentButton>
          <SegmentButton selected={view === 'history'} onClick={() => setView('history')}>
            Last 30 days
          </SegmentButton>
        </div>

        {loading ? (
          <Spinner />
        ) : view === 'history' && historyDays.length === 0 ? (
          <EmptyState emoji="🗂️" title="No task history yet" hint="Days you plan tasks on will show up here." />
        ) : (
          <>
            {/* Chips scroll sideways on a phone and simply sit in a row on a laptop. */}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {view === 'week'
                ? week.map((d) => (
                    <DayTab
                      key={d}
                      date={d}
                      count={weekTasks.filter((t) => t.workDate === d).length}
                      selected={d === weekDay}
                      isToday={d === today}
                      onSelect={() => setWeekDay(d)}
                    />
                  ))
                : historyDays.map((d) => (
                    <DayTab
                      key={d.date}
                      date={d.date}
                      count={d.total}
                      pending={d.pending}
                      selected={d.date === selectedHistory}
                      isToday={d.date === today}
                      onSelect={() => setHistoryDay(d.date)}
                    />
                  ))}
            </div>

            {selectedDate && <p className="text-[12px] text-muted">{fmtDate(selectedDate)}</p>}

            <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto">
              {dayTasks.length === 0 ? (
                <EmptyState emoji="🗓️" title="Nothing planned that day" hint="Pick another day to see its tasks." />
              ) : (
                dayTasks.map((t) => <PlanRow key={t.id} t={t} />)
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function SegmentButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-2 text-[13px] font-semibold transition ${
        selected ? 'bg-primary text-white' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function DayTab({
  date,
  count,
  pending,
  selected,
  isToday,
  onSelect,
}: {
  date: string;
  count: number;
  pending?: number;
  selected: boolean;
  isToday: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition ${
        selected ? 'bg-primary/25 text-ink' : 'bg-white/5 text-muted hover:text-ink'
      } ${isToday && !selected ? 'ring-1 ring-primary/60' : ''}`}
    >
      <span className="text-[10px] uppercase tracking-wide">{weekdayShort(date)}</span>
      <span className="font-display text-[13px] font-bold">{fmtDate(date)}</span>
      <span className={`text-[10px] ${pending ? 'text-coral' : count ? 'text-mint' : 'text-muted/60'}`}>
        {count ? `${count} task${count === 1 ? '' : 's'}` : 'Free'}
      </span>
    </button>
  );
}

/** One compact line per task in the read-only views: title — campaign — how it went. */
function PlanRow({ t }: { t: TaskDto }) {
  const meta = t.timeliness ? TASK_STATUS_META[t.timeliness] : null;
  const label = meta?.label ?? (t.status === 'done' ? 'Done' : 'Pending');

  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] text-ink">{t.title}</p>
          <p className="truncate text-[12px] text-muted">{t.campaignName ?? 'No campaign'}</p>
        </div>
        <Pill tone={meta?.tone ?? (t.status === 'done' ? 'mint' : 'sunny')} className="shrink-0">
          {label}
        </Pill>
      </div>
      {t.timeliness === 'delayed' && t.delayReason && (
        <p className="mt-1.5 rounded-lg bg-coral/10 px-2.5 py-1.5 text-[12px] text-coral">
          Reason for delay: <span className="text-ink">{t.delayReason}</span>
        </p>
      )}
    </div>
  );
}

/** Prompt for a reason when a task is being completed past its estimate. */
function DelayReasonModal({
  task,
  busy,
  onClose,
  onSubmit,
}: {
  task: TaskDto | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return; // reason is mandatory — cannot skip
    onSubmit(trimmed);
    setReason('');
  }

  return (
    // Mandatory (v2 §04): no skip, not dismissible, submit stays disabled until a reason is typed.
    <Modal open={!!task} onClose={onClose} title="This task ran over its estimate" dismissible={false}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          “{task?.title}” took longer than planned. Please add a reason for the delay to mark it complete.
        </p>
        <div>
          <label className="label">Reason for delay</label>
          <textarea
            className="input min-h-[84px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Eg. Client sent revised assets midway"
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || !trimmed}>
          {busy ? 'Saving…' : 'Mark complete'}
        </Button>
      </form>
    </Modal>
  );
}
