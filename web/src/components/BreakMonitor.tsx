import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { BreakState } from './BreakControls';

/** A short two-tone beep via Web Audio (the "default notification sound"). No-op if autoplay is blocked. */
function playAlertSound() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const beep = (at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.36);
    };
    beep(0);
    beep(0.45);
  } catch {
    /* autoplay policy may block audio until a gesture — the visible popup still appears */
  }
}

/**
 * Global watcher (v2 change log §07): while an employee's break runs long the server flags
 * `employeeAlert`; this shows a full-screen popup with a sound that can only be dismissed by
 * returning to work. Mounted once in the app shell so it appears on any screen.
 */
export function BreakMonitor() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['breaks', 'today'],
    queryFn: () => api.get<BreakState>('/breaks/today'),
    refetchInterval: 45_000,
    enabled: !!user,
  });
  const end = useMutation({
    mutationFn: () => api.post('/breaks/end'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['breaks', 'today'] }),
  });

  const alerting = !!q.data?.employeeAlert;
  const played = useRef(false);
  useEffect(() => {
    if (alerting && !played.current) {
      played.current = true;
      playAlertSound();
    }
    if (!alerting) played.current = false;
  }, [alerting]);

  if (!alerting) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-6 text-center shadow-glow">
        <div className="text-3xl">⏰</div>
        <h2 className="mt-2 font-display text-lg font-bold text-ink">Time to head back</h2>
        <p className="mt-1 text-sm text-muted">
          Your lunch break has gone over 55 minutes. Whenever you’re ready, let’s pick things back up.
        </p>
        <button onClick={() => end.mutate()} disabled={end.isPending} className="btn-primary mt-4 w-full">
          {end.isPending ? 'One moment…' : 'Back to work'}
        </button>
      </div>
    </div>
  );
}
