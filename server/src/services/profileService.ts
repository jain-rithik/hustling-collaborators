import type { EmployeeProfile, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { hashPassword } from '../lib/hash.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { getHolidayRefs } from '../lib/calendar.js';
import {
  availableCompOff,
  computeBalance,
  lwpDeduction,
  netEstimate,
  probationEndDate,
  round2,
  workingDaysInMonth,
} from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';
import type {
  createProfileSchema,
  updateProfileSchema,
} from '@hc/shared';
import type { z } from 'zod';

type ProfileWithUser = EmployeeProfile & { user: User };

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function canSeeSalary(viewer: AuthContext, p: ProfileWithUser): boolean {
  return viewer.isAdmin || viewer.id === p.userId || p.reportingManagerId === viewer.id;
}

function toDto(p: ProfileWithUser, showSalary: boolean) {
  return {
    userId: p.userId,
    fullName: p.fullName,
    email: p.user.email,
    employeeCode: p.employeeCode,
    photoUrl: p.photoUrl,
    employmentType: p.employmentType,
    joiningDate: dbDateToIso(p.joiningDate),
    dateOfBirth: p.dateOfBirth ? dbDateToIso(p.dateOfBirth) : null,
    designation: p.designation,
    department: p.department,
    reportingManagerId: p.reportingManagerId,
    probationEndDate: p.probationEndDate ? dbDateToIso(p.probationEndDate) : null,
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
    return profiles.map((p) => toDto(p, canSeeSalary(viewer, p)));
  },

  async get(userId: string, viewer: AuthContext) {
    const p = await prisma.employeeProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!p) throw notFound('Employee not found');
    return toDto(p, canSeeSalary(viewer, p));
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
        salaryAmount: input.salaryAmount,
        reportingManagerId: input.reportingManagerId,
        probationEndDate: isoToDbDate(probation),
      },
    });
    const fresh = await prisma.employeeProfile.findUnique({ where: { userId }, include: { user: true } });
    return toDto(fresh!, true);
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

  async leaveBalance(userId: string) {
    const ledger = await prisma.leaveLedger.findMany({ where: { userId }, select: { amount: true } });
    const balance = computeBalance(ledger.map((e) => ({ amount: Number(e.amount) })));
    const today = istToday();
    const credits = await prisma.compOffCredit.findMany({
      where: { userId, consumed: false },
      select: { consumed: true, expiresOn: true },
    });
    const compOff = availableCompOff(
      credits.map((c) => ({ consumed: c.consumed, expiresOn: dbDateToIso(c.expiresOn) })),
      today,
    );
    return { pl: Math.max(0, balance), compOff, advanceDebt: Math.max(0, -balance) };
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
    const deduction = lwpDeduction(salary, lwpDays, workDays);

    const allLedger = await prisma.leaveLedger.findMany({ where: { userId }, select: { amount: true } });
    const balance = computeBalance(allLedger.map((e) => ({ amount: Number(e.amount) })));
    const advanceDebtDays = Math.max(0, -balance);
    const perDay = workDays > 0 ? salary / workDays : 0;

    return {
      month: ym,
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
