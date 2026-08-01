import { describe, expect, it } from 'vitest';
import { lwpDeduction, netEstimate, workingDaysInMonth } from '../../src/domain/salary.js';
import { FY2627_HOLIDAYS } from './fixtures.js';

describe('salary deductions estimate (domain-rules §12.1)', () => {
  it('LWP deduction = (lwpDays / workingDays) × salary', () => {
    expect(lwpDeduction(30000, 2, 22)).toBe(2727.27);
    expect(lwpDeduction(30000, 3, 22)).toBe(4090.91); // with a late→LWP conversion
    expect(lwpDeduction(30000, 0, 22)).toBe(0);
  });

  it('guards against a zero denominator', () => {
    expect(lwpDeduction(30000, 2, 0)).toBe(0);
  });

  it('net estimate is labelled and never a payslip', () => {
    expect(netEstimate(30000, 2727.27)).toEqual({
      gross: 30000,
      deductions: 2727.27,
      net: 27272.73,
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
