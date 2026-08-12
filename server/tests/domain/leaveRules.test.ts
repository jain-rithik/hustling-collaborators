import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import {
  calendarDaysUntil,
  isLongLeave,
  longLeaveNeedsReview,
  plWithinAdvanceWindow,
  sickLeaveAfterCutoff,
  sickLeaveBecomesLwp,
  wfhTooSoon,
} from '../../src/domain/leaveRules.js';

const nowIst = (iso: string) => DateTime.fromISO(iso, { zone: IST_TZ });

describe('leave rules (v2 §05)', () => {
  it('calendarDaysUntil counts whole IST days', () => {
    expect(calendarDaysUntil('2026-11-10', '2026-11-10')).toBe(0);
    expect(calendarDaysUntil('2026-11-15', '2026-11-10')).toBe(5);
    expect(calendarDaysUntil('2026-11-09', '2026-11-10')).toBe(-1);
  });

  it('paid leave inside the 5-day window must become LWP', () => {
    // today = 10th; needs >=5 days ahead → 15th is the first allowed
    expect(plWithinAdvanceWindow('2026-11-14', '2026-11-10')).toBe(true); // 4 days → too soon
    expect(plWithinAdvanceWindow('2026-11-15', '2026-11-10')).toBe(false); // 5 days → allowed
    expect(plWithinAdvanceWindow('2026-11-10', '2026-11-10')).toBe(true); // same day → too soon
  });

  it('long leave = more than 3 consecutive days', () => {
    expect(isLongLeave(3)).toBe(false);
    expect(isLongLeave(4)).toBe(true);
  });

  it('a long leave inside 15 days needs admin review', () => {
    expect(longLeaveNeedsReview('2026-11-24', '2026-11-10')).toBe(true); // 14 days
    expect(longLeaveNeedsReview('2026-11-25', '2026-11-10')).toBe(false); // 15 days
  });

  it('WFH must be requested at least 24 hours before IST start-of-day', () => {
    // requested for the 11th; start-of-day 11th 00:00 IST
    expect(wfhTooSoon('2026-11-11', nowIst('2026-11-10T09:00'))).toBe(true); // ~15h before → too soon
    expect(wfhTooSoon('2026-11-12', nowIst('2026-11-10T09:00'))).toBe(false); // ~39h before → ok
    expect(wfhTooSoon('2026-11-10', nowIst('2026-11-10T09:00'))).toBe(true); // same day
  });

  it('sick-leave cutoff: after 09:30 IST is "after cutoff"', () => {
    expect(sickLeaveAfterCutoff(nowIst('2026-11-10T09:29:59'))).toBe(false);
    expect(sickLeaveAfterCutoff(nowIst('2026-11-10T09:30:00'))).toBe(false); // inclusive
    expect(sickLeaveAfterCutoff(nowIst('2026-11-10T09:30:01'))).toBe(true);
  });

  it('same-day sick leave after the cutoff becomes LWP; future-dated is unaffected', () => {
    expect(sickLeaveBecomesLwp('2026-11-10', '2026-11-10', nowIst('2026-11-10T10:00'))).toBe(true);
    expect(sickLeaveBecomesLwp('2026-11-10', '2026-11-10', nowIst('2026-11-10T09:00'))).toBe(false);
    expect(sickLeaveBecomesLwp('2026-11-12', '2026-11-10', nowIst('2026-11-10T10:00'))).toBe(false);
  });
});
