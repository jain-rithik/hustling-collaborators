import {
  CAMPAIGN_COMING_UP_DAYS,
  type CampaignDeadlineIndicator,
  type CampaignStatus,
} from '@hc/shared';
import { type IsoDate, istDate } from './time/ist.js';

/**
 * Campaign deadline state machine (domain-rules §14 / PRD §11.2), derived at read time so it
 * never goes stale:  d>5 → on_track · 1≤d≤5 → coming_up · d=0 → due_today · d<0 → overdue.
 * A delivered campaign short-circuits to `delivered`.
 */
export type DeadlineState = 'on_track' | 'coming_up' | 'due_today' | 'overdue' | 'delivered';

function daysBetween(today: IsoDate, deadline: IsoDate): number {
  return Math.round(istDate(deadline).diff(istDate(today), 'days').days);
}

export function deadlineState(
  deadline: IsoDate,
  today: IsoDate,
  status: CampaignStatus,
): DeadlineState {
  if (status === 'delivered') return 'delivered';
  const d = daysBetween(today, deadline);
  if (d < 0) return 'overdue';
  if (d === 0) return 'due_today';
  if (d <= CAMPAIGN_COMING_UP_DAYS) return 'coming_up';
  return 'on_track';
}

/** The 4-value UI accent indicator (a delivered campaign shows the calm on-track accent). */
export function deadlineIndicator(
  deadline: IsoDate,
  today: IsoDate,
  status: CampaignStatus,
): CampaignDeadlineIndicator {
  const state = deadlineState(deadline, today, status);
  return state === 'delivered' ? 'on_track' : state;
}

/** True when a non-delivered campaign is past its deadline (drives the overdue flag + notify). */
export function isOverdue(deadline: IsoDate, today: IsoDate, status: CampaignStatus): boolean {
  return status !== 'delivered' && istDate(deadline) < istDate(today);
}

/** Whether a delivery met the deadline (feeds the leaderboard campaign factor). */
export function deliveredOnTime(deadline: IsoDate, deliveredOn: IsoDate): boolean {
  return istDate(deliveredOn) <= istDate(deadline);
}
