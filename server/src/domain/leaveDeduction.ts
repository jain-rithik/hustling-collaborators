import { type EmploymentType, FT_ADVANCE_CAP_DAYS } from '@hc/shared';
import { round2 } from './util.js';

/**
 * Leave priority ordering & deduction (domain-rules §9 / PRD §9.4.5).
 * Order: comp-off first → PL → (optional advance PL) → LWP.
 *
 * Normative refinements over the looser PRD prose:
 *  - Comp-off is INDIVISIBLE (whole-day only): it covers only floor(days). A lone 0.5-day
 *    leave therefore draws on PL, preserving comp-off (domain-rules §9.2 / E20).
 *  - Advance PL is OPT-IN. A plain approval (allowAdvance:false) sends the remainder after
 *    comp-off + PL straight to LWP. Advance is only used when explicitly requested and
 *    gated by advanceCapOk (domain-rules §9.2). Interns have no advance facility.
 */
export interface LeaveBalances {
  compOff: number;
  pl: number;
}

export interface DeductionOpts {
  allowAdvance?: boolean;
  /** Max advance days (full-time = 5, intern = 0). */
  advanceCap?: number;
}

export interface LeaveSplit {
  fromCompOff: number;
  fromPl: number;
  /** PL taken beyond the current balance (tracked advance-leave debt). */
  fromAdvance: number;
  fromLwp: number;
}

export function applyLeaveDeduction(
  days: number,
  state: LeaveBalances,
  opts: DeductionOpts = {},
): LeaveSplit {
  const allowAdvance = opts.allowAdvance ?? false;
  const advanceCap = opts.advanceCap ?? FT_ADVANCE_CAP_DAYS;

  const wholeDays = Math.floor(days);

  // Comp-off is indivisible — it covers only the whole-day portion.
  const fromCompOff = Math.min(wholeDays, Math.max(state.compOff, 0));
  let remaining = round2(days - fromCompOff);

  const fromPl = Math.min(remaining, Math.max(state.pl, 0));
  remaining = round2(remaining - fromPl);

  const fromAdvance = allowAdvance ? Math.min(remaining, Math.max(advanceCap, 0)) : 0;
  remaining = round2(remaining - fromAdvance);

  const fromLwp = remaining;

  return {
    fromCompOff: round2(fromCompOff),
    fromPl: round2(fromPl),
    fromAdvance: round2(fromAdvance),
    fromLwp: round2(fromLwp),
  };
}

/** Whether a request stays within the allowed advance window (domain-rules §9.1). */
export function advanceCapOk(
  currentPl: number,
  requestedDays: number,
  type: EmploymentType,
): boolean {
  const cap = type === 'full_time' ? FT_ADVANCE_CAP_DAYS : 0;
  return requestedDays <= Math.max(currentPl, 0) + cap;
}
