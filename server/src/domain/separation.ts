import { SEPARATION_CLAWBACK_DAY } from '@hc/shared';
import { type IsoDate, istDate } from './time/ist.js';
import { round2 } from './util.js';

/**
 * Mid-Month Separation — Leave Accrual Reversal (domain-rules §11 / PRD §9.7, v4 change log).
 *
 * A month's leave credit presumes active employment through the 15th. Last working day on or
 * before the 15th → that month's credit is NOT earned (reversed); any leave already used from
 * it retro-converts to LWP (deducted in F&F). Last working day after the 15th → the credit
 * stands regardless of usage. The 15th itself is "on or before" → clawed back. Applies
 * uniformly to resignation and termination; only the separation month is in scope.
 *
 * Since v4 the credit is prorata rather than a flat 1.5 days, so the caller passes the amount
 * actually posted that month (Privilege + Sick combined, or per pool).
 */
export interface ClawbackInput {
  /** Actual last working day (after notice served/waived), IST. */
  lastWorkingDay: IsoDate;
  /** The 1st of the month whose credit is under review. */
  monthCreditDate: IsoDate;
  /** Days already taken against that specific month's credit. */
  usedFromThatCredit: number;
  /** The credit actually posted for that month. */
  creditPosted: number;
}

export interface ClawbackResult {
  clawback: boolean;
  /** Days converted to LWP (deducted in F&F). */
  lwpConverted: number;
  /** The credit reversed from the ledger (0, or the whole month's posted credit). */
  creditReversed: number;
}

export function midMonthClawback(input: ClawbackInput): ClawbackResult {
  const clawback = istDate(input.lastWorkingDay).day <= SEPARATION_CLAWBACK_DAY;
  return {
    clawback,
    lwpConverted: clawback ? round2(input.usedFromThatCredit) : 0,
    creditReversed: clawback ? round2(input.creditPosted) : 0,
  };
}
