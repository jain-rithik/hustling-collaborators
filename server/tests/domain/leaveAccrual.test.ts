import { describe, expect, it } from 'vitest';
import {
  accruedBalance,
  computeBalance,
  monthlyAccrualSchedule,
  probationEndDate,
} from '../../src/domain/leaveAccrual.js';

describe('probation end (domain-rules §7.1 / §8)', () => {
  it('full-time = joining month + 3 months − 1 day; intern = +2 months − 1 day', () => {
    expect(probationEndDate('2026-05-01', 'full_time')).toBe('2026-07-31');
    expect(probationEndDate('2026-05-15', 'full_time')).toBe('2026-07-31'); // month-based
    expect(probationEndDate('2026-04-01', 'intern')).toBe('2026-05-31');
  });
});

describe('full-time accrual — April 2026 joiner (domain-rules §7.3)', () => {
  const schedule = monthlyAccrualSchedule('2026-04-01', 'full_time', '2027-04-30');

  it('probation months 1–3 credit nothing', () => {
    expect(accruedBalance('2026-04-01', 'full_time', '2026-06-01')).toBe(0);
  });

  it('opening +6 posts at month 4 (Jul 2026)', () => {
    const opening = schedule.filter((e) => e.entryType === 'opening');
    expect(opening).toHaveLength(1);
    expect(opening[0]).toMatchObject({ effectiveDate: '2026-07-01', amount: 6, balanceAfter: 6 });
  });

  it('reaches the 18-day FY cap exactly at Mar 2027', () => {
    const mar = schedule.find((e) => e.effectiveDate === '2027-03-01');
    expect(mar?.balanceAfter).toBe(18);
    expect(accruedBalance('2026-04-01', 'full_time', '2027-03-01')).toBe(18);
  });

  it('lapses the full balance at the 1-Apr FY reset, then resumes at +1.5', () => {
    const expiry = schedule.find((e) => e.entryType === 'expiry');
    expect(expiry).toMatchObject({ effectiveDate: '2027-04-01', amount: -18, balanceAfter: 0 });
    // final running balance after the new-FY April accrual
    expect(schedule[schedule.length - 1]).toMatchObject({
      effectiveDate: '2027-04-01',
      entryType: 'accrual',
      amount: 1.5,
      balanceAfter: 1.5,
    });
  });

  it('monthly ledger balances follow 6, 7.5, 9 … 18', () => {
    const byDate = Object.fromEntries(schedule.map((e) => [e.effectiveDate + ':' + e.entryType, e.balanceAfter]));
    expect(byDate['2026-08-01:accrual']).toBe(7.5);
    expect(byDate['2026-09-01:accrual']).toBe(9);
    expect(byDate['2026-11-01:accrual']).toBe(12);
    expect(byDate['2027-01-01:accrual']).toBe(15);
  });
});

describe('full-time accrual — May 2026 joiner (architecture §11.2)', () => {
  it('opening 6 at Aug 2026, then +1.5/month', () => {
    expect(accruedBalance('2026-05-01', 'full_time', '2026-08-01')).toBe(6);
    expect(accruedBalance('2026-05-01', 'full_time', '2026-09-01')).toBe(7.5);
    expect(accruedBalance('2026-05-01', 'full_time', '2026-10-01')).toBe(9);
  });
});

describe('intern accrual (domain-rules §8.1)', () => {
  const schedule = monthlyAccrualSchedule('2026-04-01', 'intern', '2026-09-01');

  it('no credit months 1–2, opening +3 at month 3, +1 at month 4, then capped at 4', () => {
    expect(accruedBalance('2026-04-01', 'intern', '2026-05-01')).toBe(0);
    expect(accruedBalance('2026-04-01', 'intern', '2026-06-01')).toBe(3); // opening
    expect(accruedBalance('2026-04-01', 'intern', '2026-07-01')).toBe(4); // +1 → cap
    expect(accruedBalance('2026-04-01', 'intern', '2026-09-01')).toBe(4); // stays capped
  });

  it('emits exactly two entries (opening + one accrual)', () => {
    expect(schedule.map((e) => [e.effectiveDate, e.entryType, e.amount])).toEqual([
      ['2026-06-01', 'opening', 3],
      ['2026-07-01', 'accrual', 1],
    ]);
  });

  it('interns have no FY reset (lifetime cap)', () => {
    // a full year later balance is still 4 (never lapses at 1-Apr)
    expect(accruedBalance('2026-04-01', 'intern', '2027-05-01')).toBe(4);
  });
});

describe('computeBalance sums arbitrary ledger entries', () => {
  it('accruals minus deductions', () => {
    expect(
      computeBalance([{ amount: 6 }, { amount: 1.5 }, { amount: -2 }, { amount: -0.5 }]),
    ).toBe(5);
  });
});
