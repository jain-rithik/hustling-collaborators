import { fmtClock, minutesToHuman } from '@/lib/format';
import { Pill } from './ui';

export type TaskTimeliness = 'before_time' | 'on_time' | 'delayed';

export interface TaskDto {
  id: string;
  title: string;
  campaignId: string | null;
  estimatedMinutes: number;
  status: 'todo' | 'active' | 'done';
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  startedAt: string | null;
  actualMinutes: number | null;
  withinEstimate: boolean | null;
  delayReason: string | null;
  timeliness: TaskTimeliness | null;
}

const STATUS_META: Record<TaskTimeliness, { label: string; tone: 'mint' | 'sunny' | 'coral' }> = {
  before_time: { label: 'Before time', tone: 'mint' },
  on_time: { label: 'On time', tone: 'mint' },
  delayed: { label: 'Delayed', tone: 'coral' },
};

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
  const status = t.timeliness ? STATUS_META[t.timeliness] : null;
  const plannedWindow =
    t.plannedStartTime && t.plannedEndTime ? `${fmtClock(t.plannedStartTime)} – ${fmtClock(t.plannedEndTime)}` : null;

  return (
    <div className={`card transition ${active ? 'shadow-glow' : ''} ${done ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={`font-display text-[16px] font-semibold text-ink ${done ? 'line-through decoration-muted' : ''}`}>
            {t.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {campaignName && <Pill tone="primary">@ {campaignName}</Pill>}
            {plannedWindow && <span>{plannedWindow}</span>}
            {!done && <span>Estimated {minutesToHuman(t.estimatedMinutes)}</span>}
            {status && <Pill tone={status.tone}>{status.label}</Pill>}
          </div>

          {done && t.actualMinutes != null && (
            <div className="mt-2 flex flex-col gap-0.5 text-[12px] text-muted">
              <span>
                Estimated time: <span className="text-ink">{minutesToHuman(t.estimatedMinutes)}</span>
              </span>
              <span>
                Actual time taken: <span className="text-ink">{minutesToHuman(t.actualMinutes)}</span>
              </span>
            </div>
          )}

          {done && t.timeliness === 'delayed' && t.delayReason && (
            <p className="mt-2 rounded-lg bg-coral/10 px-2.5 py-1.5 text-[12px] text-coral">
              Reason for delay: <span className="text-ink">{t.delayReason}</span>
            </p>
          )}
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
              Start
            </button>
          ) : (
            <button onClick={onComplete} disabled={busy} className="btn-primary flex-1">
              Mark complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
