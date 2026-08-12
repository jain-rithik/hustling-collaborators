import { DateTime } from 'luxon';
import {
  IST_TZ,
  LONG_LEAVE_ADVANCE_DAYS,
  LONG_LEAVE_CONSECUTIVE_DAYS,
  PL_ADVANCE_DAYS,
  SICK_LEAVE_CUTOFF,
  WFH_ADVANCE_HOURS,
} from '@hc/shared';
import { hhmmToSeconds } from './time/ist.js';

/**
 * Leave-request timing rules (v2 change log §05). Pure functions — the caller injects `now`
 * (IST) and IST calendar-date strings so the whole set stays clock-free and testable.
 */

/** Whole IST calendar days from `todayIso` to `startIso`. Same day = 0, tomorrow = 1, yesterday = -1. */
export function calendarDaysUntil(startIso: string, todayIso: string): number {
  const from = DateTime.fromISO(todayIso, { zone: IST_TZ }).startOf('day');
  const to = DateTime.fromISO(startIso, { zone: IST_TZ }).startOf('day');
  return Math.round(to.diff(from, 'days').days);
}

/** Paid leave applied fewer than PL_ADVANCE_DAYS calendar days ahead must instead be taken as LWP. */
export function plWithinAdvanceWindow(startIso: string, todayIso: string): boolean {
  return calendarDaysUntil(startIso, todayIso) < PL_ADVANCE_DAYS;
}

/** A leave spanning more than N consecutive days is a "long" leave needing extra advance notice. */
export function isLongLeave(days: number): boolean {
  return days > LONG_LEAVE_CONSECUTIVE_DAYS;
}

/** A long leave requested inside LONG_LEAVE_ADVANCE_DAYS of its start is routed to Admin for review. */
export function longLeaveNeedsReview(startIso: string, todayIso: string): boolean {
  return calendarDaysUntil(startIso, todayIso) < LONG_LEAVE_ADVANCE_DAYS;
}

/** A WFH request must be raised at least WFH_ADVANCE_HOURS before IST start-of-day of the requested date. */
export function wfhTooSoon(startIso: string, now: DateTime): boolean {
  const start = DateTime.fromISO(startIso, { zone: IST_TZ }).startOf('day');
  const hours = start.diff(now.setZone(IST_TZ), 'hours').hours;
  return hours < WFH_ADVANCE_HOURS;
}

/** True when `now` (IST) is past the sick-leave cutoff time (e.g. 09:30) — a same-day sick req then becomes LWP. */
export function sickLeaveAfterCutoff(now: DateTime): boolean {
  const ist = now.setZone(IST_TZ);
  const secondsOfDay = ist.hour * 3600 + ist.minute * 60 + ist.second;
  return secondsOfDay > hhmmToSeconds(SICK_LEAVE_CUTOFF);
}

/**
 * A same-day sick-leave request submitted after the cutoff must be marked LWP. Future-dated sick
 * leave is unaffected by the cutoff (only the same-day case is time-boxed).
 */
export function sickLeaveBecomesLwp(startIso: string, todayIso: string, now: DateTime): boolean {
  return startIso === todayIso && sickLeaveAfterCutoff(now);
}
