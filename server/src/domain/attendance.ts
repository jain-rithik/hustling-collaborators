import { DateTime } from 'luxon';
import { IST_TZ, type AttendanceStatus, type DayType } from '@hc/shared';
import { GRACE_CUTOFF_SECONDS } from './time/ist.js';
import { qualifiesAsHalfDay } from './halfDay.js';

/**
 * Lateness (domain-rules §4.1 / PRD §9.1). On or before 10:45:00 IST = on-time; strictly
 * after = late. Applies only to office days; WFH/off days have no lateness rule.
 */
export function classifyCheckIn(checkInAt: DateTime): { isLate: boolean } {
  const ist = checkInAt.setZone(IST_TZ);
  const secondsOfDay = ist.hour * 3600 + ist.minute * 60 + ist.second;
  return { isLate: secondsOfDay > GRACE_CUTOFF_SECONDS };
}

export interface DeriveStatusInput {
  dayType: DayType;
  /** Full-day leave approved for this date. */
  onApprovedLeave: boolean;
  /** An approved half-day leave for this date. */
  isHalfDayLeave: boolean;
  checkedIn: boolean;
  wfhConfirmed: boolean;
  /** From classifyCheckIn (office days only). */
  isLate: boolean;
  /** Logged focus minutes that day (for half-day qualification). */
  productiveMinutes: number;
}

/**
 * Map a day's facts to a single attendance status (domain-rules §4.2 / PRD §4.2, §9).
 * Precedence: approved leave → mandatory holiday → weekend-off → working-day resolution.
 */
export function deriveStatus(i: DeriveStatusInput): AttendanceStatus {
  if (i.onApprovedLeave) return 'on_leave';
  if (i.dayType === 'mandatory_holiday') return 'holiday';
  if (i.dayType === 'sunday' || i.dayType === 'fourth_saturday') return 'weekend_off';

  // Working day: office, second_saturday (WFH), or an unclaimed optional_holiday / birthday.
  if (i.isHalfDayLeave) {
    // A half-day qualifies only with ≥4h logged; otherwise it becomes a full-day leave.
    return qualifiesAsHalfDay(i.productiveMinutes) ? 'half_day' : 'on_leave';
  }

  if (i.dayType === 'second_saturday' || i.dayType === 'wfh') {
    return i.wfhConfirmed ? 'wfh' : 'absent';
  }

  // Office (unclaimed optional_holiday / birthday resolve as office too).
  if (!i.checkedIn) return 'absent';
  return i.isLate ? 'late' : 'present';
}
