import { DateTime } from 'luxon';
import type { Task } from '@prisma/client';
import { IST_TZ } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { systemClock } from '../lib/clock.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { computeActualMinutes, isWithinEstimate, toIstDateFromInstant } from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

function toDto(t: Task) {
  return {
    id: t.id,
    title: t.title,
    ownerId: t.ownerId,
    campaignId: t.campaignId,
    estimatedMinutes: t.estimatedMinutes,
    status: t.status,
    workDate: dbDateToIso(t.workDate),
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    actualMinutes: t.actualMinutes,
    withinEstimate: t.withinEstimate,
  };
}

async function isManagerOf(managerId: string, userId: string): Promise<boolean> {
  const p = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { reportingManagerId: true },
  });
  return p?.reportingManagerId === managerId;
}

async function assertCanReadOwner(viewer: AuthContext, ownerId: string) {
  if (viewer.isAdmin || viewer.id === ownerId) return;
  if (await isManagerOf(viewer.id, ownerId)) return;
  throw forbidden();
}

async function loadOwned(id: string, viewer: AuthContext): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw notFound('Task not found');
  if (!viewer.isAdmin && task.ownerId !== viewer.id) throw forbidden();
  return task;
}

export const taskService = {
  async list(
    query: { ownerId?: string; date?: string; campaignId?: string },
    viewer: AuthContext,
  ) {
    if (query.campaignId) {
      // Campaign task view: admin, the lead, or a member.
      const campaign = await prisma.campaign.findUnique({
        where: { id: query.campaignId },
        select: { leadId: true, members: { select: { userId: true } } },
      });
      if (!campaign) throw notFound('Campaign not found');
      const memberIds = campaign.members.map((m) => m.userId);
      if (!viewer.isAdmin && campaign.leadId !== viewer.id && !memberIds.includes(viewer.id)) {
        throw forbidden();
      }
      const tasks = await prisma.task.findMany({
        where: { campaignId: query.campaignId },
        orderBy: { createdAt: 'desc' },
      });
      return tasks.map(toDto);
    }

    const ownerId = query.ownerId ?? viewer.id;
    await assertCanReadOwner(viewer, ownerId);
    const tasks = await prisma.task.findMany({
      where: { ownerId, ...(query.date ? { workDate: isoToDbDate(query.date) } : {}) },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    return tasks.map(toDto);
  },

  async create(
    input: { title: string; campaignId?: string | null; estimatedMinutes: number; workDate?: string; ownerId?: string },
    viewer: AuthContext,
  ) {
    // Admin may create on behalf of another user.
    const ownerId = input.ownerId && viewer.isAdmin ? input.ownerId : viewer.id;
    const task = await prisma.task.create({
      data: {
        title: input.title,
        ownerId,
        campaignId: input.campaignId ?? null,
        estimatedMinutes: input.estimatedMinutes,
        workDate: isoToDbDate(input.workDate ?? istToday()),
        createdBy: viewer.id,
      },
    });
    return toDto(task);
  },

  async update(
    id: string,
    input: { title?: string; campaignId?: string | null; estimatedMinutes?: number },
    viewer: AuthContext,
  ) {
    await loadOwned(id, viewer);
    const task = await prisma.task.update({
      where: { id },
      data: {
        title: input.title,
        campaignId: input.campaignId,
        estimatedMinutes: input.estimatedMinutes,
      },
    });
    return toDto(task);
  },

  /** "On it 🔥" — records the start silently. Enforces one active task per user (domain-rules A5). */
  async start(id: string, viewer: AuthContext) {
    const task = await loadOwned(id, viewer);
    if (task.status === 'done') throw conflict('That task is already done');
    const otherActive = await prisma.task.findFirst({
      where: { ownerId: task.ownerId, status: 'active', id: { not: id } },
      select: { id: true },
    });
    if (otherActive) throw conflict('Ek kaam pehle finish karo — one active task at a time 🙂');
    const updated = await prisma.task.update({
      where: { id },
      data: { status: 'active', startedAt: task.startedAt ?? systemClock.now().toJSDate() },
    });
    return toDto(updated);
  },

  /** "Nailed it ✅" — records the end and computes actual vs estimate. */
  async complete(id: string, input: { completedAt?: string }, viewer: AuthContext) {
    const task = await loadOwned(id, viewer);
    if (!task.startedAt) throw conflict('Start the task before completing it');

    const completedAt =
      input.completedAt && viewer.isAdmin
        ? DateTime.fromISO(input.completedAt, { zone: IST_TZ })
        : systemClock.now();
    const start = DateTime.fromJSDate(task.startedAt, { zone: IST_TZ });
    const actual = computeActualMinutes(start, completedAt);
    const within = isWithinEstimate(actual, task.estimatedMinutes);

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'done',
        completedAt: completedAt.toJSDate(),
        actualMinutes: actual,
        withinEstimate: within,
        workDate: isoToDbDate(toIstDateFromInstant(task.startedAt)),
      },
    });
    return {
      task: toDto(updated),
      memeEvent: within ? 'task_completed_on_time' : 'task_completed_late',
    };
  },

  async remove(id: string, viewer: AuthContext) {
    await loadOwned(id, viewer);
    await prisma.task.delete({ where: { id } });
    return { deleted: true };
  },
};
