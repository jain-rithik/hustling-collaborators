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
