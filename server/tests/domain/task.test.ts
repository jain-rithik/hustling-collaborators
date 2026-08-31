import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import {
  clockToMinutes,
  computeActualMinutes,
  findScheduleClash,
  isCarriedOver,
  isWithinEstimate,
  taskTimeliness,
  toPlannedWindow,
  windowsOverlap,
} from '../../src/domain/task.js';

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

  describe('taskTimeliness (three-way status)', () => {
    it('over estimate → delayed (and matches !isWithinEstimate)', () => {
      expect(taskTimeliness(31, 30)).toBe('delayed');
      expect(taskTimeliness(120, 60)).toBe('delayed');
    });

    it('comfortably under (beyond the tolerance band) → before_time', () => {
      // estimate 60 → tolerance = max(5, 6) = 6; 53 ≤ 54 → before_time
      expect(taskTimeliness(53, 60)).toBe('before_time');
      expect(taskTimeliness(10, 60)).toBe('before_time');
    });

    it('right around the estimate (within tolerance, not over) → on_time', () => {
      expect(taskTimeliness(60, 60)).toBe('on_time'); // exactly at estimate
      expect(taskTimeliness(55, 60)).toBe('on_time'); // within the 6-min band
    });

    it('uses a 5-minute floor on the tolerance for small estimates', () => {
      // estimate 20 → tolerance = max(5, 2) = 5; 15 = 20-5 → before_time, 16 → on_time
      expect(taskTimeliness(15, 20)).toBe('before_time');
      expect(taskTimeliness(16, 20)).toBe('on_time');
      expect(taskTimeliness(20, 20)).toBe('on_time');
      expect(taskTimeliness(21, 20)).toBe('delayed');
    });

    it('delayed is exactly the complement of isWithinEstimate', () => {
      for (const [actual, est] of [
        [10, 30],
        [30, 30],
        [31, 30],
        [59, 60],
        [61, 60],
      ] as const) {
        expect(taskTimeliness(actual, est) === 'delayed').toBe(!isWithinEstimate(actual, est));
      }
    });
  });
});

describe('task scheduling — one person, one slot (v4 change log)', () => {
  const win = (s: string, e: string) => toPlannedWindow(s, e)!;

  it('parses clock strings into minute windows and rejects bad ones', () => {
    expect(clockToMinutes('10:30')).toBe(630);
    expect(clockToMinutes('00:00')).toBe(0);
    expect(clockToMinutes('24:00')).toBeNull();
    expect(clockToMinutes('10:75')).toBeNull();
    expect(clockToMinutes('half ten')).toBeNull();
    expect(clockToMinutes(null)).toBeNull();
    expect(toPlannedWindow('11:00', '10:00')).toBeNull(); // end before start
    expect(toPlannedWindow('11:00', '11:00')).toBeNull(); // zero length
    expect(toPlannedWindow(null, '11:00')).toBeNull();
    expect(toPlannedWindow('11:00', null)).toBeNull();
  });

  it('treats windows as half-open, so a task may start when the previous one ends', () => {
    expect(windowsOverlap(win('10:00', '11:00'), win('11:00', '12:00'))).toBe(false);
    expect(windowsOverlap(win('10:00', '11:00'), win('10:59', '12:00'))).toBe(true);
    expect(windowsOverlap(win('10:00', '11:00'), win('09:00', '10:30'))).toBe(true);
    expect(windowsOverlap(win('10:00', '11:00'), win('10:15', '10:45'))).toBe(true); // fully inside
  });

  it('names the task a new one would clash with, and ignores unscheduled tasks', () => {
    const existing = [
      { id: 'a', title: 'Creator outreach', plannedStartTime: '10:00', plannedEndTime: '11:00' },
      { id: 'b', title: 'No window', plannedStartTime: null, plannedEndTime: null },
    ];
    expect(findScheduleClash(win('10:30', '11:30'), existing)?.id).toBe('a');
    expect(findScheduleClash(win('11:00', '12:00'), existing)).toBeNull();
    expect(findScheduleClash(win('09:00', '10:00'), existing)).toBeNull();
  });

  it('flags an unfinished task from an earlier day as carried over', () => {
    expect(isCarriedOver('2026-08-29', 'todo', '2026-08-30')).toBe(true);
    expect(isCarriedOver('2026-08-29', 'active', '2026-08-30')).toBe(true);
    expect(isCarriedOver('2026-08-29', 'done', '2026-08-30')).toBe(false);
    expect(isCarriedOver('2026-08-30', 'todo', '2026-08-30')).toBe(false);
  });
});
