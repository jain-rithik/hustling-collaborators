import { type AttendanceStatus, HALF_DAY_MINUTES } from '@hc/shared';

/**
 * Half-day rule (domain-rules §5 / PRD §9.3). A day intended as a half-day qualifies only
 * with ≥ 4 productive hours (240 min) of logged task time (our decision: "productive hours"
 * = logged Start→Done task time, the same figure as Focus Time). Below 4h the day is treated
 * as a full day's leave.
 */
export function qualifiesAsHalfDay(productiveMinutes: number): boolean {
  return productiveMinutes >= HALF_DAY_MINUTES;
}

export interface HalfDayOutcome {
  status: AttendanceStatus;
  /** Days charged against leave balances. */
  leaveDaysCharged: number;
}

export function resolveHalfDayOutcome(productiveMinutes: number): HalfDayOutcome {
  return qualifiesAsHalfDay(productiveMinutes)
    ? { status: 'half_day', leaveDaysCharged: 0.5 }
    : { status: 'on_leave', leaveDaysCharged: 1.0 };
}
