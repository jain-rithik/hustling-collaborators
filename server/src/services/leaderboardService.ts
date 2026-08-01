import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { dbDateToIso, istToday } from '../lib/dates.js';
import {
  computeFactorAttendance,
  computeFactorCampaign,
  computeFactorTask,
  computeLeaderboardScore,
  deliveredOnTime,
  onTimeStreak,
  rankAndMovement,
} from '../domain/index.js';

const ELIGIBLE = ['present', 'wfh', 'late', 'half_day', 'absent'];
const ON_TIME = ['present', 'wfh'];

function monthBounds(ym: string) {
  const start = DateTime.fromISO(`${ym}-01`, { zone: IST_TZ });
  return { start: start.toJSDate(), end: start.plus({ months: 1 }).toJSDate(), startIso: `${ym}-01`, endIso: start.plus({ months: 1 }).toISODate()! };
}

function prevMonth(ym: string): string {
  return DateTime.fromISO(`${ym}-01`, { zone: IST_TZ }).minus({ months: 1 }).toFormat('yyyy-MM');
}

export const leaderboardService = {
  async computeBoard(ym: string) {
    const { start, end, startIso, endIso } = monthBounds(ym);
    const users = await prisma.user.findMany({
      where: { isActive: true, profile: { isNot: null } },
      include: { profile: { select: { fullName: true, photoUrl: true } } },
    });

    const priorSnaps = await prisma.leaderboardSnapshot.findMany({ where: { yearMonth: prevMonth(ym) } });

    const rows = [];
    for (const u of users) {
      const att = await prisma.attendanceDay.findMany({
        where: { userId: u.id, day: { gte: start, lt: end } },
        select: { status: true, isLate: true },
      });
      const eligible = att.filter((a) => ELIGIBLE.includes(a.status)).length;
      const onTime = att.filter((a) => ON_TIME.includes(a.status) && !a.isLate).length;
      const fAtt = computeFactorAttendance(onTime, eligible);

      const tasks = await prisma.task.findMany({
        where: { ownerId: u.id, status: 'done', workDate: { gte: start, lt: end } },
        select: { withinEstimate: true },
      });
      const fTask = computeFactorTask(tasks.filter((t) => t.withinEstimate).length, tasks.length);

      const campaigns = await prisma.campaign.findMany({
        where: { members: { some: { userId: u.id } } },
        select: { status: true, deadline: true, deliveredAt: true },
      });
      let closed = 0;
      let onTimeCamp = 0;
      for (const c of campaigns) {
        const deliveredThisMonth =
          c.status === 'delivered' && c.deliveredAt && c.deliveredAt >= start && c.deliveredAt < end;
        const overdueThisMonth =
          c.status === 'overdue' && dbDateToIso(c.deadline) >= startIso && dbDateToIso(c.deadline) < endIso;
        if (deliveredThisMonth || overdueThisMonth) {
          closed++;
          if (deliveredThisMonth && c.deliveredAt && deliveredOnTime(dbDateToIso(c.deadline), dbDateToIso(c.deliveredAt))) {
            onTimeCamp++;
          }
        }
      }
      const fCamp = computeFactorCampaign(onTimeCamp, closed);

      const { score, hasData } = computeLeaderboardScore({ attendance: fAtt, task: fTask, campaign: fCamp });
      rows.push({
        userId: u.id,
        name: u.profile?.fullName ?? '',
        photoUrl: u.profile?.photoUrl ?? null,
        score,
        hasData,
        factors: { attendance: fAtt, task: fTask, campaign: fCamp },
        perfectAttendance: fAtt === 1 && eligible > 0,
      });
    }

    const ranked = rankAndMovement(
      rows.map((r) => ({ userId: r.userId, score: r.score })),
      priorSnaps.map((s) => ({ userId: s.userId, rank: s.rank })),
    );
    const rankByUser = new Map(ranked.map((r) => [r.userId, r]));

    const withRank = await Promise.all(
      rows.map(async (r) => {
        const rk = rankByUser.get(r.userId)!;
        return { ...r, rank: rk.rank, movement: rk.movement, streak: await this.streakFor(r.userId, ym, r.perfectAttendance) };
      }),
    );
    return withRank.sort((a, b) => a.rank - b.rank);
  },

  /** On-time streak = trailing perfect months from history (+ this month if perfect). */
  async streakFor(userId: string, ym: string, perfectThisMonth: boolean) {
    const snaps = await prisma.leaderboardSnapshot.findMany({
      where: { userId, yearMonth: { lt: ym } },
      orderBy: { yearMonth: 'asc' },
      select: { factorAttendance: true },
    });
    const history = snaps.map((s) => s.factorAttendance !== null && Number(s.factorAttendance) === 1);
    history.push(perfectThisMonth);
    return onTimeStreak(history);
  },

  /** Persist snapshots for a closed month (cron). */
  async writeSnapshots(ym: string) {
    const board = await this.computeBoard(ym);
    for (const r of board) {
      await prisma.leaderboardSnapshot.upsert({
        where: { userId_yearMonth: { userId: r.userId, yearMonth: ym } },
        update: {
          score: r.score,
          rank: r.rank,
          factorAttendance: r.factors.attendance,
          factorTask: r.factors.task,
          factorCampaign: r.factors.campaign,
          onTimeStreak: r.streak,
        },
        create: {
          userId: r.userId,
          yearMonth: ym,
          score: r.score,
          rank: r.rank,
          factorAttendance: r.factors.attendance,
          factorTask: r.factors.task,
          factorCampaign: r.factors.campaign,
          onTimeStreak: r.streak,
        },
      });
    }
    return { count: board.length };
  },

  async current(month?: string) {
    return this.computeBoard(month ?? istToday().slice(0, 7));
  },
};
