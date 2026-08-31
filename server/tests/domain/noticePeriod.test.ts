import { describe, expect, it } from 'vitest';
import {
  isServingNotice,
  noticeMonthAccrualIsUnpaid,
  noticeMonthStart,
} from '../../src/domain/noticePeriod.js';

describe('notice period (v4 change log)', () => {
  it('is serving notice between the start and last working day, inclusive', () => {
    expect(isServingNotice('2026-09-10', '2026-10-09', '2026-09-10')).toBe(true);
    expect(isServingNotice('2026-09-10', '2026-10-09', '2026-09-25')).toBe(true);
    expect(isServingNotice('2026-09-10', '2026-10-09', '2026-10-09')).toBe(true);
    expect(isServingNotice('2026-09-10', '2026-10-09', '2026-09-09')).toBe(false);
    expect(isServingNotice('2026-09-10', '2026-10-09', '2026-10-10')).toBe(false);
  });

  it('runs open-ended when no last working day is set, and not at all without a start', () => {
    expect(isServingNotice('2026-09-10', null, '2027-01-01')).toBe(true);
    expect(isServingNotice(null, '2026-10-09', '2026-09-25')).toBe(false);
    expect(isServingNotice(undefined, undefined, '2026-09-25')).toBe(false);
  });

  it('makes that month’s credit unpaid when notice starts on or before the 15th', () => {
    expect(noticeMonthAccrualIsUnpaid('2026-09-01')).toBe(true);
    expect(noticeMonthAccrualIsUnpaid('2026-09-15')).toBe(true); // the 15th itself
    expect(noticeMonthAccrualIsUnpaid('2026-09-16')).toBe(false);
    expect(noticeMonthAccrualIsUnpaid('2026-09-30')).toBe(false);
  });

  it('reverses the credit against the 1st of the notice month', () => {
    expect(noticeMonthStart('2026-09-14')).toBe('2026-09-01');
  });
});
