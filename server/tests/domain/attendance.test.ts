import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import { classifyCheckIn, deriveStatus } from '../../src/domain/attendance.js';

const at = (hms: string) => DateTime.fromISO(`2026-11-10T${hms}`, { zone: IST_TZ });

describe('classifyCheckIn — grace boundary (domain-rules §4.1, E14)', () => {
  it.each([
    ['10:30:00', false],
    ['10:44:59', false],
    ['10:45:00', false], // grace inclusive
    ['10:45:01', true],
    ['10:46:00', true],
    ['11:15:00', true],
  ])('check-in at %s → isLate=%s', (hms, expected) => {
    expect(classifyCheckIn(at(hms)).isLate).toBe(expected);
  });

  it('is correct even when the instant is expressed in UTC', () => {
    // 05:15:01Z = 10:45:01 IST → late
    expect(classifyCheckIn(DateTime.fromISO('2026-11-10T05:15:01Z')).isLate).toBe(true);
    // 05:15:00Z = 10:45:00 IST → on-time
    expect(classifyCheckIn(DateTime.fromISO('2026-11-10T05:15:00Z')).isLate).toBe(false);
  });
});

const base = {
  onApprovedLeave: false,
  isHalfDayLeave: false,
  checkedIn: false,
  wfhConfirmed: false,
  isLate: false,
  productiveMinutes: 0,
};

describe('deriveStatus (domain-rules §4.2)', () => {
  it('approved leave wins over everything', () => {
    expect(deriveStatus({ ...base, dayType: 'office', onApprovedLeave: true })).toBe('on_leave');
  });

  it('mandatory holiday → holiday; weekend/4th-sat → weekend_off', () => {
    expect(deriveStatus({ ...base, dayType: 'mandatory_holiday' })).toBe('holiday');
    expect(deriveStatus({ ...base, dayType: 'sunday' })).toBe('weekend_off');
    expect(deriveStatus({ ...base, dayType: 'fourth_saturday' })).toBe('weekend_off');
  });

  it('office: present / late / absent', () => {
    expect(deriveStatus({ ...base, dayType: 'office', checkedIn: true })).toBe('present');
    expect(deriveStatus({ ...base, dayType: 'office', checkedIn: true, isLate: true })).toBe('late');
    expect(deriveStatus({ ...base, dayType: 'office', checkedIn: false })).toBe('absent');
  });

  it('WFH (2nd Saturday): confirmed → wfh, else absent', () => {
    expect(deriveStatus({ ...base, dayType: 'second_saturday', wfhConfirmed: true })).toBe('wfh');
    expect(deriveStatus({ ...base, dayType: 'second_saturday', wfhConfirmed: false })).toBe('absent');
  });

  it('half-day leave: ≥4h logged → half_day, else full-day on_leave (E12/E13)', () => {
    expect(
      deriveStatus({ ...base, dayType: 'office', isHalfDayLeave: true, productiveMinutes: 300 }),
    ).toBe('half_day');
    expect(
      deriveStatus({ ...base, dayType: 'office', isHalfDayLeave: true, productiveMinutes: 180 }),
    ).toBe('on_leave');
    // lateness does not re-penalise a qualifying half-day
    expect(
      deriveStatus({
        ...base,
        dayType: 'office',
        isHalfDayLeave: true,
        productiveMinutes: 240,
        isLate: true,
      }),
    ).toBe('half_day');
  });

  it('unclaimed optional_holiday / birthday resolve as office days', () => {
    expect(deriveStatus({ ...base, dayType: 'optional_holiday', checkedIn: true })).toBe('present');
    expect(deriveStatus({ ...base, dayType: 'birthday', checkedIn: false })).toBe('absent');
  });
});
