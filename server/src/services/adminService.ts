import { DateTime } from 'luxon';
import { IST_TZ, type UserRole } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { isoToDbDate } from '../lib/dates.js';
import { notifyMany } from '../lib/notify.js';
import { taskTimeliness } from '../domain/index.js';

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

  /**
   * Founder/admin day view: for a single date, everyone's arrival time + late flag + status and
   * their tasks with live timing. Lets leadership see, at a glance, who is in and what's moving.
   */
  async dailyOverview(date: string) {
    const day = isoToDbDate(date);
    const users = await prisma.user.findMany({
      where: { isActive: true, profile: { isNot: null } },
      include: { profile: { select: { fullName: true, employeeCode: true } } },
      orderBy: { profile: { fullName: 'asc' } },
    });
    const userIds = users.map((u) => u.id);
    const [attendance, tasks] = await Promise.all([
      prisma.attendanceDay.findMany({ where: { userId: { in: userIds }, day } }),
      prisma.task.findMany({ where: { ownerId: { in: userIds }, workDate: day }, orderBy: { createdAt: 'asc' } }),
    ]);
    const attByUser = new Map(attendance.map((a) => [a.userId, a]));
    const tasksByUser = new Map<string, typeof tasks>();
    for (const t of tasks) {
      const list = tasksByUser.get(t.ownerId) ?? [];
      list.push(t);
      tasksByUser.set(t.ownerId, list);
    }

    return {
      date,
      people: users.map((u) => {
        const att = attByUser.get(u.id);
        const list = tasksByUser.get(u.id) ?? [];
        const done = list.filter((t) => t.status === 'done');
        return {
          userId: u.id,
          name: u.profile?.fullName ?? u.email,
          checkInAt: att?.checkInAt?.toISOString() ?? null,
          checkOutAt: att?.checkOutAt?.toISOString() ?? null,
          status: att?.status ?? null,
          isLate: att?.isLate ?? false,
          taskCount: list.length,
          doneCount: done.length,
          allDone: list.length > 0 && done.length === list.length,
          tasks: list.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            estimatedMinutes: t.estimatedMinutes,
            actualMinutes: t.actualMinutes,
            plannedStartTime: t.plannedStartTime,
            plannedEndTime: t.plannedEndTime,
            delayReason: t.delayReason,
            timeliness:
              t.status === 'done' && t.actualMinutes != null
                ? taskTimeliness(t.actualMinutes, t.estimatedMinutes)
                : null,
          })),
        };
      }),
    };
  },

  /**
   * Admin drops a note or alert to one or more team members (v4 change log). It lands in their
   * in-app notifications like any other alert — there are no external channels.
   */
  async notifyMembers(userIds: string[], title: string, body: string, admin: { id: string }) {
    const recipients = await prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true },
    });
    if (!recipients.length) throw badRequest('Pick at least one active team member to notify.');
    await notifyMany(
      recipients.map((r) => r.id),
      'admin_note',
      title,
      body,
      { fromAdminId: admin.id },
    );
    return { notified: recipients.length };
  },

  /** All pending leave + comp-off requests across the org, for the Admin approvals view (v2 §05). */
  async pendingRequests() {
    const [leaves, compOffs] = await Promise.all([
      prisma.leaveRequest.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } }),
      prisma.compOffRequest.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } }),
    ]);
    const userIds = [...new Set([...leaves.map((l) => l.userId), ...compOffs.map((c) => c.userId)])];
    const profiles = await prisma.employeeProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, fullName: true },
    });
    const nameByUser = new Map(profiles.map((p) => [p.userId, p.fullName]));
    return {
      leave: leaves.map((l) => ({
        id: l.id,
        userId: l.userId,
        name: nameByUser.get(l.userId) ?? '',
        leaveType: l.leaveType,
        start: l.startDate.toISOString().slice(0, 10),
        end: l.endDate.toISOString().slice(0, 10),
        isHalfDay: l.isHalfDay,
        isSick: l.isSick,
        bereavementRelationship: l.bereavementRelationship,
        requestedDays: Number(l.requestedDays),
        reason: l.reason,
        createdAt: l.createdAt.toISOString(),
      })),
      compOff: compOffs.map((c) => ({
        id: c.id,
        userId: c.userId,
        name: nameByUser.get(c.userId) ?? '',
        offDate: c.offDate.toISOString().slice(0, 10),
        plannedWork: c.plannedWork,
        reason: c.reason,
        createdAt: c.createdAt.toISOString(),
      })),
    };
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
