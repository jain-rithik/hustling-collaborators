import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Card, Pill, Section, Spinner } from '@/components/ui';
import { IconChevronLeft } from '@/components/Icons';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isFounder: boolean;
  isActive: boolean;
  fullName: string | null;
}

export function Admin() {
  const navigate = useNavigate();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();

  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get<{ users: AdminUser[] }>('/admin/users') });
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

  return (
    <div className="flex flex-col gap-5 pt-1">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 self-start text-muted">
        <IconChevronLeft /> Back
      </button>
      <h1 className="font-display text-xl font-extrabold text-ink">Admin console ⚙️</h1>

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
          <Card className="text-sm text-muted">Nobody's been late 🎉</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {late.data!.report.map((r) => (
              <Card key={r.userId} className="flex items-center justify-between !p-3 text-sm">
                <span className="text-ink">{r.name}</span>
                <Pill tone={r.lateCount >= 3 ? 'coral' : 'sunny'}>{r.lateCount} slow starts</Pill>
              </Card>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted/70">Surfaced for coaching — no automatic penalty (PRD §9.2). {me.isAdmin ? '' : ''}</p>
      </Section>
    </div>
  );
}
