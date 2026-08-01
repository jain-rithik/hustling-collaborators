import {
  type EmploymentType,
  type LedgerEntryType,
  FT_ANNUAL_PL,
  FT_MONTHLY_ACCRUAL,
  FT_OPENING_CREDIT,
  FT_OPENING_MONTH_INDEX,
  FT_PROBATION_MONTHS,
  FY_START_MONTH,
  INTERN_MONTHLY_ACCRUAL,
  INTERN_OPENING_CREDIT,
  INTERN_OPENING_MONTH_INDEX,
  INTERN_PL_CAP,
  INTERN_PROBATION_MONTHS,
} from '@hc/shared';
import { type IsoDate, istDate, toIsoDate } from './time/ist.js';
import { tenureMonthIndex } from './time/fy.js';
import { round2 } from './util.js';

/**
 * Leave accrual (PRD §9.5 full-time, §9.6 intern).
 *
 * Full-time: 18 PL/FY, 1.5/month. 3-month probation (LWP only) → a one-time opening credit
 * of 6 at the start of month 4 (= 3 probation months + current month), then +1.5/month,
 * capped at 18 within the FY, no carry-forward (unused lapses at 31 Mar).
 *
 * Intern: up to 4 PL across the 6-month internship. 2-month probation → opening 3 at the
 * start of month 3, then +1/month, capped at 4 (lifetime, no FY reset), lapses at end.
 *
 * The joining month counts as tenure month 1 (a 1-May joiner reaches month 4 on 1-Aug).
 */

export interface AccrualEntry {
  effectiveDate: IsoDate;
  entryType: LedgerEntryType; // 'opening' | 'accrual' | 'expiry'
  amount: number; // signed
  /** Running balance across the accrual sequence ONLY (deductions are posted separately). */
  balanceAfter: number;
  note: string;
}

export function probationEndDate(joining: IsoDate, type: EmploymentType): IsoDate {
  const months = type === 'full_time' ? FT_PROBATION_MONTHS : INTERN_PROBATION_MONTHS;
  const j = istDate(joining).startOf('month');
  return toIsoDate(j.plus({ months }).minus({ days: 1 }));
}

/**
 * Generate every accrual/opening/expiry entry from joining up to and including the month of
 * `upTo`. Deterministic and idempotent by design — the monthly job diffs this against the
 * ledger and posts only the missing entries (self-healing accrual, architecture §9.1/R1).
 */
export function monthlyAccrualSchedule(
  joining: IsoDate,
  type: EmploymentType,
  upTo: IsoDate,
): AccrualEntry[] {
  const entries: AccrualEntry[] = [];
  let balance = 0;
  // Full-time: PL accrued within the current FY (18 cap). Intern: lifetime accrued (4 cap).
  let capAccrued = 0;

  const end = istDate(upTo).startOf('month');
  let m = istDate(joining).startOf('month');
  let firstIteration = true;

  while (m <= end) {
    const monthIso = toIsoDate(m);
    const idx = tenureMonthIndex(joining, monthIso);

    // Full-time FY reset at 1 April: lapse unused PL, reset the 18-day FY cap counter.
    if (type === 'full_time' && m.month === FY_START_MONTH && !firstIteration) {
      if (balance > 0) {
        entries.push({
          effectiveDate: monthIso,
          entryType: 'expiry',
          amount: round2(-balance),
          balanceAfter: 0,
          note: 'Unused PL lapsed at financial year end (no carry-forward)',
        });
        balance = 0;
      }
      capAccrued = 0;
    }

    const { credit, entryType } = monthlyCredit(type, idx, capAccrued);
    if (credit > 0) {
      balance = round2(balance + credit);
      capAccrued = round2(capAccrued + credit);
      entries.push({
        effectiveDate: monthIso,
        entryType,
        amount: credit,
        balanceAfter: balance,
        note:
          entryType === 'opening'
            ? 'Opening leave balance credited after probation'
            : 'Monthly leave accrual',
      });
    }

    firstIteration = false;
    m = m.plus({ months: 1 });
  }

  return entries;
}

function monthlyCredit(
  type: EmploymentType,
  idx: number,
  capAccrued: number,
): { credit: number; entryType: LedgerEntryType } {
  if (type === 'full_time') {
    if (idx < FT_OPENING_MONTH_INDEX) return { credit: 0, entryType: 'accrual' };
    const raw = idx === FT_OPENING_MONTH_INDEX ? FT_OPENING_CREDIT : FT_MONTHLY_ACCRUAL;
    const entryType: LedgerEntryType = idx === FT_OPENING_MONTH_INDEX ? 'opening' : 'accrual';
    return { credit: round2(Math.min(raw, FT_ANNUAL_PL - capAccrued)), entryType };
  }
  // intern
  if (idx < INTERN_OPENING_MONTH_INDEX) return { credit: 0, entryType: 'accrual' };
  const raw = idx === INTERN_OPENING_MONTH_INDEX ? INTERN_OPENING_CREDIT : INTERN_MONTHLY_ACCRUAL;
  const entryType: LedgerEntryType = idx === INTERN_OPENING_MONTH_INDEX ? 'opening' : 'accrual';
  return { credit: round2(Math.min(raw, INTERN_PL_CAP - capAccrued)), entryType };
}

/** Sum any ledger entries to the current balance (accruals − deductions + adjustments…). */
export function computeBalance(entries: { amount: number }[]): number {
  return round2(entries.reduce((sum, e) => sum + e.amount, 0));
}

/** Convenience: accrued PL balance (accrual side only) as of a date. */
export function accruedBalance(joining: IsoDate, type: EmploymentType, asOf: IsoDate): number {
  return computeBalance(monthlyAccrualSchedule(joining, type, asOf));
}
