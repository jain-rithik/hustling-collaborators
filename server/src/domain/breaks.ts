import type { DateTime } from 'luxon';
import {
  type BreakType,
  LUNCH_EMPLOYEE_ALERT_MINUTES,
  LUNCH_MANAGER_ALERT_MINUTES,
  TEA_MANAGER_ALERT_MINUTES,
} from '@hc/shared';

/**
 * Break-duration thresholds (v2 change log §02 / §07). Timestamps only — the employee never sees
 * a timer. Managers are silently alerted first (lunch 45m / tea 15m); the employee gets a visible
 * popup later (lunch 55m), leaving a window before they are prompted to return.
 */

export function breakElapsedMinutes(startedAt: DateTime, now: DateTime): number {
  return Math.max(0, Math.floor(now.diff(startedAt, 'minutes').minutes));
}

/** Minutes after which the manager/admin is silently notified, per break type. */
export function managerAlertThreshold(type: BreakType): number {
  return type === 'lunch' ? LUNCH_MANAGER_ALERT_MINUTES : TEA_MANAGER_ALERT_MINUTES;
}

/** Managers should be silently alerted once the break has run past its type threshold. */
export function managerShouldBeAlerted(type: BreakType, elapsedMinutes: number): boolean {
  return elapsedMinutes >= managerAlertThreshold(type);
}

/** Only a lunch break produces an employee-facing popup, and only past LUNCH_EMPLOYEE_ALERT_MINUTES. */
export function employeeShouldBeAlerted(type: BreakType, elapsedMinutes: number): boolean {
  return type === 'lunch' && elapsedMinutes >= LUNCH_EMPLOYEE_ALERT_MINUTES;
}
