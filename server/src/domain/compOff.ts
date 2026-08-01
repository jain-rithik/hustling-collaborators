import type { DateTime } from 'luxon';
import { COMP_OFF_GUIDELINE_MINUTES } from '@hc/shared';
import { type IsoDate, istStartOfDay } from './time/ist.js';
import { fyEndFor } from './time/fy.js';

/** Comp-off lifecycle rules (PRD §9.4). */

/**
 * Step 1 — the pre-approval request MUST be submitted before the off day begins (IST).
 * No retrospective requests (PRD §9.4 step 1). `now` is injected.
 */
export function isPreApprovalValid(now: DateTime, offDate: IsoDate): boolean {
  return now < istStartOfDay(offDate);
}

/**
 * The 6-hour figure is an ADMIN REFERENCE only (PRD §9.4 step 4). This never auto-credits;
 * the admin may even credit slightly under 6h at their discretion.
 */
export function isCompOffEligibleGuideline(loggedMinutes: number): boolean {
  return loggedMinutes >= COMP_OFF_GUIDELINE_MINUTES;
}

/** A credit is valid until 31 March of its FY (PRD §9.4 step 6). */
export function creditExpiry(creditedForDate: IsoDate): IsoDate {
  return fyEndFor(creditedForDate);
}

export interface CompOffCreditRef {
  consumed: boolean;
  expiresOn: IsoDate;
}

/** Available comp-off = unconsumed credits not yet expired as of `asOf` (ISO dates compare lexically). */
export function availableCompOff(credits: CompOffCreditRef[], asOf: IsoDate): number {
  return credits.filter((c) => !c.consumed && c.expiresOn >= asOf).length;
}
