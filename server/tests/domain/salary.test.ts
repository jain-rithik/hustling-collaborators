import { describe, expect, it } from 'vitest';
import { lwpDeduction, netEstimate, perDayRate, workingDaysInMonth } from '../../src/domain/salary.js';
import { FY2627_HOLIDAYS } from './fixtures.js';

describe('salary on a 30-day basis (v4 change log)', () => {
  it('per-day rate = salary ÷ 30, the same in every month of the year', () => {
    expect(perDayRate(30000)).toBe(1000);
    expect(perDayRate(45500)).toBe(1516.67);
  });

  it('deducts the days not worked at that per-day rate', () => {
    expect(lwpDeduction(30000, 2)).toBe(2000);
    expect(lwpDeduction(30000, 0.5)).toBe(500); // a half day costs half a day
    expect(lwpDeduction(30000, 0)).toBe(0);
  });

  it('guards against a zero denominator', () => {
    expect(lwpDeduction(30000, 2, 0)).toBe(0);
    expect(perDayRate(30000, 0)).toBe(0);
  });

  it('net estimate is labelled and never a payslip', () => {
    expect(netEstimate(30000, 2000)).toEqual({
      gross: 30000,
      deductions: 2000,
      net: 28000,
      isEstimate: true,
    });
  });
});

describe('workingDaysInMonth (6-day week; WFH + unclaimed optional count as working)', () => {
  it.each([
    ['2026-04', 25],
    ['2026-08', 24],
    ['2026-11', 23],
    ['2027-02', 23],
  ])('%s → %i working days', (ym, expected) => {
    expect(workingDaysInMonth(ym, FY2627_HOLIDAYS)).toBe(expected);
  });
});
