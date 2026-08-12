import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BreakType } from '@hc/shared';
import { api } from '@/lib/api';
import { Card } from './ui';

export interface BreakState {
  active: { id: string; type: BreakType; startedAt: string } | null;
  employeeAlert: boolean;
}

/**
 * Silent lunch/tea break controls (v2 change log §02). Only tap buttons are shown — never a timer
 * or elapsed duration. The employee taps to start and taps "Back at it" to end.
 */
export function BreakControls() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['breaks', 'today'],
    queryFn: () => api.get<BreakState>('/breaks/today'),
    refetchInterval: 45_000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['breaks', 'today'] });
  const start = useMutation({ mutationFn: (type: BreakType) => api.post('/breaks/start', { type }), onSuccess: invalidate });
  const end = useMutation({ mutationFn: () => api.post('/breaks/end'), onSuccess: invalidate });

  const active = q.data?.active ?? null;
  const busy = start.isPending || end.isPending;

  if (active) {
    return (
      <Card className="flex items-center justify-between">
        <span className="text-sm text-ink">
          {active.type === 'lunch' ? 'On your lunch break 🍽️' : 'On a tea break ☕'}
        </span>
        <button onClick={() => end.mutate()} disabled={busy} className="btn bg-white/10 text-ink disabled:opacity-50">
          Back at it
        </button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => start.mutate('lunch')} disabled={busy} className="btn bg-white/8 text-ink disabled:opacity-50">
        Taking lunch 🍽️
      </button>
      <button onClick={() => start.mutate('tea')} disabled={busy} className="btn bg-white/8 text-ink disabled:opacity-50">
        Tea break ☕
      </button>
    </div>
  );
}
