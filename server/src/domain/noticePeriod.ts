import { SEPARATION_CLAWBACK_DAY } from '@hc/shared';
import { type IsoDate, istDate } from './time/ist.js';

/**
 * Notice period (v4 change log).
 *
 * A month's leave credit assumes the member is present for more than half of it. So:
 *  • Notice starting ON OR BEFORE the 15th → that month's Privilege + Sick credit was never
 *    really earned. It is reversed, and leave taken against it is Leave Without Pay.
 *  • Notice starting AFTER the 15th → the credit stands and the leave stays paid.
 *
 * Separately, while a member is serving notice at all, every leave they raise is approved as
 * Leave Without Pay — the app tells them so before they submit.
 */

/** True when the member is serving notice on `asOf` (inclusive of both boundary dates). */
export function isServingNotice(
  noticeStartDate: IsoDate | null | undefined,
  noticeLastDate: IsoDate | null | undefined,
  asOf: IsoDate,
): boolean {
  if (!noticeStartDate) return false;
  if (asOf < noticeStartDate) return false;
  if (noticeLastDate && asOf > noticeLastDate) return false;
  return true;
}

/**
 * True when the leave credit for the month notice began in is unpaid — i.e. notice started on
 * or before the 15th, so the member will not have completed more than 15 days that month.
 */
export function noticeMonthAccrualIsUnpaid(noticeStartDate: IsoDate): boolean {
  return istDate(noticeStartDate).day <= SEPARATION_CLAWBACK_DAY;
}

/** The 1st of the month notice began in — the effective date of the reversing ledger entry. */
export function noticeMonthStart(noticeStartDate: IsoDate): IsoDate {
  return istDate(noticeStartDate).startOf('month').toISODate()!;
}
