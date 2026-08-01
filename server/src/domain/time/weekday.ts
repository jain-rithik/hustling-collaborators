import { type IsoDate, istDate } from './ist.js';

/** Weekday helpers. Luxon weekday: 1=Monday … 6=Saturday, 7=Sunday. */

export interface NthWeekday {
  /** 1=Mon … 7=Sun */
  weekday: number;
  /** 1 = the 1st of that weekday in the month, 2 = 2nd, etc. */
  ordinal: number;
}

export function nthWeekdayOfMonth(iso: IsoDate): NthWeekday {
  const d = istDate(iso);
  return { weekday: d.weekday, ordinal: Math.floor((d.day - 1) / 7) + 1 };
}

export function isSunday(iso: IsoDate): boolean {
  return istDate(iso).weekday === 7;
}

export function isSaturday(iso: IsoDate): boolean {
  return istDate(iso).weekday === 6;
}

/** 2nd Saturday → WFH day (PRD §9.1). */
export function isSecondSaturday(iso: IsoDate): boolean {
  const n = nthWeekdayOfMonth(iso);
  return n.weekday === 6 && n.ordinal === 2;
}

/** 4th Saturday → off day (PRD §9.1). */
export function isFourthSaturday(iso: IsoDate): boolean {
  const n = nthWeekdayOfMonth(iso);
  return n.weekday === 6 && n.ordinal === 4;
}
