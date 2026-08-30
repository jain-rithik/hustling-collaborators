import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import {
  calendarDaysUntil,
  halfDayBecomesLwp,
  halfDayNoticeDeadline,
  isLongLeave,
  longLeaveNeedsReview,
  optionalHolidayWithinAdvanceWindow,
  plWithinAdvanceWindow,
  sickLeaveAfterCutoff,
  sickLeaveBecomesLwp,
  sickLeaveNotSameDay,
  sickLeaveTooEarly,
  sickLeaveWindowOpensAt,
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

describe('v4 leave timing rules', () => {
  const ist = (iso: string) => DateTime.fromISO(iso, { zone: IST_TZ });

  it('an optional holiday claimed inside 5 days is granted as Leave Without Pay', () => {
    expect(optionalHolidayWithinAdvanceWindow('2026-11-14', '2026-11-10')).toBe(true);
    expect(optionalHolidayWithinAdvanceWindow('2026-11-15', '2026-11-10')).toBe(false);
  });

  it('sick leave is a same-day event only', () => {
    expect(sickLeaveNotSameDay('2026-11-11', '2026-11-10')).toBe(true);
    expect(sickLeaveNotSameDay('2026-11-10', '2026-11-10')).toBe(false);
  });

  it('cannot be filed more than 5 hours before office start (i.e. before 5:30 AM)', () => {
    expect(sickLeaveWindowOpensAt('2026-11-10').toFormat('HH:mm')).toBe('05:30');
    expect(sickLeaveTooEarly('2026-11-10', ist('2026-11-10T05:29'))).toBe(true);
    expect(sickLeaveTooEarly('2026-11-10', ist('2026-11-10T05:30'))).toBe(false);
    expect(sickLeaveTooEarly('2026-11-10', ist('2026-11-10T09:00'))).toBe(false);
  });

  it('a half day for the 30th with a 2 PM exit must be raised by 2 PM on the 29th', () => {
    expect(halfDayNoticeDeadline('2026-11-30', '14:00').toISO()).toBe(
      ist('2026-11-29T14:00').toISO(),
    );
    expect(halfDayBecomesLwp('2026-11-30', '14:00', ist('2026-11-29T13:59'))).toBe(false);
    expect(halfDayBecomesLwp('2026-11-30', '14:00', ist('2026-11-29T14:01'))).toBe(true);
  });

  it('falls back to a 2 PM exit when the request does not name a leaving time', () => {
    expect(halfDayNoticeDeadline('2026-11-30').toFormat('yyyy-MM-dd HH:mm')).toBe('2026-11-29 14:00');
    expect(halfDayNoticeDeadline('2026-11-30', 'noon').toFormat('HH:mm')).toBe('14:00');
    expect(halfDayBecomesLwp('2026-11-30', null, ist('2026-11-29T15:00'))).toBe(true);
  });
});
