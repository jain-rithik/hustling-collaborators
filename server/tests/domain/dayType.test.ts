import { describe, expect, it } from 'vitest';
import { isWorkingDay, resolveDayType } from '../../src/domain/dayType.js';
import { FY2627_HOLIDAYS } from './fixtures.js';

const ctx = (dob?: string) => ({ holidays: FY2627_HOLIDAYS, dob });

describe('resolveDayType — canonical fixtures (domain-rules §3.3)', () => {
  it.each([
    ['2026-11-09', 'mandatory_holiday'], // Diwali (Mon)
    ['2026-08-15', 'mandatory_holiday'], // Independence Day; 3rd Sat, mandatory overrides
    ['2026-08-08', 'second_saturday'], // 2nd Sat → WFH
    ['2026-08-22', 'fourth_saturday'], // 4th Sat → off
    ['2026-08-01', 'office'], // 1st Sat → working
    ['2026-08-29', 'office'], // 5th Sat → working
    ['2026-04-03', 'optional_holiday'], // Good Friday, unclaimed
    ['2026-08-02', 'sunday'],
    ['2026-11-10', 'office'], // ordinary Tuesday
  ])('resolveDayType(%s) → %s', (iso, expected) => {
    expect(resolveDayType(iso, ctx())).toBe(expected);
  });

  it('birthday wins over optional/Saturday but not mandatory', () => {
    // 12-Sep-2026 is the 2nd Saturday; birthday label wins
    expect(resolveDayType('2026-09-12', ctx('1998-09-12'))).toBe('birthday');
    // birthday on Diwali (mandatory) → mandatory still wins
    expect(resolveDayType('2026-11-09', ctx('1998-11-09'))).toBe('mandatory_holiday');
  });

  it('29-Feb birthday observed on 28-Feb in a non-leap year (2027)', () => {
    expect(resolveDayType('2027-02-28', ctx('2000-02-29'))).toBe('birthday');
    expect(resolveDayType('2028-02-29', ctx('2000-02-29'))).toBe('birthday'); // leap year, exact
  });

  it('a DOB that does not match the day is ignored', () => {
    // dob set but the day is an ordinary Tuesday → office, not birthday
    expect(resolveDayType('2026-11-10', ctx('1998-03-04'))).toBe('office');
    expect(resolveDayType('2027-02-25', ctx('2000-02-29'))).toBe('office'); // non-leap, not the 28th
  });
});

describe('isWorkingDay (domain-rules §3.2 / §16)', () => {
  it.each([
    ['office', true],
    ['second_saturday', true],
    ['wfh', true],
    ['optional_holiday', true], // unclaimed optional is a normal working day
    ['birthday', true], // unclaimed birthday is a normal working day
    ['sunday', false],
    ['fourth_saturday', false],
    ['mandatory_holiday', false],
  ] as const)('isWorkingDay(%s) → %s', (dt, expected) => {
    expect(isWorkingDay(dt)).toBe(expected);
  });
});
