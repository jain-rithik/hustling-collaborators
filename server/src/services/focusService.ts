import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { isoToDbDate } from '../lib/dates.js';
import { computeFocusMinutes, formatFocus } from '../domain/index.js';

/** Personal Focus Time + N-day trend (PRD §12) — self-insight, no percentages, no live ticking. */
export const focusService = {
  async trend(userId: string, days = 5) {
    const today = DateTime.now().setZone(IST_TZ).startOf('day');
    const trend: Array<{ day: string; minutes: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = today.minus({ days: i });
      const iso = d.toISODate()!;
      const tasks = await prisma.task.findMany({
        where: { ownerId: userId, status: 'done', workDate: isoToDbDate(iso) },
        select: { actualMinutes: true },
      });
      trend.push({ day: iso, minutes: computeFocusMinutes(tasks.map((t) => ({ actualMinutes: t.actualMinutes }))) });
    }
    const todayMinutes = trend[trend.length - 1]?.minutes ?? 0;
    return { todayMinutes, phrase: formatFocus(todayMinutes), trend };
  },
};
