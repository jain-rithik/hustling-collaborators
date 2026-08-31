import { describe, expect, it } from 'vitest';
import { midMonthClawback } from '../../src/domain/separation.js';

describe('mid-month separation clawback (domain-rules §11.2)', () => {
  it('LWD 12-Mar (≤15) → clawback, 1 day → LWP, that month’s credit reversed', () => {
    expect(
      midMonthClawback({
        lastWorkingDay: '2027-03-12',
        monthCreditDate: '2027-03-01',
        usedFromThatCredit: 1,
        creditPosted: 1.5,
      }),
    ).toEqual({ clawback: true, lwpConverted: 1, creditReversed: 1.5 });
  });

  it('LWD 15-Mar (the 15th itself) → clawed back', () => {
    expect(
      midMonthClawback({
        lastWorkingDay: '2027-03-15',
        monthCreditDate: '2027-03-01',
        usedFromThatCredit: 0.5,
        creditPosted: 1,
      }),
    ).toEqual({ clawback: true, lwpConverted: 0.5, creditReversed: 1 });
  });

  it('LWD 16-Mar (>15) → credit stands regardless of usage', () => {
    expect(
      midMonthClawback({
        lastWorkingDay: '2027-03-16',
        monthCreditDate: '2027-03-01',
        usedFromThatCredit: 2,
        creditPosted: 1.5,
      }),
    ).toEqual({ clawback: false, lwpConverted: 0, creditReversed: 0 });
  });
});
