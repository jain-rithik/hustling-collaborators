import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToasts } from '@/store/toast';
import { Button, Card, Pill, Spinner } from '@/components/ui';
import { IconChevronLeft } from '@/components/Icons';
import { type DeadlineState, campaignAccent, campaignLabel, fmtDate } from '@/lib/format';
import type { CampaignDto } from '@/components/CampaignCard';
import type { TaskDto } from '@/components/TaskCard';

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const meme = useToasts((s) => s.meme);
  const qc = useQueryClient();

  const cQ = useQuery({ queryKey: ['campaign', id], queryFn: () => api.get<{ campaign: CampaignDto }>(`/campaigns/${id}`) });
  const tQ = useQuery({ queryKey: ['campaign', id, 'tasks'], queryFn: () => api.get<{ tasks: TaskDto[] }>(`/campaigns/${id}/tasks`) });

  const deliver = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/deliver`),
    onSuccess: () => {
      void meme('campaign_delivered');
      void qc.invalidateQueries({ queryKey: ['campaign', id] });
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const c = cQ.data?.campaign;
  const canDeliver = c && (user.isAdmin || user.role === 'reporting_manager' || c.leadId === user.id) && c.status !== 'delivered';

  return (
    <div className="flex flex-col gap-4 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>

      {cQ.isLoading || !c ? (
        <Spinner />
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-ink">{c.clientName ?? c.name}</h1>
                <p className="text-sm text-muted">{c.name}</p>
              </div>
              <Pill tone={campaignAccent[c.state as DeadlineState]}>{campaignLabel[c.state as DeadlineState]}</Pill>
            </div>
            <div className="flex items-center gap-3 text-[13px] text-muted">
              <span>Due {fmtDate(c.deadline)}</span>
              <span>
                {c.memberCount} member{c.memberCount === 1 ? '' : 's'}
              </span>
            </div>
            {canDeliver && (
              <Button variant="mint" className="mt-2" disabled={deliver.isPending} onClick={() => deliver.mutate()}>
                {deliver.isPending ? 'Saving…' : 'Mark delivered'}
              </Button>
            )}
          </Card>

          <h2 className="font-display text-lg font-bold text-ink">Team tasks</h2>
          {(tQ.data?.tasks.length ?? 0) === 0 ? (
            <Card className="text-sm text-muted">No tasks tagged to this campaign yet.</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {tQ.data!.tasks.map((t) => (
                <Card key={t.id} className="flex items-center justify-between !p-3">
                  <span className={`text-sm ${t.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>{t.title}</span>
                  <Pill tone={t.status === 'done' ? 'mint' : t.status === 'active' ? 'primary' : 'default'}>
                    {t.status === 'done' ? 'Done' : t.status === 'active' ? 'In progress' : 'To do'}
                  </Pill>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
