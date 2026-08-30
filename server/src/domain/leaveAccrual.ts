import {
  type EmploymentType,
  type EntitlementLeaveType,
  type LedgerEntryType,
  ACCRUAL_GRANULARITY,
  FT_ANNUAL_PL,
  FT_ANNUAL_SICK,
  FT_PROBATION_MONTHS,
  FY_START_MONTH,
  INTERN_LEAVE_CAP,
  INTERN_MONTHLY_ACCRUAL,
  INTERN_PROBATION_MONTHS,
  MONTHS_PER_YEAR,
} from '@hc/shared';
import { type IsoDate, istDate, toIsoDate } from './time/ist.js';
import { employmentMonthIndex } from './time/fy.js';
import { floorToStep, round2 } from './util.js';

/**
 * Leave accrual (v4 change log).
 *
 * Full-time — 11 Privilege + 7 Sick per financial year, held as two separate pools and both
 * earned PRORATA: after m months of the FY you hold floor-to-half(annual × m ÷ 12), so six
 * months in you have 5.5 Privilege and 3.5 Sick, and by 31 March exactly 11 and 7. Unused
 * balance lapses at the FY boundary (no carry-forward).
 *
 * Intern — 4 leaves in total, +1 at the start of every month from the month they join. Three
 * by the start of month 3, the fourth at the start of month 4. Privilege and Sick share this
 * ONE pool, so the intern's Sick Leave draws on the same 4 as their Privilege Leave.
 *
 * Leave is EARNED from month 1 in both cases; probation restricts USING it, not earning it
 * (see `probationBlocksPaidLeave`). The joining calendar month counts as month 1.
 */

export interface AccrualEntry {
  effectiveDate: IsoDate;
  entryType: LedgerEntryType; // 'opening' | 'accrual' | 'expiry'
  /** Which entitlement pool the entry lands in. Interns only ever use 'pl' (the shared pool). */
  leaveType: EntitlementLeaveType;
  amount: number; // signed
  /** Running balance of THAT pool across the accrual sequence only (deductions post separately). */
  balanceAfter: number;
  note: string;
}

export interface Entitlement {
  /** Annual Privilege entitlement — for an intern this is the shared Privilege+Sick pool. */
  pl: number;
  /** Annual Sick entitlement. 0 for an intern, whose sick leave draws on the shared pool. */
  sick: number;
  /** True when one pool covers both Privilege and Sick (interns). */
  shared: boolean;
  /** Full-time entitlements reset each financial year; the intern pool is lifetime. */
  resetsEachFy: boolean;
}

export function entitlementFor(type: EmploymentType): Entitlement {
  return type === 'full_time'
    ? { pl: FT_ANNUAL_PL, sick: FT_ANNUAL_SICK, shared: false, resetsEachFy: true }
    : { pl: INTERN_LEAVE_CAP, sick: 0, shared: true, resetsEachFy: false };
}

/** The pool a leave type draws on. Intern sick leave draws on the shared Privilege pool. */
export function poolFor(leaveType: EntitlementLeaveType, type: EmploymentType): EntitlementLeaveType {
  return entitlementFor(type).shared ? 'pl' : leaveType;
}

export function probationMonths(type: EmploymentType): number {
  return type === 'full_time' ? FT_PROBATION_MONTHS : INTERN_PROBATION_MONTHS;
}

/** Last day of probation — 3 whole months for full-time, 2 for an intern, from the joining month. */
export function probationEndDate(joining: IsoDate, type: EmploymentType): IsoDate {
  const j = istDate(joining).startOf('month');
  return toIsoDate(j.plus({ months: probationMonths(type) }).minus({ days: 1 }));
}

/**
 * Paid leave (Privilege, Sick, Bereavement, Optional Holiday) may only be USED once probation
 * is over. A leave that starts on or before the probation end date is Leave Without Pay.
 */
export function probationBlocksPaidLeave(probationEnd: IsoDate | null | undefined, startIso: IsoDate): boolean {
  return !!probationEnd && startIso <= probationEnd;
}

/** How much of an annual entitlement is earned after `monthsElapsed` months of the year. */
export function prorataEarned(annual: number, monthsElapsed: number): number {
  if (monthsElapsed <= 0) return 0;
  if (monthsElapsed >= MONTHS_PER_YEAR) return round2(annual);
  return floorToStep((annual * monthsElapsed) / MONTHS_PER_YEAR, ACCRUAL_GRANULARITY);
}

/**
 * Every accrual / expiry entry from joining up to and including the month of `upTo`.
 * Deterministic and idempotent by design — the monthly job diffs this against the ledger and
 * posts only what is missing, so accrual is self-healing (architecture §9.1 / R1).
 */
export function monthlyAccrualSchedule(
  joining: IsoDate,
  type: EmploymentType,
  upTo: IsoDate,
): AccrualEntry[] {
  return type === 'full_time'
    ? fullTimeSchedule(joining, upTo)
    : internSchedule(joining, upTo);
}

function fullTimeSchedule(joining: IsoDate, upTo: IsoDate): AccrualEntry[] {
  const entries: AccrualEntry[] = [];
  const balance: Record<EntitlementLeaveType, number> = { pl: 0, sick: 0 };
  const earned: Record<EntitlementLeaveType, number> = { pl: 0, sick: 0 };
  const annual: Record<EntitlementLeaveType, number> = { pl: FT_ANNUAL_PL, sick: FT_ANNUAL_SICK };

  const joinMonth = istDate(joining).startOf('month');
  const end = istDate(upTo).startOf('month');
  let m = joinMonth;
  let first = true;
  let fyMonths = 0; // months of the current FY the member has been employed for, incl. this one

  while (m <= end) {
    const monthIso = toIsoDate(m);
    // 1 April: last year's unused balance lapses and the prorata clock restarts.
    if (m.month === FY_START_MONTH && !first) {
      for (const pool of ['pl', 'sick'] as const) {
        if (balance[pool] > 0) {
          entries.push({
            effectiveDate: monthIso,
            entryType: 'expiry',
            leaveType: pool,
            amount: round2(-balance[pool]),
            balanceAfter: 0,
            note: 'Unused leave lapsed at financial year end (no carry-forward)',
          });
          balance[pool] = 0;
        }
        earned[pool] = 0;
      }
      fyMonths = 0;
    }
    fyMonths += 1;

    for (const pool of ['pl', 'sick'] as const) {
      const target = prorataEarned(annual[pool], fyMonths);
      const credit = round2(target - earned[pool]);
      if (credit > 0) {
        earned[pool] = target;
        balance[pool] = round2(balance[pool] + credit);
        entries.push({
          effectiveDate: monthIso,
          entryType: first ? 'opening' : 'accrual',
          leaveType: pool,
          amount: credit,
          balanceAfter: balance[pool],
          note: first ? 'Opening leave balance on joining' : 'Monthly leave accrual (prorata)',
        });
      }
    }

    first = false;
    m = m.plus({ months: 1 });
  }

  return entries;
}

function internSchedule(joining: IsoDate, upTo: IsoDate): AccrualEntry[] {
  const entries: AccrualEntry[] = [];
  let balance = 0;
  const end = istDate(upTo).startOf('month');
  let m = istDate(joining).startOf('month');

  while (m <= end) {
    const monthIso = toIsoDate(m);
    const idx = employmentMonthIndex(joining, monthIso);
    const credit = round2(Math.min(INTERN_MONTHLY_ACCRUAL, INTERN_LEAVE_CAP - balance));
    if (credit > 0) {
      balance = round2(balance + credit);
      entries.push({
        effectiveDate: monthIso,
        entryType: idx === 1 ? 'opening' : 'accrual',
        leaveType: 'pl',
        amount: credit,
        balanceAfter: balance,
        note:
          idx === 1
            ? 'Opening leave balance on joining'
            : 'Monthly leave accrual (Privilege + Sick share one pool)',
      });
    }
    m = m.plus({ months: 1 });
  }

  return entries;
}

/** Sum ledger entries to a balance (accruals − deductions + adjustments…). */
export function computeBalance(entries: { amount: number }[]): number {
  return round2(entries.reduce((sum, e) => sum + e.amount, 0));
}

/** Accrued balance per pool (accrual side only) as of a date. */
export function accruedBalance(
  joining: IsoDate,
  type: EmploymentType,
  asOf: IsoDate,
): Record<EntitlementLeaveType, number> {
  const schedule = monthlyAccrualSchedule(joining, type, asOf);
  return {
    pl: computeBalance(schedule.filter((e) => e.leaveType === 'pl')),
    sick: computeBalance(schedule.filter((e) => e.leaveType === 'sick')),
  };
}
