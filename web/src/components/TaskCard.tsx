import { minutesToHuman } from '@/lib/format';
import { Pill } from './ui';

export interface TaskDto {
  id: string;
  title: string;
  campaignId: string | null;
  estimatedMinutes: number;
  status: 'todo' | 'active' | 'done';
  actualMinutes: number | null;
  withinEstimate: boolean | null;
}

export function TaskCard({
  t,
  campaignName,
  onStart,
  onComplete,
  busy,
}: {
  t: TaskDto;
  campaignName?: string;
  onStart: () => void;
  onComplete: () => void;
  busy?: boolean;
}) {
  const done = t.status === 'done';
  const active = t.status === 'active';
  return (
    <div
      className={`card transition ${active ? 'shadow-glow' : ''} ${done ? 'opacity-55' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`font-display text-[16px] font-semibold text-ink ${done ? 'line-through decoration-muted' : ''}`}>
            {t.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {campaignName && <Pill tone="primary">@ {campaignName}</Pill>}
            <span>~ {minutesToHuman(t.estimatedMinutes)} planned</span>
            {done && t.actualMinutes != null && (
              <Pill tone={t.withinEstimate ? 'mint' : 'coral'}>
                {t.withinEstimate ? 'on estimate' : 'over'} · {minutesToHuman(t.actualMinutes)}
              </Pill>
            )}
          </div>
        </div>
      </div>

      {!done && (
        <div className="mt-4 flex gap-2">
          {t.status === 'todo' ? (
            <button
              onClick={onStart}
              disabled={busy}
              className="btn flex-1 bg-primary/20 text-[#c9beff] disabled:opacity-50"
            >
              On it 🔥
            </button>
          ) : (
            <button onClick={onComplete} disabled={busy} className="btn-primary flex-1">
              Nailed it ✅
            </button>
          )}
        </div>
      )}
    </div>
  );
}
