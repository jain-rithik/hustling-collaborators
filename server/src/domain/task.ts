import type { DateTime } from 'luxon';

/**
 * Task timing (PRD §8.2). Only the Start→Done window counts as task time; the gap between
 * creation and Start is never counted (keeps timing honest without a stopwatch).
 */
export function computeActualMinutes(startedAt: DateTime, completedAt: DateTime): number {
  return Math.max(0, Math.round(completedAt.diff(startedAt, 'minutes').minutes));
}

export function isWithinEstimate(actualMinutes: number, estimatedMinutes: number): boolean {
  return actualMinutes <= estimatedMinutes;
}

/** Three-way timeliness of a finished task vs its own estimate (PRD §8.2). */
export type TaskTimeliness = 'before_time' | 'on_time' | 'delayed';

/**
 * Kept consistent with `isWithinEstimate` so the label a member sees matches how the
 * leaderboard scores them: `delayed` ⇔ over estimate ⇔ NOT within estimate. Under the
 * estimate splits into `before_time` (comfortably early, beyond a ±10%/5-min band) and
 * `on_time` (finished right around the estimate). Ties/at-estimate read as `on_time`.
 */
export function taskTimeliness(actualMinutes: number, estimatedMinutes: number): TaskTimeliness {
  if (actualMinutes > estimatedMinutes) return 'delayed';
  const tolerance = Math.max(5, Math.round(estimatedMinutes * 0.1));
  if (actualMinutes <= estimatedMinutes - tolerance) return 'before_time';
  return 'on_time';
}

/**
 * Task scheduling (v4 change log). A member plans their day as a sequence of time windows and
 * cannot be in two places at once, so two tasks on the same date may never overlap. Windows
 * are HALF-OPEN — a task ending at 11:00 and the next starting at 11:00 are fine.
 */
export interface PlannedWindow {
  startMinutes: number;
  endMinutes: number;
}

/** Minutes since midnight for an 'HH:mm' clock string, or null when it is not a clock time. */
export function clockToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function toPlannedWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): PlannedWindow | null {
  const s = clockToMinutes(start);
  const e = clockToMinutes(end);
  if (s == null || e == null || e <= s) return null;
  return { startMinutes: s, endMinutes: e };
}

/** Half-open overlap: touching windows (one ends exactly where the next begins) do NOT overlap. */
export function windowsOverlap(a: PlannedWindow, b: PlannedWindow): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

export interface ScheduledTaskRef {
  id: string;
  title: string;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
}

/**
 * The first already-scheduled task whose window clashes with `candidate`, or null when the
 * slot is free. Tasks without a planned window cannot clash and are skipped.
 */
export function findScheduleClash(
  candidate: PlannedWindow,
  existing: ScheduledTaskRef[],
): ScheduledTaskRef | null {
  for (const t of existing) {
    const w = toPlannedWindow(t.plannedStartTime, t.plannedEndTime);
    if (w && windowsOverlap(candidate, w)) return t;
  }
  return null;
}

/**
 * A task planned for an earlier day that is still not done. It stays on the member's list and
 * is flagged until they close it out (v4 change log).
 */
export function isCarriedOver(
  workDateIso: string,
  status: TaskStatusLike,
  todayIso: string,
): boolean {
  return status !== 'done' && workDateIso < todayIso;
}

type TaskStatusLike = 'todo' | 'active' | 'done';
