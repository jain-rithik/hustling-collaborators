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
