import type { DragEventHandler, ReactNode } from 'react';
import { fmtClock, fmtDate, minutesToHuman } from '@/lib/format';
import { IconArrowDown, IconArrowUp } from './Icons';
import { Pill } from './ui';

export type TaskTimeliness = 'before_time' | 'on_time' | 'delayed';

export interface TaskDto {
  id: string;
  title: string;
  ownerId: string;
  campaignId: string | null;
  campaignName: string | null;
  estimatedMinutes: number;
  status: 'todo' | 'active' | 'done';
  /** The day the task was planned for — a carried-over task keeps the day it was committed to. */
  workDate: string;
  sortOrder: number;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  startedAt: string | null;
  actualMinutes: number | null;
  withinEstimate: boolean | null;
  delayReason: string | null;
  /** Unfinished work planned for an earlier day, still on today's list until it is closed out. */
  carriedOver: boolean;
  timeliness: TaskTimeliness | null;
}

/** Shared so the read-only plan/history rows read exactly like the cards do. */
export const TASK_STATUS_META: Record<TaskTimeliness, { label: string; tone: 'mint' | 'sunny' | 'coral' }> = {
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
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  t: TaskDto;
  campaignName?: string;
  onStart: () => void;
  onComplete: () => void;
  busy?: boolean;
  /** Reordering is opt-in: the read-only week/history views pass none of these. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
}) {
  const done = t.status === 'done';
  const active = t.status === 'active';
  const status = t.timeliness ? TASK_STATUS_META[t.timeliness] : null;
  // The server names the campaign; the prop stays as a fallback for callers that resolve it themselves.
  const campaign = t.campaignName ?? campaignName;
  const plannedWindow =
    t.plannedStartTime && t.plannedEndTime ? `${fmtClock(t.plannedStartTime)} – ${fmtClock(t.plannedEndTime)}` : null;
  const reorderable = !!(onMoveUp || onMoveDown);

  return (
    <div
      className={`card transition ${active ? 'shadow-glow' : ''} ${done ? 'opacity-70' : ''} ${
        t.carriedOver ? 'ring-1 ring-coral' : ''
      } ${reorderable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={reorderable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={`font-display text-[16px] font-semibold text-ink ${done ? 'line-through decoration-muted' : ''}`}>
            {t.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {t.carriedOver && (
              <Pill tone="coral" className="animate-blink-red">
                {`Pending · ${fmtDate(t.workDate)}`}
              </Pill>
            )}
            {campaign && <Pill tone="primary">@ {campaign}</Pill>}
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

        {reorderable && (
          <div className="flex shrink-0 flex-col gap-1">
            <MoveButton label={`Move ${t.title} up`} disabled={!canMoveUp} onClick={onMoveUp}>
              <IconArrowUp width={16} height={16} />
            </MoveButton>
            <MoveButton label={`Move ${t.title} down`} disabled={!canMoveDown} onClick={onMoveDown}>
              <IconArrowDown width={16} height={16} />
            </MoveButton>
          </div>
        )}
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

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-muted transition hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
