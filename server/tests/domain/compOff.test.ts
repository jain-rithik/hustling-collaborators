import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import {
  availableCompOff,
  creditExpiry,
  isCompOffEligibleGuideline,
  isPreApprovalValid,
} from '../../src/domain/compOff.js';

const now = (iso: string) => DateTime.fromISO(iso, { zone: IST_TZ });

describe('comp-off lifecycle (domain-rules §10)', () => {
  it('pre-approval must be strictly before the off day begins (E4)', () => {
    // Request the day before → valid
    expect(isPreApprovalValid(now('2026-11-13T18:00:00'), '2026-11-15')).toBe(true);
    // Request on the off day itself → retro, rejected
    expect(isPreApprovalValid(now('2026-11-15T09:00:00'), '2026-11-15')).toBe(false);
    // Exactly midnight of the off day → not before → rejected
    expect(isPreApprovalValid(now('2026-11-15T00:00:00'), '2026-11-15')).toBe(false);
  });

  it('6h guideline is advisory only (never auto-credits)', () => {
    expect(isCompOffEligibleGuideline(360)).toBe(true);
    expect(isCompOffEligibleGuideline(410)).toBe(true);
    expect(isCompOffEligibleGuideline(359)).toBe(false);
  });

  it('credit expires at 31 March of its FY', () => {
    expect(creditExpiry('2026-11-15')).toBe('2027-03-31');
    expect(creditExpiry('2027-02-10')).toBe('2027-03-31');
  });

  it('availableCompOff counts unconsumed, unexpired credits', () => {
    const credits = [
      { consumed: false, expiresOn: '2027-03-31' },
      { consumed: true, expiresOn: '2027-03-31' }, // consumed
      { consumed: false, expiresOn: '2026-03-31' }, // expired vs asOf
    ];
    expect(availableCompOff(credits, '2026-11-15')).toBe(1);
    expect(availableCompOff(credits, '2027-04-01')).toBe(0); // both non-consumed now expired
  });
});
