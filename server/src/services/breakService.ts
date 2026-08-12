import { DateTime } from 'luxon';
import { type BreakType, IST_TZ } from '@hc/shared';
import type { BreakLog } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict } from '../lib/errors.js';
import { systemClock } from '../lib/clock.js';
import { isoToDbDate, istToday } from '../lib/dates.js';
import { notify, notifyMany } from '../lib/notify.js';
import {
  breakElapsedMinutes,
  employeeShouldBeAlerted,
  managerAlertThreshold,
  managerShouldBeAlerted,
} from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

/** RM (if any) + all active admins/founders — the silent audience for a long break. Never the employee. */
async function managerRecipients(userId: string): Promise<string[]> {
  const [profile, admins] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId }, select: { reportingManagerId: true } }),
    prisma.user.findMany({
      where: { isActive: true, OR: [{ isAdmin: true }, { isFounder: true }] },
      select: { id: true },
    }),
  ]);
  const ids = admins.map((a) => a.id);
  if (profile?.reportingManagerId) ids.push(profile.reportingManagerId);
  return [...new Set(ids)].filter((id) => id !== userId);
}

function activeState(active: BreakLog | null) {
  return active
    ? { active: { id: active.id, type: active.type, startedAt: active.startedAt.toISOString() } }
    : { active: null as null };
}

export const breakService = {
  async start(viewer: AuthContext, type: BreakType) {
    const existing = await prisma.breakLog.findFirst({ where: { userId: viewer.id, endedAt: null } });
    if (existing) throw conflict('You already have a break in progress — tap “Back at it” to end it first.');
    const now = systemClock.now();
    await prisma.breakLog.create({
      data: { userId: viewer.id, type, day: isoToDbDate(istToday()), startedAt: now.toJSDate() },
    });
    return this.today(viewer);
  },

  async end(viewer: AuthContext) {
    const active = await prisma.breakLog.findFirst({
      where: { userId: viewer.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!active) throw badRequest('You are not on a break right now.');
    await prisma.breakLog.update({ where: { id: active.id }, data: { endedAt: systemClock.now().toJSDate() } });
    return { active: null as null, employeeAlert: false };
  },

  /** Current break state + fires any due threshold alerts (deduped). Drives the employee popup. */
  async today(viewer: AuthContext) {
    const active = await prisma.breakLog.findFirst({
      where: { userId: viewer.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!active) return { active: null as null, employeeAlert: false };
    const employeeAlert = await this.evaluate(active);
    return { ...activeState(active), employeeAlert };
  },

  /**
   * Evaluate one active break and fire alerts that have crossed their threshold, once each:
   *  - manager/admin silent notification (lunch 45m / tea 15m)
   *  - employee popup notification (lunch 55m)
   * Returns whether the employee should currently see the popup.
   */
  async evaluate(b: BreakLog): Promise<boolean> {
    const now = systemClock.now();
    const elapsed = breakElapsedMinutes(DateTime.fromJSDate(b.startedAt, { zone: IST_TZ }), now);

    if (!b.managerAlertedAt && managerShouldBeAlerted(b.type, elapsed)) {
      const recipients = await managerRecipients(b.userId);
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: b.userId },
        select: { fullName: true },
      });
      const name = profile?.fullName ?? 'A team member';
      const phrase = b.type === 'lunch' ? 'lunch' : 'a tea break';
      await notifyMany(
        recipients,
        'break_alert',
        'Break running a little long',
        `${name} has been on ${phrase} for over ${managerAlertThreshold(b.type)} minutes.`,
        { breakId: b.id, breakType: b.type },
      );
      await prisma.breakLog.update({ where: { id: b.id }, data: { managerAlertedAt: now.toJSDate() } });
    }

    if (!b.employeeAlertedAt && employeeShouldBeAlerted(b.type, elapsed)) {
      await notify(
        b.userId,
        'break_reminder',
        'Time to head back',
        'Your lunch break has gone over 55 minutes. Whenever you’re ready, let’s pick things back up.',
        { breakId: b.id },
      );
      await prisma.breakLog.update({ where: { id: b.id }, data: { employeeAlertedAt: now.toJSDate() } });
      return true;
    }

    // Popup stays visible on every poll until the employee ends the break.
    return !!b.employeeAlertedAt;
  },

  /** Cron backstop: evaluate every active break so manager alerts fire even if the employee's app is closed. */
  async sweep() {
    const active = await prisma.breakLog.findMany({ where: { endedAt: null } });
    for (const b of active) await this.evaluate(b);
    return { evaluated: active.length };
  },
};
