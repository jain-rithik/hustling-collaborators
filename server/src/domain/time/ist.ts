import { DateTime } from 'luxon';
import { IST_TZ, GRACE_CUTOFF } from '@hc/shared';

/**
 * IST time primitives. Everything "day / month / before 10:45 / FY" is computed in
 * Asia/Kolkata. Instants are UTC; business dates are IST calendar dates as 'YYYY-MM-DD'.
 * These functions are PURE — no wall-clock reads (callers inject `now`).
 */

/** An IST calendar date in 'YYYY-MM-DD' form. */
export type IsoDate = string;

/** Parse an IST date string to a Luxon DateTime at IST start-of-day. */
export function istDate(iso: IsoDate): DateTime {
  const dt = DateTime.fromISO(iso, { zone: IST_TZ }).startOf('day');
  if (!dt.isValid) throw new Error(`invalid IST date: ${iso}`);
  return dt;
}

/** Format a DateTime as its IST calendar date. */
export function toIsoDate(dt: DateTime): IsoDate {
  const iso = dt.setZone(IST_TZ).toISODate();
  if (!iso) throw new Error('invalid DateTime');
  return iso;
}

/** The IST calendar date of a UTC instant (architecture §8.1 — server computes, never trusts client). */
export function toIstDateFromInstant(instant: Date): IsoDate {
  return toIsoDate(DateTime.fromJSDate(instant, { zone: IST_TZ }));
}

export function istStartOfDay(iso: IsoDate): DateTime {
  return istDate(iso);
}

export function istEndOfDay(iso: IsoDate): DateTime {
  return istDate(iso).endOf('day');
}

/** Seconds-of-day for an 'HH:mm' constant (e.g. GRACE_CUTOFF → 38700). */
export function hhmmToSeconds(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60;
}

export const GRACE_CUTOFF_SECONDS = hhmmToSeconds(GRACE_CUTOFF);
