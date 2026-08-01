import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Spinner } from '@/components/ui';
import { IconChevronLeft } from '@/components/Icons';
import { fmtDateTime } from '@/lib/format';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: { leaveRequestId?: string; compOffRequestId?: string } | null;
  isRead: boolean;
  createdAt: string;
}

export function Notifications() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const canApprove = user.isAdmin || user.role === 'reporting_manager';

  const q = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => api.get<{ notifications: Notif[] }>('/notifications') });

  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const decide = useMutation({
    mutationFn: (path: string) => api.post(path),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['leave'] });
      void qc.invalidateQueries({ queryKey: ['compoff'] });
    },
  });

  const actionsFor = (n: Notif): { approve: string; reject: string } | null => {
    if (!canApprove) return null;
    if (n.type === 'leave_request' && n.payload?.leaveRequestId)
      return {
        approve: `/leave/requests/${n.payload.leaveRequestId}/approve`,
        reject: `/leave/requests/${n.payload.leaveRequestId}/reject`,
      };
    if (n.type === 'comp_off_request' && n.payload?.compOffRequestId)
      return {
        approve: `/comp-off/requests/${n.payload.compOffRequestId}/approve`,
        reject: `/comp-off/requests/${n.payload.compOffRequestId}/reject`,
      };
    return null;
  };

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted">
          <IconChevronLeft /> Back
        </button>
        <button className="text-[13px] text-primary" onClick={() => markAll.mutate()}>
          Mark all read
        </button>
      </div>
      <h1 className="font-display text-xl font-extrabold text-ink">Notifications</h1>

      {q.isLoading ? (
        <Spinner />
      ) : (q.data?.notifications.length ?? 0) === 0 ? (
        <EmptyState emoji="🔔" title="All caught up" hint="Nothing needs you right now." />
      ) : (
        <div className="flex flex-col gap-2">
          {q.data!.notifications.map((n) => {
            const actions = actionsFor(n);
            return (
              <Card key={n.id} className={`!p-3 ${n.isRead ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display font-semibold text-ink">{n.title}</p>
                    <p className="text-[13px] text-muted">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted/60">{fmtDateTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                {actions && (
                  <div className="mt-3 flex gap-2">
                    <Button variant="mint" className="!py-2 flex-1" disabled={decide.isPending} onClick={() => decide.mutate(actions.approve)}>
                      Approve
                    </Button>
                    <Button variant="ghost" className="!py-2 flex-1" disabled={decide.isPending} onClick={() => decide.mutate(actions.reject)}>
                      Decline
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
