import { DateTime } from 'luxon';
import { FY_START_MONTH } from '@hc/shared';
import { type IsoDate, istDate, toIsoDate } from './ist.js';

/** Financial-year math (1 April – 31 March). */

export interface FinancialYear {
  fyStart: IsoDate;
  fyEnd: IsoDate;
  /** e.g. '2026-27'. */
  label: string;
}

export function financialYear(iso: IsoDate): FinancialYear {
  const d = istDate(iso);
  const startYear = d.month >= FY_START_MONTH ? d.year : d.year - 1;
  const fyStart = DateTime.fromObject(
    { year: startYear, month: FY_START_MONTH, day: 1 },
    { zone: d.zone },
  );
  const fyEnd = fyStart.plus({ years: 1 }).minus({ days: 1 });
  return {
    fyStart: toIsoDate(fyStart),
    fyEnd: toIsoDate(fyEnd),
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`,
  };
}

/** 31 March of the FY that `iso` falls in — a comp-off credit's expiry (PRD §9.4 step 6). */
export function fyEndFor(iso: IsoDate): IsoDate {
  return financialYear(iso).fyEnd;
}

/**
 * Employment month index (1-based), counting the joining calendar month as month 1 regardless
 * of day-of-month (domain-rules §2.4 / A3 — a 1-May joiner reaches month 4 on 1-Aug).
 */
export function employmentMonthIndex(joining: IsoDate, asOf: IsoDate): number {
  const j = istDate(joining);
  const a = istDate(asOf);
  return (a.year - j.year) * 12 + (a.month - j.month) + 1;
}

/** Back-compat alias. */
export const tenureMonthIndex = employmentMonthIndex;

/** Whole calendar months elapsed since joining (domain-rules §2.4). */
export function completedMonthsSince(joining: IsoDate, asOf: IsoDate): number {
  const j = istDate(joining);
  const a = istDate(asOf);
  let months = (a.year - j.year) * 12 + (a.month - j.month);
  if (a.day < j.day) months -= 1;
  return Math.max(0, months);
}
