import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemeEventKey } from '@hc/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToasts } from '@/store/toast';
import { Button, EmptyState, Section, Spinner } from '@/components/ui';
import { TaskCard, type TaskDto } from '@/components/TaskCard';
import { Modal } from '@/components/Modal';
import { IconPlus } from '@/components/Icons';
import type { CampaignDto } from '@/components/CampaignCard';
import { minutesBetween, minutesToHuman } from '@/lib/format';

const clientToday = () => new Date().toLocaleDateString('en-CA');
const NEW_CAMPAIGN = '__new__';

export function Tasks() {
  const qc = useQueryClient();
  const meme = useToasts((s) => s.meme);
  const [open, setOpen] = useState(false);
  const [delayFor, setDelayFor] = useState<TaskDto | null>(null);

  const tasksQ = useQuery({ queryKey: ['tasks', clientToday()], queryFn: () => api.get<{ tasks: TaskDto[] }>(`/tasks?date=${clientToday()}`) });
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

  // A task that has already run past its estimate should prompt for a reason before completing.
  function handleComplete(t: TaskDto) {
    const startedMs = t.startedAt ? Date.parse(t.startedAt) : null;
    const elapsedMin = startedMs ? (Date.now() - startedMs) / 60000 : 0;
    if (elapsedMin > t.estimatedMinutes) setDelayFor(t);
    else complete.mutate({ id: t.id });
  }

  const tasks = tasksQ.data?.tasks ?? [];
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div className="flex flex-col gap-5 pt-1">
      <Section
        title="What's your plan for the day?"
        action={
          <Button variant="ghost" className="!px-3 !py-2" onClick={() => setOpen(true)}>
            <IconPlus /> Add
          </Button>
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
            {openTasks.map((t) => (
              <TaskCard
                key={t.id}
                t={t}
                campaignName={campaignName(t.campaignId)}
                busy={start.isPending || complete.isPending}
                onStart={() => start.mutate(t.id)}
                onComplete={() => handleComplete(t)}
              />
            ))}
          </div>
        )}
      </Section>

      {done.length > 0 && (
        <Section title="Completed today">
          <div className="flex flex-col gap-3">
            {done.map((t) => (
              <TaskCard key={t.id} t={t} campaignName={campaignName(t.campaignId)} onStart={() => {}} onComplete={() => {}} />
            ))}
          </div>
        </Section>
      )}

      <AddTaskModal
        open={open}
        onClose={() => setOpen(false)}
        campaigns={campaignsQ.data?.campaigns ?? []}
        onCreated={() => {
          invalidate();
          setOpen(false);
        }}
      />

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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Start time</label>
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="label">End time</label>
              <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
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

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(reason.trim());
    setReason('');
  }

  return (
    <Modal open={!!task} onClose={onClose} title="This task ran over its estimate">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          “{task?.title}” took longer than planned. Adding a quick note helps everyone plan better next time.
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
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => onSubmit('')} disabled={busy}>
            Skip
          </Button>
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? 'Saving…' : 'Mark complete'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
