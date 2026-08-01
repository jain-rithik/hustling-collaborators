import type { DayType } from '@hc/shared';
import { type IsoDate, istDate } from './time/ist.js';
import { isFourthSaturday, isSecondSaturday, isSunday } from './time/weekday.js';

/**
 * Resolve how a date is classified for a given employee (domain-rules §3 / PRD §9.1 / §10).
 *
 * Precedence (first match wins — normative order from domain-rules §3.1):
 *   1. mandatory_holiday   (company-wide, unconditional — beats everything)
 *   2. birthday            (member's DOB — the label they see should say "birthday")
 *   3. optional_holiday    (an optional company holiday)
 *   4. sunday              (off)
 *   5. fourth_saturday     (off)
 *   6. second_saturday     (WFH)
 *   7. office              (a normal working day — incl. 1st/3rd/5th Saturdays: 6-day week)
 */
export interface HolidayRef {
  day: IsoDate;
  /** 'mandatory_holiday' | 'optional_holiday' */
  type: DayType;
}

export interface DayTypeContext {
  holidays: HolidayRef[];
  /** Employee date of birth 'YYYY-MM-DD' (nullable). */
  dob?: IsoDate | null;
}

function matchesBirthday(iso: IsoDate, dob: IsoDate): boolean {
  const d = istDate(iso);
  const b = istDate(dob);
  if (d.month === b.month && d.day === b.day) return true;
  // A 29-Feb birthday is observed on 28-Feb in non-leap years (documented assumption).
  if (b.month === 2 && b.day === 29 && d.month === 2 && d.day === 28 && !d.isInLeapYear) return true;
  return false;
}

export function resolveDayType(iso: IsoDate, ctx: DayTypeContext): DayType {
  if (ctx.holidays.some((h) => h.day === iso && h.type === 'mandatory_holiday')) {
    return 'mandatory_holiday';
  }
  if (ctx.dob && matchesBirthday(iso, ctx.dob)) return 'birthday';
  if (ctx.holidays.some((h) => h.day === iso && h.type === 'optional_holiday')) {
    return 'optional_holiday';
  }
  if (isSunday(iso)) return 'sunday';
  if (isFourthSaturday(iso)) return 'fourth_saturday';
  if (isSecondSaturday(iso)) return 'second_saturday';
  return 'office';
}

/**
 * Working-day predicate (domain-rules §3.2). office + WFH are worked. An UNCLAIMED
 * optional_holiday/birthday is a normal working day (returns true); it only becomes off when
 * the member has an approved claim for it (handled at the service/leave layer, not here).
 */
const OFF_DAY_TYPES: readonly DayType[] = [
  'sunday',
  'fourth_saturday',
  'mandatory_holiday',
];

export function isWorkingDay(dayType: DayType): boolean {
  return !OFF_DAY_TYPES.includes(dayType);
}
