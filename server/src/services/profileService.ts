import type { EmployeeProfile, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { hashPassword } from '../lib/hash.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { getHolidayRefs } from '../lib/calendar.js';
import { notify } from '../lib/notify.js';
import {
  availableCompOff,
  computeBalance,
  entitlementFor,
  isServingNotice,
  lwpDeduction,
  netEstimate,
  perDayRate,
  probationBlocksPaidLeave,
  probationEndDate,
  round2,
  workingDaysInMonth,
} from '../domain/index.js';
import { SALARY_DAYS_BASIS } from '@hc/shared';
import type { AuthContext } from '../middleware/auth.js';
import type {
  createProfileSchema,
  updateOwnProfileSchema,
  updateProfileSchema,
} from '@hc/shared';
import type { z } from 'zod';

type ProfileWithUser = EmployeeProfile & { user: User };

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function canSeeSalary(viewer: AuthContext, p: ProfileWithUser): boolean {
  return viewer.isAdmin || viewer.id === p.userId || p.reportingManagerId === viewer.id;
}

/**
 * A joining date is private (v4 change log): only the member themselves and an Admin ever see
 * it — not a reporting manager, and not a teammate looking at their profile.
 */
function canSeeJoiningDate(viewer: AuthContext, p: ProfileWithUser): boolean {
  return viewer.isAdmin || viewer.id === p.userId;
}

function toDto(p: ProfileWithUser, showSalary: boolean, showJoiningDate = true) {
  return {
    userId: p.userId,
    fullName: p.fullName,
    email: p.user.email,
    employeeCode: p.employeeCode,
    photoUrl: p.photoUrl,
    employmentType: p.employmentType,
    joiningDate: showJoiningDate ? dbDateToIso(p.joiningDate) : null,
    dateOfBirth: p.dateOfBirth ? dbDateToIso(p.dateOfBirth) : null,
    designation: p.designation,
    department: p.department,
    gender: p.gender,
    reportingManagerId: p.reportingManagerId,
    probationEndDate: p.probationEndDate ? dbDateToIso(p.probationEndDate) : null,
    onProbation: probationBlocksPaidLeave(
      p.probationEndDate ? dbDateToIso(p.probationEndDate) : null,
      istToday(),
    ),
    // Notice period is Admin-managed and visible to Admin + the member themselves.
    noticeStartDate: showJoiningDate && p.noticeStartDate ? dbDateToIso(p.noticeStartDate) : null,
    noticeLastDate: showJoiningDate && p.noticeLastDate ? dbDateToIso(p.noticeLastDate) : null,
    onNoticePeriod: isServingNotice(
      p.noticeStartDate ? dbDateToIso(p.noticeStartDate) : null,
      p.noticeLastDate ? dbDateToIso(p.noticeLastDate) : null,
      istToday(),
    ),
    role: p.user.role,
    isAdmin: p.user.isAdmin,
    isFounder: p.user.isFounder,
    isActive: p.user.isActive,
    salaryAmount: showSalary ? Number(p.salaryAmount ?? 0) : undefined,
  };
}

export const profileService = {
  async list(viewer: AuthContext) {
    const profiles = await prisma.employeeProfile.findMany({
      include: { user: true },
      orderBy: { fullName: 'asc' },
    });
    return profiles.map((p) => toDto(p, canSeeSalary(viewer, p), canSeeJoiningDate(viewer, p)));
  },

  async get(userId: string, viewer: AuthContext) {
    const p = await prisma.employeeProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!p) throw notFound('Employee not found');
    return toDto(p, canSeeSalary(viewer, p), canSeeJoiningDate(viewer, p));
  },

  async create(input: z.infer<typeof createProfileSchema>) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw conflict('That email already has an account');
    const passwordHash = await hashPassword(input.password);
    const probation = probationEndDate(input.joiningDate, input.employmentType);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: input.role,
        profile: {
          create: {
            fullName: input.fullName,
            employeeCode: input.employeeCode,
            employmentType: input.employmentType,
            joiningDate: isoToDbDate(input.joiningDate),
            dateOfBirth: input.dateOfBirth ? isoToDbDate(input.dateOfBirth) : null,
            designation: input.designation,
            department: input.department,
            gender: input.gender,
            salaryAmount: input.salaryAmount,
            reportingManagerId: input.reportingManagerId,
            probationEndDate: isoToDbDate(probation),
          },
        },
      },
      include: { profile: { include: { user: true } } },
    });
    return toDto(user.profile!, true);
  },

  async update(userId: string, input: z.infer<typeof updateProfileSchema>) {
    const p = await prisma.employeeProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Employee not found');
    const employmentType = input.employmentType ?? p.employmentType;
    const joining = input.joiningDate ?? dbDateToIso(p.joiningDate);
    const probation = probationEndDate(joining, employmentType);
    if (input.role) await prisma.user.update({ where: { id: userId }, data: { role: input.role } });
    await prisma.employeeProfile.update({
      where: { userId },
      data: {
        fullName: input.fullName,
        employeeCode: input.employeeCode,
        employmentType: input.employmentType,
        joiningDate: input.joiningDate ? isoToDbDate(input.joiningDate) : undefined,
        dateOfBirth: input.dateOfBirth ? isoToDbDate(input.dateOfBirth) : undefined,
        designation: input.designation,
        department: input.department,
        gender: input.gender,
        salaryAmount: input.salaryAmount,
        reportingManagerId: input.reportingManagerId,
        probationEndDate: isoToDbDate(probation),
      },
    });
    const fresh = await prisma.employeeProfile.findUnique({ where: { userId }, include: { user: true } });
    return toDto(fresh!, true);
  },

  /**
   * A member maintaining their own details (v4 change log): designation, birthday, joining
   * date, gender and employment type. Salary, role, reporting manager and notice period stay
   * Admin-only. Changing the joining date or employment type re-derives probation.
   */
  async updateOwn(userId: string, input: z.infer<typeof updateOwnProfileSchema>) {
    const p = await prisma.employeeProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Employee not found');
    const employmentType = input.employmentType ?? p.employmentType;
    const joining = input.joiningDate ?? dbDateToIso(p.joiningDate);
    await prisma.employeeProfile.update({
      where: { userId },
      data: {
        designation: input.designation === undefined ? undefined : input.designation,
        dateOfBirth:
          input.dateOfBirth === undefined ? undefined : input.dateOfBirth ? isoToDbDate(input.dateOfBirth) : null,
        joiningDate: input.joiningDate ? isoToDbDate(input.joiningDate) : undefined,
        gender: input.gender === undefined ? undefined : input.gender,
        employmentType: input.employmentType,
        probationEndDate: isoToDbDate(probationEndDate(joining, employmentType)),
      },
    });
    const fresh = await prisma.employeeProfile.findUnique({ where: { userId }, include: { user: true } });
    return toDto(fresh!, true, true);
  },

  /** Admin places a member on notice, or lifts it (v4 change log). */
  async setNoticePeriod(
    userId: string,
    input: { noticeStartDate: string | null; noticeLastDate: string | null },
  ) {
    const p = await prisma.employeeProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Employee not found');
    if (input.noticeStartDate && input.noticeLastDate && input.noticeLastDate < input.noticeStartDate) {
      throw unprocessable('The last working day cannot be before the notice start date');
    }
    await prisma.employeeProfile.update({
      where: { userId },
      data: {
        noticeStartDate: input.noticeStartDate ? isoToDbDate(input.noticeStartDate) : null,
        noticeLastDate: input.noticeLastDate ? isoToDbDate(input.noticeLastDate) : null,
      },
    });
    if (input.noticeStartDate) {
      await notify(
        userId,
        'admin_note',
        'Notice period recorded',
        `Your notice period has been recorded from ${input.noticeStartDate}${
          input.noticeLastDate ? ` to ${input.noticeLastDate}` : ''
        }. As per the policy, any leave taken and approved during this time will be considered as leave without pay.`,
        { noticeStartDate: input.noticeStartDate, noticeLastDate: input.noticeLastDate },
      );
    }
    const fresh = await prisma.employeeProfile.findUnique({ where: { userId }, include: { user: true } });
    return toDto(fresh!, true, true);
  },

  async remove(userId: string, confirmName: string) {
    const p = await prisma.employeeProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!p) throw notFound('Employee not found');
    if (p.user.isFounder) throw conflict('The founder account cannot be deleted');
    if (norm(confirmName) !== norm(p.fullName)) {
      throw unprocessable('The typed name does not match — deletion cancelled');
    }
    await prisma.user.delete({ where: { id: userId } }); // cascades all owned data
    return { deleted: true };
  },

  /**
   * Leave balance per entitlement pool (v4 change log). Full-time staff hold Privilege and Sick
   * separately; an intern's single pool of 4 is reported on both so either row reads the same.
   */
  async leaveBalance(userId: string) {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
      select: { employmentType: true },
    });
    if (!profile) throw notFound('Employee not found');
    const ent = entitlementFor(profile.employmentType);
    const ledger = await prisma.leaveLedger.findMany({
      where: { userId },
      select: { amount: true, leaveType: true },
    });
    const sum = (match: (t: string | null) => boolean) =>
      computeBalance(ledger.filter((e) => match(e.leaveType)).map((e) => ({ amount: Number(e.amount) })));
    const privilege = sum((t) => t !== 'lwp' && t !== 'sick');
    const sick = ent.shared ? privilege : sum((t) => t === 'sick');

    const today = istToday();
    const credits = await prisma.compOffCredit.findMany({
      where: { userId, consumed: false },
      select: { consumed: true, expiresOn: true },
    });
    const compOff = availableCompOff(
      credits.map((c) => ({ consumed: c.consumed, expiresOn: dbDateToIso(c.expiresOn) })),
      today,
    );
    return {
      // `pl` is kept as the Privilege figure so older clients keep working.
      pl: Math.max(0, privilege),
      privilege: { total: ent.pl, remaining: Math.max(0, privilege) },
      sick: { total: ent.shared ? ent.pl : ent.sick, remaining: Math.max(0, sick) },
      sharedPool: ent.shared,
      compOff,
      advanceDebt: Math.max(0, -privilege),
    };
  },

  async leaveLedger(userId: string) {
    const entries = await prisma.leaveLedger.findMany({
      where: { userId },
      orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
    });
    return entries.map((e) => ({
      id: e.id,
      effectiveDate: dbDateToIso(e.effectiveDate),
      entryType: e.entryType,
      leaveType: e.leaveType,
      amount: Number(e.amount),
      balanceAfter: Number(e.balanceAfter),
      note: e.note,
    }));
  },

  async salaryView(userId: string) {
    const p = await prisma.employeeProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Employee not found');
    const salary = Number(p.salaryAmount ?? 0);
    const today = istToday();
    const ym = today.slice(0, 7);
    const holidays = await getHolidayRefs();
    const dob = p.dateOfBirth ? dbDateToIso(p.dateOfBirth) : null;
    const workDays = workingDaysInMonth(ym, holidays, dob);

    const monthStart = isoToDbDate(`${ym}-01`);
    const nextMonthStart = isoToDbDate(
      `${new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 1)).toISOString().slice(0, 10)}`,
    );
    const lwpEntries = await prisma.leaveLedger.findMany({
      where: { userId, leaveType: 'lwp', effectiveDate: { gte: monthStart, lt: nextMonthStart } },
      select: { amount: true },
    });
    const lwpDays = lwpEntries.reduce((s, e) => s + Math.abs(Number(e.amount)), 0);
    // Salary runs on a fixed 30-day month (v4 change log): per-day = salary ÷ 30, days not
    // worked are deducted at that rate and the rest is paid.
    const deduction = lwpDeduction(salary, lwpDays);
    const perDay = perDayRate(salary);

    const allLedger = await prisma.leaveLedger.findMany({
      where: { userId },
      select: { amount: true, leaveType: true },
    });
    const balance = computeBalance(
      allLedger.filter((e) => e.leaveType !== 'lwp' && e.leaveType !== 'sick').map((e) => ({ amount: Number(e.amount) })),
    );
    const advanceDebtDays = Math.max(0, -balance);

    return {
      month: ym,
      daysBasis: SALARY_DAYS_BASIS,
      perDayRate: perDay,
      paidDays: round2(SALARY_DAYS_BASIS - lwpDays),
      workingDays: workDays,
      lwpDays,
      advanceDebtDays,
      advanceDebtValue: round2(perDay * advanceDebtDays),
      ...netEstimate(salary, deduction),
    };
  },

  async birthdays() {
    const profiles = await prisma.employeeProfile.findMany({
      where: { dateOfBirth: { not: null } },
      select: { fullName: true, photoUrl: true, dateOfBirth: true },
    });
    return profiles.map((p) => ({
      fullName: p.fullName,
      photoUrl: p.photoUrl,
      dateOfBirth: dbDateToIso(p.dateOfBirth!),
    }));
  },
};
