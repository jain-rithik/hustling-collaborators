import { FT_MONTHLY_ACCRUAL, SEPARATION_CLAWBACK_DAY } from '@hc/shared';
import { type IsoDate, istDate } from './time/ist.js';

/**
 * Mid-Month Separation — Leave Accrual Reversal (domain-rules §11 / PRD §9.7).
 *
 * The 1.5-day monthly credit presumes active employment through the 15th. Last working day
 * on or before the 15th → that month's credit is NOT earned (reversed); any leave already
 * used from it retro-converts to LWP (deducted in F&F). Last working day after the 15th →
 * the credit stands regardless of usage. The 15th itself is "on or before" → clawed back.
 * Applies uniformly to resignation and termination; only the separation month is in scope.
 */
export interface ClawbackInput {
  /** Actual last working day (after notice served/waived), IST. */
  lastWorkingDay: IsoDate;
  /** The 1st of the month whose 1.5-day credit is under review. */
  monthCreditDate: IsoDate;
  /** Days already taken against that specific month's credit. */
  usedFromThatCredit: number;
}

export interface ClawbackResult {
  clawback: boolean;
  /** Days converted to LWP (deducted in F&F). */
  lwpConverted: number;
  /** The credit reversed from the ledger (0 or 1.5). */
  creditReversed: number;
}

export function midMonthClawback(input: ClawbackInput): ClawbackResult {
  const clawback = istDate(input.lastWorkingDay).day <= SEPARATION_CLAWBACK_DAY;
  return {
    clawback,
    lwpConverted: clawback ? input.usedFromThatCredit : 0,
    creditReversed: clawback ? FT_MONTHLY_ACCRUAL : 0,
  };
}
