import { type IsoDate, istDate, toIsoDate } from './time/ist.js';
import { type HolidayRef, isWorkingDay, resolveDayType } from './dayType.js';
import { round2 } from './util.js';

/**
 * Salary / deductions estimate (PRD §13). A transparency layer only — NOT a payslip; no
 * PF/ESI/TDS. LWP deduction = (LWP days ÷ working days in month) × monthly salary.
 */
export function lwpDeduction(salary: number, lwpDays: number, workingDaysInMonth: number): number {
  if (workingDaysInMonth <= 0) return 0;
  return round2((lwpDays / workingDaysInMonth) * salary);
}

export interface NetEstimate {
  gross: number;
  deductions: number;
  net: number;
  /** Always true — this is explicitly labelled an estimate, never an official payslip. */
  isEstimate: true;
}

export function netEstimate(
  salary: number,
  lwpDeductionAmount: number,
  otherDeductions = 0,
): NetEstimate {
  const deductions = round2(lwpDeductionAmount + otherDeductions);
  return { gross: round2(salary), deductions, net: round2(salary - deductions), isEstimate: true };
}

/**
 * Count working days in a month (6-day week: office + WFH, minus Sundays/4th-Sat/holidays).
 * Used as the LWP-deduction denominator and the leaderboard working-days figure.
 */
export function workingDaysInMonth(
  yearMonth: string,
  holidays: HolidayRef[],
  dob?: IsoDate | null,
): number {
  const start = istDate(`${yearMonth}-01`);
  const lastDay = start.endOf('month').day;
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const iso = toIsoDate(start.set({ day: d }));
    if (isWorkingDay(resolveDayType(iso, { holidays, dob }))) count++;
  }
  return count;
}
