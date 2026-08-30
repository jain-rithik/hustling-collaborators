import { describe, expect, it } from 'vitest';
import {
  accruedBalance,
  computeBalance,
  entitlementFor,
  monthlyAccrualSchedule,
  poolFor,
  probationBlocksPaidLeave,
  probationEndDate,
  prorataEarned,
} from '../../src/domain/leaveAccrual.js';

describe('entitlements (v4 change log)', () => {
  it('full-time holds 11 Privilege + 7 Sick as two separate FY pools', () => {
    expect(entitlementFor('full_time')).toEqual({ pl: 11, sick: 7, shared: false, resetsEachFy: true });
  });

  it('an intern holds ONE lifetime pool of 4 shared by Privilege and Sick', () => {
    expect(entitlementFor('intern')).toEqual({ pl: 4, sick: 0, shared: true, resetsEachFy: false });
    expect(poolFor('sick', 'intern')).toBe('pl');
    expect(poolFor('sick', 'full_time')).toBe('sick');
    expect(poolFor('pl', 'full_time')).toBe('pl');
  });
});

describe('probation', () => {
  it('full-time = joining month + 3 months − 1 day; intern = +2 months − 1 day', () => {
    expect(probationEndDate('2026-05-01', 'full_time')).toBe('2026-07-31');
    expect(probationEndDate('2026-05-15', 'full_time')).toBe('2026-07-31'); // month-based
    expect(probationEndDate('2026-04-01', 'intern')).toBe('2026-05-31');
  });

  it('blocks paid leave up to and including the last day of probation', () => {
    expect(probationBlocksPaidLeave('2026-07-31', '2026-07-31')).toBe(true);
    expect(probationBlocksPaidLeave('2026-07-31', '2026-08-01')).toBe(false);
    expect(probationBlocksPaidLeave(null, '2026-08-01')).toBe(false);
  });
});

describe('prorata earning', () => {
  it('rounds DOWN to the nearest half day so leave is never credited early', () => {
    expect(prorataEarned(11, 1)).toBe(0.5); // 0.92 → 0.5
    expect(prorataEarned(11, 6)).toBe(5.5);
    expect(prorataEarned(11, 7)).toBe(6); // 6.42 → 6
    expect(prorataEarned(7, 3)).toBe(1.5); // 1.75 → 1.5
    expect(prorataEarned(7, 6)).toBe(3.5);
  });

  it('is exact at 12 months and zero before the first month', () => {
    expect(prorataEarned(11, 12)).toBe(11);
    expect(prorataEarned(7, 12)).toBe(7);
    expect(prorataEarned(11, 13)).toBe(11);
    expect(prorataEarned(11, 0)).toBe(0);
  });
});

describe('full-time accrual — 1 Apr 2026 joiner (a whole financial year)', () => {
  const schedule = monthlyAccrualSchedule('2026-04-01', 'full_time', '2027-04-30');
  const at = (date: string, pool: string) =>
    schedule.find((e) => e.effectiveDate === date && e.leaveType === pool && e.entryType !== 'expiry');

  it('credits from month 1 — probation delays USING leave, not earning it', () => {
    expect(at('2026-04-01', 'pl')).toMatchObject({ entryType: 'opening', amount: 0.5, balanceAfter: 0.5 });
    expect(at('2026-04-01', 'sick')).toMatchObject({ entryType: 'opening', amount: 0.5, balanceAfter: 0.5 });
  });

  it('reaches exactly 11 Privilege and 7 Sick by March', () => {
    expect(at('2027-03-01', 'pl')?.balanceAfter).toBe(11);
    expect(at('2027-03-01', 'sick')?.balanceAfter).toBe(7);
    expect(accruedBalance('2026-04-01', 'full_time', '2027-03-01')).toEqual({ pl: 11, sick: 7 });
  });

  it('follows the prorata curve month by month', () => {
    expect(accruedBalance('2026-04-01', 'full_time', '2026-09-01')).toEqual({ pl: 5.5, sick: 3.5 });
    expect(accruedBalance('2026-04-01', 'full_time', '2026-12-01')).toEqual({ pl: 8, sick: 5 });
  });

  it('lapses both pools at the 1-Apr FY reset, then restarts the prorata clock', () => {
    const expiries = schedule.filter((e) => e.entryType === 'expiry');
    expect(expiries).toEqual([
      expect.objectContaining({ effectiveDate: '2027-04-01', leaveType: 'pl', amount: -11, balanceAfter: 0 }),
      expect.objectContaining({ effectiveDate: '2027-04-01', leaveType: 'sick', amount: -7, balanceAfter: 0 }),
    ]);
    expect(at('2027-04-01', 'pl')).toMatchObject({ amount: 0.5, balanceAfter: 0.5 });
  });
});

describe('full-time accrual — mid-FY joiner earns only their share of the year', () => {
  it('a 1 May 2026 joiner holds 11 months of the FY by March 2027', () => {
    expect(accruedBalance('2026-05-01', 'full_time', '2027-03-01')).toEqual({ pl: 10, sick: 6 });
    expect(accruedBalance('2026-05-01', 'full_time', '2026-08-01')).toEqual({ pl: 3.5, sick: 2 });
  });
});

describe('intern accrual — +1 a month, four in total', () => {
  const schedule = monthlyAccrualSchedule('2026-04-01', 'intern', '2026-09-01');

  it('has 3 leaves at the start of month 3 and the 4th at the start of month 4', () => {
    expect(accruedBalance('2026-04-01', 'intern', '2026-04-01').pl).toBe(1);
    expect(accruedBalance('2026-04-01', 'intern', '2026-06-01').pl).toBe(3);
    expect(accruedBalance('2026-04-01', 'intern', '2026-07-01').pl).toBe(4);
    expect(accruedBalance('2026-04-01', 'intern', '2026-09-01').pl).toBe(4); // capped
  });

  it('posts everything to the single shared pool and stops at the cap', () => {
    expect(schedule.map((e) => [e.effectiveDate, e.entryType, e.leaveType, e.amount])).toEqual([
      ['2026-04-01', 'opening', 'pl', 1],
      ['2026-05-01', 'accrual', 'pl', 1],
      ['2026-06-01', 'accrual', 'pl', 1],
      ['2026-07-01', 'accrual', 'pl', 1],
    ]);
    expect(schedule.every((e) => e.leaveType === 'pl')).toBe(true);
  });

  it('never lapses — the intern pool is lifetime, not per financial year', () => {
    expect(accruedBalance('2026-04-01', 'intern', '2027-05-01').pl).toBe(4);
  });
});

describe('computeBalance sums arbitrary ledger entries', () => {
  it('accruals minus deductions', () => {
    expect(computeBalance([{ amount: 6 }, { amount: 1.5 }, { amount: -2 }, { amount: -0.5 }])).toBe(5);
  });
});
