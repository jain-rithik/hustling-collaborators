import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Button, EmptyState, Section, Spinner } from '@/components/ui';
import { CampaignCard, type CampaignDto } from '@/components/CampaignCard';
import { Modal } from '@/components/Modal';
import { IconPlus } from '@/components/Icons';

interface ProfileLite {
  userId: string;
  fullName: string;
}

export function Campaigns() {
  const user = useAuth((s) => s.user)!;
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<{ campaigns: CampaignDto[] }>('/campaigns') });
  const canCreate = user.isAdmin || user.role === 'reporting_manager';

  return (
    <div className="flex flex-col gap-4 pt-1">
      <Section
        title="Campaigns"
        action={
          canCreate ? (
            <Button variant="ghost" className="!px-3 !py-2" onClick={() => setOpen(true)}>
              <IconPlus /> New
            </Button>
          ) : undefined
        }
      >
        {q.isLoading ? (
          <Spinner />
        ) : (q.data?.campaigns.length ?? 0) === 0 ? (
          <EmptyState emoji="📣" title="No campaigns yet" hint="Your campaigns will appear here once they're created." />
        ) : (
          <div className="flex flex-col gap-3">
            {q.data!.campaigns.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </Section>

      {canCreate && <CreateCampaignModal open={open} onClose={() => setOpen(false)} />}
    </div>
  );
}

function CreateCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.get<{ profiles: ProfileLite[] }>('/profiles'),
    enabled: open,
  });
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [leadId, setLeadId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () => api.post('/campaigns', { name, clientName, deadline, leadId, memberIds }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name && deadline && leadId) create.mutate();
  }

  const toggle = (id: string) =>
    setMemberIds((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <Modal open={open} onClose={onClose} title="New campaign">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="label">Campaign name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Festive Push" />
        </div>
        <div>
          <label className="label">Client</label>
          <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Sugar Cosmetics" />
        </div>
        <div>
          <label className="label">Deadline</label>
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div>
          <label className="label">Lead</label>
          <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">— pick a lead —</option>
            {profiles.data?.profiles.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Members</label>
          <div className="flex flex-wrap gap-2">
            {profiles.data?.profiles.map((p) => (
              <button
                type="button"
                key={p.userId}
                onClick={() => toggle(p.userId)}
                className={`pill ${memberIds.includes(p.userId) ? 'bg-primary/25 text-[#c9beff]' : 'bg-white/8 text-muted'}`}
              >
                {p.fullName.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create campaign'}
        </Button>
      </form>
    </Modal>
  );
}
