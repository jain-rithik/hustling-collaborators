import { DateTime } from 'luxon';
import { IST_TZ, type UserRole } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';

export const adminService = {
  async listUsers() {
    const users = await prisma.user.findMany({
      include: { profile: { select: { fullName: true, employeeCode: true, designation: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isAdmin: u.isAdmin,
      isFounder: u.isFounder,
      isActive: u.isActive,
      fullName: u.profile?.fullName ?? null,
      employeeCode: u.profile?.employeeCode ?? null,
      designation: u.profile?.designation ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    }));
  },

  async toggleAdmin(id: string, isAdmin: boolean) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('User not found');
    if (!isAdmin) {
      if (user.isFounder) throw conflict("The founder's admin access cannot be revoked");
      const adminCount = await prisma.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) throw conflict('At least one admin must remain');
    }
    await prisma.user.update({ where: { id }, data: { isAdmin } });
    return { id, isAdmin };
  },

  async setRole(id: string, role: UserRole) {
    await prisma.user.update({ where: { id }, data: { role } });
    return { id, role };
  },

  async setActive(id: string, isActive: boolean) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('User not found');
    if (!isActive && user.isFounder) throw conflict('The founder account cannot be disabled');
    await prisma.user.update({ where: { id }, data: { isActive } });
    return { id, isActive };
  },

  /** Late-arrival counts per user for a month — surfaced to Admin/Manager, no auto-action (PRD §9.2). */
  async lateReport(month: string) {
    const start = DateTime.fromISO(`${month}-01`, { zone: IST_TZ });
    const grouped = await prisma.attendanceDay.groupBy({
      by: ['userId'],
      where: { isLate: true, day: { gte: start.toJSDate(), lt: start.plus({ months: 1 }).toJSDate() } },
      _count: { _all: true },
    });
    const profiles = await prisma.employeeProfile.findMany({
      where: { userId: { in: grouped.map((g) => g.userId) } },
      select: { userId: true, fullName: true },
    });
    const nameByUser = new Map(profiles.map((p) => [p.userId, p.fullName]));
    return {
      month,
      report: grouped
        .map((g) => ({ userId: g.userId, name: nameByUser.get(g.userId) ?? '', lateCount: g._count._all }))
        .sort((a, b) => b.lateCount - a.lateCount),
    };
  },
};
