import { systemClock } from './clock.js';
import type { IsoDate } from '../domain/index.js';

/** Today's IST calendar date. The one place services read "today" for the domain layer. */
export function istToday(): IsoDate {
  const iso = systemClock.now().toISODate();
  if (!iso) throw new Error('clock produced an invalid date');
  return iso;
}

/** Convert a Prisma @db.Date value to an IST 'YYYY-MM-DD' string. */
export function dbDateToIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** Convert an IST 'YYYY-MM-DD' string to a @db.Date value (UTC midnight). */
export function isoToDbDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}
