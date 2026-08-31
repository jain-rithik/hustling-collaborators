import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BREAK_TYPE_LABELS, type BreakType, LUNCH_ALLOWANCE_MINUTES, TEA_ALLOWANCE_MINUTES } from '@hc/shared';
import { api } from '@/lib/api';
import { Button, Card } from './ui';
import { Modal } from './Modal';

export interface BreakState {
  active: { id: string; type: BreakType; startedAt: string } | null;
  employeeAlert: boolean;
}

/**
 * The allowance shown the moment a break starts (v4 client feedback). Sourced from the shared
 * constants so the number a member is told always matches the one the alerts are judged against.
 */
const ALLOWANCE: Record<BreakType, { minutes: number; title: string }> = {
  lunch: { minutes: LUNCH_ALLOWANCE_MINUTES, title: 'Enjoy your lunch 🍽️' },
  tea: { minutes: TEA_ALLOWANCE_MINUTES, title: 'Enjoy your tea ☕' },
};

/**
 * Silent lunch/tea break controls (v2 change log §02). Only tap buttons are shown — never a timer
 * or elapsed duration. The employee taps to start and taps "Back at it" to end.
 */
export function BreakControls() {
  const qc = useQueryClient();
  // Which break we have just started, i.e. whose allowance pop-up is on screen (v4 client feedback).
  const [greeted, setGreeted] = useState<BreakType | null>(null);
  const q = useQuery({
    queryKey: ['breaks', 'today'],
    queryFn: () => api.get<BreakState>('/breaks/today'),
    refetchInterval: 45_000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['breaks', 'today'] });
  const start = useMutation({
    mutationFn: (type: BreakType) => api.post('/breaks/start', { type }),
    // Only greet once the server has actually opened the break — never on a failed tap.
    onSuccess: (_res, type) => {
      setGreeted(type);
      void invalidate();
    },
  });
  const end = useMutation({ mutationFn: () => api.post('/breaks/end'), onSuccess: invalidate });

  const active = q.data?.active ?? null;
  const busy = start.isPending || end.isPending;

  return (
    <>
      {active ? (
        <Card className="flex items-center justify-between">
          <span className="text-sm text-ink">
            {active.type === 'lunch' ? 'On your lunch break 🍽️' : 'On a tea break ☕'}
          </span>
          <button onClick={() => end.mutate()} disabled={busy} className="btn bg-white/10 text-ink disabled:opacity-50">
            Back at it
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => start.mutate('lunch')} disabled={busy} className="btn bg-white/8 text-ink disabled:opacity-50">
            Taking lunch 🍽️
          </button>
          <button onClick={() => start.mutate('tea')} disabled={busy} className="btn bg-white/8 text-ink disabled:opacity-50">
            Tea break ☕
          </button>
        </div>
      )}

      {greeted && (
        <Modal open onClose={() => setGreeted(null)} title={ALLOWANCE[greeted].title}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">You have {ALLOWANCE[greeted].minutes} minutes.</p>
            <p className="text-[13px] text-muted">
              Your {BREAK_TYPE_LABELS[greeted].toLowerCase()} break is tracked quietly — there is no clock on your
              screen. Just tap “Back at it” when you are back.
            </p>
            <Button onClick={() => setGreeted(null)}>Got it</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
