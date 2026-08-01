import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import {
  toIstDateFromInstant,
  toIsoDate,
  istDate,
  istStartOfDay,
  istEndOfDay,
  hhmmToSeconds,
  GRACE_CUTOFF_SECONDS,
} from '../../src/domain/time/ist.js';
import {
  financialYear,
  fyEndFor,
  employmentMonthIndex,
  tenureMonthIndex,
  completedMonthsSince,
} from '../../src/domain/time/fy.js';
import {
  isSunday,
  isSaturday,
  isSecondSaturday,
  isFourthSaturday,
  nthWeekdayOfMonth,
} from '../../src/domain/time/weekday.js';

describe('ist', () => {
  it('resolves the IST business date of a UTC instant (crosses midnight)', () => {
    // 2026-11-08T19:00:00Z = 2026-11-09T00:30 IST → belongs to the 9th
    expect(toIstDateFromInstant(new Date('2026-11-08T19:00:00Z'))).toBe('2026-11-09');
  });

  it('parses HH:mm to seconds and pins the grace cutoff at 10:45:00', () => {
    expect(hhmmToSeconds('10:45')).toBe(38700);
    expect(GRACE_CUTOFF_SECONDS).toBe(38700);
  });

  it('start/end of day and round-trip', () => {
    expect(istStartOfDay('2026-11-09').toFormat('HH:mm:ss')).toBe('00:00:00');
    expect(istEndOfDay('2026-11-09').toFormat('HH:mm:ss.SSS')).toBe('23:59:59.999');
    expect(toIsoDate(istDate('2026-11-09'))).toBe('2026-11-09');
  });

  it('rejects invalid dates loudly', () => {
    expect(() => istDate('not-a-date')).toThrow();
    expect(() => toIsoDate(DateTime.invalid('bad'))).toThrow();
  });
});

describe('financialYear', () => {
  it.each([
    ['2026-08-15', '2026-04-01', '2027-03-31', '2026-27'],
    ['2027-01-05', '2026-04-01', '2027-03-31', '2026-27'],
    ['2027-04-01', '2027-04-01', '2028-03-31', '2027-28'],
    ['2026-03-31', '2025-04-01', '2026-03-31', '2025-26'],
  ])('financialYear(%s)', (iso, start, end, label) => {
    const fy = financialYear(iso);
    expect(fy).toEqual({ fyStart: start, fyEnd: end, label });
  });

  it('fyEndFor gives 31 March of the FY (comp-off expiry)', () => {
    expect(fyEndFor('2026-11-15')).toBe('2027-03-31');
    expect(fyEndFor('2027-02-01')).toBe('2027-03-31');
  });
});

describe('employmentMonthIndex', () => {
  it('counts the joining calendar month as month 1', () => {
    expect(employmentMonthIndex('2026-05-01', '2026-08-01')).toBe(4);
    expect(employmentMonthIndex('2026-04-20', '2026-07-01')).toBe(4);
    expect(employmentMonthIndex('2026-05-15', '2026-05-31')).toBe(1);
    expect(tenureMonthIndex('2026-05-01', '2026-05-01')).toBe(1);
  });

  it('completedMonthsSince counts whole calendar months', () => {
    expect(completedMonthsSince('2026-05-01', '2026-08-01')).toBe(3);
    expect(completedMonthsSince('2026-05-15', '2026-08-14')).toBe(2);
    expect(completedMonthsSince('2026-05-15', '2026-05-20')).toBe(0);
  });
});

describe('weekday helpers (Aug 2026: Saturdays 1,8,15,22,29)', () => {
  it('classifies Saturdays', () => {
    expect(isSaturday('2026-08-08')).toBe(true);
    expect(isSecondSaturday('2026-08-08')).toBe(true);
    expect(isFourthSaturday('2026-08-22')).toBe(true);
    expect(isSecondSaturday('2026-08-15')).toBe(false); // 3rd Saturday
    expect(isFourthSaturday('2026-08-29')).toBe(false); // 5th Saturday
  });

  it('nthWeekdayOfMonth ordinal', () => {
    expect(nthWeekdayOfMonth('2026-08-15')).toEqual({ weekday: 6, ordinal: 3 });
    expect(nthWeekdayOfMonth('2026-08-01')).toEqual({ weekday: 6, ordinal: 1 });
  });

  it('isSunday', () => {
    expect(isSunday('2026-08-02')).toBe(true);
    expect(isSunday('2026-08-03')).toBe(false);
  });

  it('grace cutoff sanity via a real instant', () => {
    // 10:45:00 IST is on-time; 10:45:01 IST is late (checked in attendance.test)
    const t = DateTime.fromObject({ hour: 10, minute: 45, second: 0 }, { zone: IST_TZ });
    expect(t.hour * 3600 + t.minute * 60 + t.second).toBe(GRACE_CUTOFF_SECONDS);
  });
});
