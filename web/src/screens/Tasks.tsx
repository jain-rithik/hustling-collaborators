import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemeEventKey } from '@hc/shared';
import { api } from '@/lib/api';
import { useToasts } from '@/store/toast';
import { Button, EmptyState, Section, Spinner } from '@/components/ui';
import { TaskCard, type TaskDto } from '@/components/TaskCard';
import { Modal } from '@/components/Modal';
import { IconPlus } from '@/components/Icons';
import type { CampaignDto } from '@/components/CampaignCard';

const clientToday = () => new Date().toLocaleDateString('en-CA');

export function Tasks() {
  const qc = useQueryClient();
  const meme = useToasts((s) => s.meme);
  const [open, setOpen] = useState(false);

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
    mutationFn: (id: string) => api.post<{ memeEvent: MemeEventKey }>(`/tasks/${id}/complete`),
    onSuccess: (res) => {
      void meme(res.memeEvent);
      invalidate();
    },
  });

  const tasks = tasksQ.data?.tasks ?? [];
  const open_ = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div className="flex flex-col gap-5 pt-1">
      <Section
        title="Kya plan hai aaj ka? 🎯"
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
            title="Blank canvas"
            hint="Din shuru kar — tasks khud nahi aate. Add your first one."
            action={<Button onClick={() => setOpen(true)}>Add a task</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {open_.map((t) => (
              <TaskCard
                key={t.id}
                t={t}
                campaignName={campaignName(t.campaignId)}
                busy={start.isPending || complete.isPending}
                onStart={() => start.mutate(t.id)}
                onComplete={() => complete.mutate(t.id)}
              />
            ))}
          </div>
        )}
      </Section>

      {done.length > 0 && (
        <Section title="Done today ✅">
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
  const [title, setTitle] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [estimate, setEstimate] = useState('30');

  const create = useMutation({
    mutationFn: () =>
      api.post('/tasks', {
        title,
        campaignId: campaignId || null,
        estimatedMinutes: Number(estimate),
      }),
    onSuccess: () => {
      setTitle('');
      setCampaignId('');
      setEstimate('30');
      onCreated();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim()) create.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="New task">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label">What are you working on?</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="100 profiles shortlisting" autoFocus />
        </div>
        <div>
          <label className="label">Campaign (optional)</label>
          <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">— none —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clientName ?? c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Estimate (minutes)</label>
          <input className="input" type="number" min={1} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
        </div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add task'}
        </Button>
      </form>
    </Modal>
  );
}
