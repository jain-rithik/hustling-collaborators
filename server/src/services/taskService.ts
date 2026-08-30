import { DateTime } from 'luxon';
import type { Prisma, Task } from '@prisma/client';
import { IST_TZ, TASK_HISTORY_DAYS } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { systemClock } from '../lib/clock.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { notifyMany } from '../lib/notify.js';
import {
  computeActualMinutes,
  findScheduleClash,
  isWithinEstimate,
  taskTimeliness,
  toPlannedWindow,
} from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

type TaskWithCampaign = Task & { campaign?: { name: string; clientName: string | null } | null };

/** Stable top-to-bottom order. Starting a task must NEVER move it (v4 change log). */
const ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { plannedStartTime: 'asc' },
  { createdAt: 'asc' },
];

function toDto(t: TaskWithCampaign, todayIso?: string) {
  const workDate = dbDateToIso(t.workDate);
  return {
    id: t.id,
    title: t.title,
    ownerId: t.ownerId,
    campaignId: t.campaignId,
    campaignName: t.campaign ? t.campaign.clientName ?? t.campaign.name : null,
    estimatedMinutes: t.estimatedMinutes,
    status: t.status,
    workDate,
    sortOrder: t.sortOrder,
    plannedStartTime: t.plannedStartTime,
    plannedEndTime: t.plannedEndTime,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    actualMinutes: t.actualMinutes,
    withinEstimate: t.withinEstimate,
    delayReason: t.delayReason,
    /** An unfinished task planned for an earlier day — shown flagged until it is closed out. */
    carriedOver: t.status !== 'done' && !!todayIso && workDate < todayIso,
    timeliness:
      t.status === 'done' && t.actualMinutes != null
        ? taskTimeliness(t.actualMinutes, t.estimatedMinutes)
        : null,
  };
}

const withCampaign = { campaign: { select: { name: true, clientName: true } } } as const;

/**
 * Fire the founder "everyone's done" ping the moment a member clears their last open task
 * for the day — once per member per day (guarded so re-completions don't re-notify).
 */
async function maybeNotifyFoundersAllDone(ownerId: string, workDate: Date, workDateIso: string) {
  const openRemaining = await prisma.task.count({
    where: { ownerId, workDate, status: { not: 'done' } },
  });
  if (openRemaining > 0) return;
  const doneCount = await prisma.task.count({ where: { ownerId, workDate, status: 'done' } });
  if (doneCount === 0) return;

  const founders = await prisma.user.findMany({ where: { isFounder: true, isActive: true }, select: { id: true } });
  const recipients = founders.map((f) => f.id).filter((id) => id !== ownerId);
  if (!recipients.length) return;

  // De-dupe: only one all-done ping per member per day.
  const already = await prisma.notification.findFirst({
    where: {
      type: 'all_tasks_done',
      createdAt: { gte: workDate },
      payload: { path: ['ownerId'], equals: ownerId },
    },
    select: { id: true },
  });
  if (already) return;

  const profile = await prisma.employeeProfile.findUnique({ where: { userId: ownerId }, select: { fullName: true } });
  await notifyMany(
    recipients,
    'all_tasks_done',
    'All tasks completed',
    `${profile?.fullName ?? 'A team member'} has completed every task for ${workDateIso}.`,
    { ownerId, date: workDateIso, doneCount },
  );
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

/**
 * One person cannot be in two places at once, so a day's planned windows may not overlap
 * (v4 change log). Windows are half-open — a task may start exactly when the previous ends.
 */
async function assertNoScheduleClash(
  ownerId: string,
  workDate: Date,
  plannedStartTime: string | null | undefined,
  plannedEndTime: string | null | undefined,
  excludeTaskId?: string,
) {
  const candidate = toPlannedWindow(plannedStartTime, plannedEndTime);
  if (!candidate) return;
  const sameDay = await prisma.task.findMany({
    where: { ownerId, workDate, ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}) },
    select: { id: true, title: true, plannedStartTime: true, plannedEndTime: true },
  });
  const clash = findScheduleClash(candidate, sameDay);
  if (clash) {
    throw conflict(
      `That time overlaps “${clash.title}” (${clash.plannedStartTime}–${clash.plannedEndTime}). Pick a slot that starts when the other task ends.`,
    );
  }
}

async function nextSortOrder(ownerId: string, workDate: Date): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { ownerId, workDate },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? 0) + 10;
}

export const taskService = {
  async list(
    query: { ownerId?: string; date?: string; from?: string; to?: string; campaignId?: string; carryOver?: boolean },
    viewer: AuthContext,
  ) {
    const today = istToday();
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
        include: withCampaign,
        orderBy: { createdAt: 'desc' },
      });
      return tasks.map((t) => toDto(t, today));
    }

    const ownerId = query.ownerId ?? viewer.id;
    await assertCanReadOwner(viewer, ownerId);

    let dateFilter: Prisma.TaskWhereInput = {};
    if (query.from || query.to) {
      dateFilter = {
        workDate: {
          ...(query.from ? { gte: isoToDbDate(query.from) } : {}),
          ...(query.to ? { lte: isoToDbDate(query.to) } : {}),
        },
      };
    } else if (query.date) {
      // Unfinished work from earlier days stays on the list until it is marked done.
      dateFilter = query.carryOver
        ? {
            OR: [
              { workDate: isoToDbDate(query.date) },
              { workDate: { lt: isoToDbDate(query.date) }, status: { not: 'done' } },
            ],
          }
        : { workDate: isoToDbDate(query.date) };
    }

    const tasks = await prisma.task.findMany({
      where: { ownerId, ...dateFilter },
      include: withCampaign,
      orderBy: [{ workDate: 'asc' }, ...ORDER],
    });
    return tasks.map((t) => toDto(t, today));
  },

  /** A member's own daily task log for the past 30 days, grouped into date tabs (v4 change log). */
  async history(ownerId: string, viewer: AuthContext, days = TASK_HISTORY_DAYS) {
    await assertCanReadOwner(viewer, ownerId);
    const today = istToday();
    const from = DateTime.fromISO(today, { zone: IST_TZ })
      .minus({ days: days - 1 })
      .toISODate()!;
    const tasks = await prisma.task.findMany({
      where: { ownerId, workDate: { gte: isoToDbDate(from), lte: isoToDbDate(today) } },
      include: withCampaign,
      orderBy: [{ workDate: 'desc' }, ...ORDER],
    });
    const byDate = new Map<string, ReturnType<typeof toDto>[]>();
    for (const t of tasks) {
      const dto = toDto(t, today);
      const list = byDate.get(dto.workDate) ?? [];
      list.push(dto);
      byDate.set(dto.workDate, list);
    }
    return {
      from,
      to: today,
      days: [...byDate.entries()].map(([date, list]) => ({
        date,
        total: list.length,
        done: list.filter((t) => t.status === 'done').length,
        delayed: list.filter((t) => t.timeliness === 'delayed').length,
        pending: list.filter((t) => t.status !== 'done').length,
        tasks: list,
      })),
    };
  },

  async create(
    input: {
      title: string;
      campaignId?: string | null;
      estimatedMinutes: number;
      plannedStartTime?: string | null;
      plannedEndTime?: string | null;
      workDate?: string;
      ownerId?: string;
    },
    viewer: AuthContext,
  ) {
    // Admin may create on behalf of another user.
    const ownerId = input.ownerId && viewer.isAdmin ? input.ownerId : viewer.id;
    const workDate = isoToDbDate(input.workDate ?? istToday());
    await assertNoScheduleClash(ownerId, workDate, input.plannedStartTime, input.plannedEndTime);
    const task = await prisma.task.create({
      data: {
        title: input.title,
        ownerId,
        campaignId: input.campaignId ?? null,
        estimatedMinutes: input.estimatedMinutes,
        plannedStartTime: input.plannedStartTime ?? null,
        plannedEndTime: input.plannedEndTime ?? null,
        workDate,
        sortOrder: await nextSortOrder(ownerId, workDate),
        createdBy: viewer.id,
      },
      include: withCampaign,
    });
    return toDto(task, istToday());
  },

  async update(
    id: string,
    input: {
      title?: string;
      campaignId?: string | null;
      estimatedMinutes?: number;
      plannedStartTime?: string | null;
      plannedEndTime?: string | null;
    },
    viewer: AuthContext,
  ) {
    const existing = await loadOwned(id, viewer);
    if (input.plannedStartTime !== undefined || input.plannedEndTime !== undefined) {
      await assertNoScheduleClash(
        existing.ownerId,
        existing.workDate,
        input.plannedStartTime ?? existing.plannedStartTime,
        input.plannedEndTime ?? existing.plannedEndTime,
        id,
      );
    }
    const task = await prisma.task.update({
      where: { id },
      data: {
        title: input.title,
        campaignId: input.campaignId,
        estimatedMinutes: input.estimatedMinutes,
        plannedStartTime: input.plannedStartTime,
        plannedEndTime: input.plannedEndTime,
      },
      include: withCampaign,
    });
    return toDto(task, istToday());
  },

  /** Save a manual top-to-bottom order. The ids must all belong to one owner (v4 change log). */
  async reorder(ids: string[], viewer: AuthContext) {
    const tasks = await prisma.task.findMany({ where: { id: { in: ids } }, select: { id: true, ownerId: true } });
    if (tasks.length !== ids.length) throw notFound('One of those tasks no longer exists');
    const owners = new Set(tasks.map((t) => t.ownerId));
    if (owners.size > 1) throw badRequest('Tasks from different people cannot be reordered together');
    const ownerId = [...owners][0]!;
    if (!viewer.isAdmin && ownerId !== viewer.id) throw forbidden();
    await prisma.$transaction(
      ids.map((id, i) => prisma.task.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } })),
    );
    return { ok: true, ordered: ids.length };
  },

  /** Start — records the start silently. Enforces one active task per user (domain-rules A5). */
  async start(id: string, viewer: AuthContext) {
    const task = await loadOwned(id, viewer);
    if (task.status === 'done') throw conflict('That task is already done');
    const otherActive = await prisma.task.findFirst({
      where: { ownerId: task.ownerId, status: 'active', id: { not: id } },
      select: { id: true },
    });
    if (otherActive) throw conflict('Please finish your current task first — one active task at a time.');
    const updated = await prisma.task.update({
      where: { id },
      // sortOrder is deliberately untouched: starting a task must not move it down the list.
      data: { status: 'active', startedAt: task.startedAt ?? systemClock.now().toJSDate() },
      include: withCampaign,
    });
    return toDto(updated, istToday());
  },

  /** Complete — records the end, computes actual vs estimate, and captures a delay reason if over. */
  async complete(id: string, input: { completedAt?: string; delayReason?: string }, viewer: AuthContext) {
    const task = await loadOwned(id, viewer);
    if (!task.startedAt) throw conflict('Start the task before completing it');

    const completedAt =
      input.completedAt && viewer.isAdmin
        ? DateTime.fromISO(input.completedAt, { zone: IST_TZ })
        : systemClock.now();
    const start = DateTime.fromJSDate(task.startedAt, { zone: IST_TZ });
    const actual = computeActualMinutes(start, completedAt);
    const within = isWithinEstimate(actual, task.estimatedMinutes);
    // A task carried over from an earlier day keeps the day it was planned for, so the member's
    // history still shows it against the day they committed to it.
    const workDate = task.workDate;
    const workDateIso = dbDateToIso(task.workDate);

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: 'done',
        completedAt: completedAt.toJSDate(),
        actualMinutes: actual,
        withinEstimate: within,
        // Only a delayed task carries a reason; clear it otherwise.
        delayReason: within ? null : input.delayReason?.trim() || null,
      },
      include: withCampaign,
    });

    await maybeNotifyFoundersAllDone(task.ownerId, workDate, workDateIso);

    return {
      task: toDto(updated, istToday()),
      memeEvent: within ? 'task_completed_on_time' : 'task_completed_late',
    };
  },

  async remove(id: string, viewer: AuthContext) {
    await loadOwned(id, viewer);
    await prisma.task.delete({ where: { id } });
    return { deleted: true };
  },
};