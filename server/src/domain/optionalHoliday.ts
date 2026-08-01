import { OPTIONAL_HOLIDAY_CAP_PER_FY } from '@hc/shared';
import { type IsoDate, istDate } from './time/ist.js';

/**
 * Optional-holiday & birthday entitlement (domain-rules §15 / PRD §9.1).
 * Up to 2 optional holidays per FY, plus 1 additional birthday day. Claiming either deducts
 * NOTHING from PL/comp-off — it only decrements the FY allowance counter.
 */
export function canClaimOptionalHoliday(fyClaimsUsed: number): boolean {
  return fyClaimsUsed < OPTIONAL_HOLIDAY_CAP_PER_FY;
}

export function canClaimBirthday(fyBirthdayUsed: number, day: IsoDate, dob: IsoDate): boolean {
  if (fyBirthdayUsed >= 1) return false;
  const d = istDate(day);
  const b = istDate(dob);
  if (d.month === b.month && d.day === b.day) return true;
  // 29-Feb birthday observed on 28-Feb in non-leap years.
  return b.month === 2 && b.day === 29 && d.month === 2 && d.day === 28 && !d.isInLeapYear;
}
