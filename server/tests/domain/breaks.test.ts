import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import {
  breakElapsedMinutes,
  employeeShouldBeAlerted,
  managerAlertThreshold,
  managerShouldBeAlerted,
} from '../../src/domain/breaks.js';

const t = (hms: string) => DateTime.fromISO(`2026-11-10T${hms}`, { zone: IST_TZ });

describe('break thresholds (v2 §02/§07)', () => {
  it('elapsed minutes floor, never negative', () => {
    expect(breakElapsedMinutes(t('13:00:00'), t('13:45:30'))).toBe(45);
    expect(breakElapsedMinutes(t('13:00:00'), t('13:00:00'))).toBe(0);
    expect(breakElapsedMinutes(t('13:10:00'), t('13:00:00'))).toBe(0); // clock skew
  });

  it('manager thresholds: lunch 45, tea 15', () => {
    expect(managerAlertThreshold('lunch')).toBe(45);
    expect(managerAlertThreshold('tea')).toBe(15);
  });

  it('manager alerted once past the type threshold', () => {
    expect(managerShouldBeAlerted('lunch', 44)).toBe(false);
    expect(managerShouldBeAlerted('lunch', 45)).toBe(true);
    expect(managerShouldBeAlerted('tea', 14)).toBe(false);
    expect(managerShouldBeAlerted('tea', 15)).toBe(true);
  });

  it('employee popup only for lunch past 55 minutes', () => {
    expect(employeeShouldBeAlerted('lunch', 54)).toBe(false);
    expect(employeeShouldBeAlerted('lunch', 55)).toBe(true);
    expect(employeeShouldBeAlerted('tea', 99)).toBe(false); // tea never pops the employee
  });
});
