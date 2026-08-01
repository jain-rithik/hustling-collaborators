import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import { computeActualMinutes, isWithinEstimate } from '../../src/domain/task.js';

const t = (hms: string) => DateTime.fromISO(`2026-11-10T${hms}`, { zone: IST_TZ });

describe('task timing (domain-rules §6)', () => {
  it('computes actual minutes from Start→Done, rounded', () => {
    expect(computeActualMinutes(t('10:00:00'), t('10:28:00'))).toBe(28);
    expect(computeActualMinutes(t('10:00:00'), t('10:28:30'))).toBe(29); // rounds
    expect(computeActualMinutes(t('10:00:00'), t('10:00:00'))).toBe(0);
  });

  it('never goes negative on clock skew', () => {
    expect(computeActualMinutes(t('10:30:00'), t('10:00:00'))).toBe(0);
  });

  it('counts a task started before midnight toward its start day (spans days)', () => {
    const start = DateTime.fromISO('2026-11-10T23:30:00', { zone: IST_TZ });
    const done = DateTime.fromISO('2026-11-11T00:15:00', { zone: IST_TZ });
    expect(computeActualMinutes(start, done)).toBe(45);
  });

  it('isWithinEstimate: actual ≤ estimate', () => {
    expect(isWithinEstimate(28, 30)).toBe(true);
    expect(isWithinEstimate(30, 30)).toBe(true);
    expect(isWithinEstimate(31, 30)).toBe(false);
  });
});
