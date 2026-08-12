import { DateTime } from 'luxon';
import { IST_TZ, LATE_ARRIVAL_ALERT_COUNT } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import { systemClock } from '../lib/clock.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { getHolidayRefs } from '../lib/calendar.js';
import { notify, notifyMany } from '../lib/notify.js';
import { classifyCheckIn, isWorkingDay, resolveDayType } from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

/** Is there an approved half-day leave for this user on this date? (Exempts them from a late mark, v2 §03.) */
async function hasApprovedHalfDay(userId: string, dayIso: string): Promise<boolean> {
  const hit = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: 'approved',
      isHalfDay: true,
      startDate: { lte: isoToDbDate(dayIso) },
      endDate: { gte: isoToDbDate(dayIso) },
    },
    select: { id: true },
  });
  return !!hit;
}

async function dobOf(userId: string): Promise<string | null> {
  const p = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { dateOfBirth: true },
  });
  return p?.dateOfBirth ? dbDateToIso(p.dateOfBirth) : null;
}

const OFFICE_LIKE = ['office', 'optional_holiday', 'birthday'];

export const attendanceService = {
  async today(viewer: AuthContext) {
    const day = istToday();
    const [holidays, dob, record] = await Promise.all([
      getHolidayRefs(),
      dobOf(viewer.id),
      prisma.attendanceDay.findUnique({ where: { userId_day: { userId: viewer.id, day: isoToDbDate(day) } } }),
    ]);
    const dayType = resolveDayType(day, { holidays, dob });
    return {
      day,
      dayType,
      isWorkingDay: isWorkingDay(dayType),
      canCheckIn: OFFICE_LIKE.includes(dayType),
      isWfhDay: dayType === 'second_saturday',
      checkedIn: !!record?.checkInAt,
      checkedOut: !!record?.checkOutAt,
      checkInAt: record?.checkInAt?.toISOString() ?? null,
      checkOutAt: record?.checkOutAt?.toISOString() ?? null,
      status: record?.status ?? null,
      isLate: record?.isLate ?? false,
      wfhConfirmed: record?.wfhConfirmed ?? false,
    };
  },

  async checkIn(viewer: AuthContext, geo: { lat?: number | null; lng?: number | null }) {
    const day = istToday();
    const dob = await dobOf(viewer.id);
    const holidays = await getHolidayRefs();
    const dayType = resolveDayType(day, { holidays, dob });
    if (!OFFICE_LIKE.includes(dayType)) {
      throw badRequest('No office check-in needed today — it is an off or work-from-home day.');
    }
    const now = systemClock.now();
    // An approved half-day for the day exempts a late arrival from being marked late (v2 §03).
    const exemptFromLate = await hasApprovedHalfDay(viewer.id, day);
    const isLate = exemptFromLate ? false : classifyCheckIn(now).isLate;
    const record = await prisma.attendanceDay.upsert({
      where: { userId_day: { userId: viewer.id, day: isoToDbDate(day) } },
      update: {
        checkInAt: now.toJSDate(),
        checkInLat: geo.lat ?? null,
        checkInLng: geo.lng ?? null,
        isLate,
        status: isLate ? 'late' : 'present',
        dayType,
      },
      create: {
        userId: viewer.id,
        day: isoToDbDate(day),
        dayType,
        status: isLate ? 'late' : 'present',
        checkInAt: now.toJSDate(),
        checkInLat: geo.lat ?? null,
        checkInLng: geo.lng ?? null,
        isLate,
      },
    });
    if (isLate) await this.maybeNotifyLateThreshold(viewer.id, day);
    const memeEvent = isLate ? 'checkin_late' : now.weekday === 1 ? 'monday_first_checkin' : 'checkin_on_time';
    return { attendance: this.dto(record), memeEvent };
  },

  /** When a member reaches the monthly late-arrival threshold, notify them + their RM + Admins (v2 §03). */
  async maybeNotifyLateThreshold(userId: string, dayIso: string) {
    const monthStart = DateTime.fromISO(`${dayIso.slice(0, 7)}-01`, { zone: IST_TZ });
    const lateCount = await prisma.attendanceDay.count({
      where: {
        userId,
        isLate: true,
        day: { gte: monthStart.toJSDate(), lt: monthStart.plus({ months: 1 }).toJSDate() },
      },
    });
    if (lateCount !== LATE_ARRIVAL_ALERT_COUNT) return; // fire once, exactly on the Nth late arrival
    const [profile, admins] = await Promise.all([
      prisma.employeeProfile.findUnique({ where: { userId }, select: { reportingManagerId: true, fullName: true } }),
      prisma.user.findMany({ where: { isActive: true, isAdmin: true }, select: { id: true } }),
    ]);
    await notify(
      userId,
      'late_arrival',
      'A gentle heads-up on timing',
      `You have reached ${LATE_ARRIVAL_ALERT_COUNT} late arrivals this month. Further late arrivals may be reviewed as per the Attendance Policy — let's aim to be in on time.`,
      { month: dayIso.slice(0, 7), lateCount },
    );
    const others = new Set<string>(admins.map((a) => a.id));
    if (profile?.reportingManagerId) others.add(profile.reportingManagerId);
    others.delete(userId);
    await notifyMany(
      [...others],
      'late_arrival',
      'Late-arrival threshold reached',
      `${profile?.fullName ?? 'A team member'} has reached ${LATE_ARRIVAL_ALERT_COUNT} late arrivals this month.`,
      { userId, month: dayIso.slice(0, 7), lateCount },
    );
  },

  async checkOut(viewer: AuthContext, geo: { lat?: number | null; lng?: number | null }) {
    const day = istToday();
    const record = await prisma.attendanceDay.findUnique({
      where: { userId_day: { userId: viewer.id, day: isoToDbDate(day) } },
    });
    if (!record?.checkInAt) throw badRequest('Check in first before checking out');
    const updated = await prisma.attendanceDay.update({
      where: { id: record.id },
      data: {
        checkOutAt: systemClock.now().toJSDate(),
        checkOutLat: geo.lat ?? null,
        checkOutLng: geo.lng ?? null,
      },
    });
    return { attendance: this.dto(updated) };
  },

  async wfhConfirm(viewer: AuthContext) {
    const day = istToday();
    const dob = await dobOf(viewer.id);
    const holidays = await getHolidayRefs();
    const dayType = resolveDayType(day, { holidays, dob });
    if (dayType !== 'second_saturday') {
      throw badRequest('The work-from-home option is only available on the 2nd Saturday of the month.');
    }
    const now = systemClock.now();
    const record = await prisma.attendanceDay.upsert({
      where: { userId_day: { userId: viewer.id, day: isoToDbDate(day) } },
      update: { wfhConfirmed: true, status: 'wfh', checkInAt: now.toJSDate(), dayType },
      create: {
        userId: viewer.id,
        day: isoToDbDate(day),
        dayType,
        status: 'wfh',
        wfhConfirmed: true,
        checkInAt: now.toJSDate(),
      },
    });
    return { attendance: this.dto(record), memeEvent: 'wfh_checkin' };
  },

  async month(userId: string, ym: string) {
    const start = DateTime.fromISO(`${ym}-01`, { zone: IST_TZ });
    if (!start.isValid) throw badRequest('Invalid month');
    const lastDay = start.endOf('month').day;
    const from = isoToDbDate(`${ym}-01`);
    const to = isoToDbDate(start.plus({ months: 1 }).toISODate()!);

    const [holidays, dob, records, remarks, leaves, holidayRows] = await Promise.all([
      getHolidayRefs(),
      dobOf(userId),
      prisma.attendanceDay.findMany({ where: { userId, day: { gte: from, lt: to } } }),
      prisma.calendarRemark.findMany({ where: { userId, day: { gte: from, lt: to } } }),
      prisma.leaveRequest.findMany({
        where: { userId, status: 'approved', startDate: { lt: to }, endDate: { gte: from } },
      }),
      prisma.holiday.findMany({ where: { day: { gte: from, lt: to } }, select: { day: true, name: true } }),
    ]);
    const recByDay = new Map(records.map((r) => [dbDateToIso(r.day), r]));
    const remarkByDay = new Map(remarks.map((r) => [dbDateToIso(r.day), r.text]));
    const holidayNameByDay = new Map(holidayRows.map((h) => [dbDateToIso(h.day), h.name]));
    const leaveDays = new Map<string, { isHalfDay: boolean; leaveType: string }>();
    for (const lv of leaves) {
      let d = DateTime.fromJSDate(lv.startDate, { zone: IST_TZ });
      const end = DateTime.fromJSDate(lv.endDate, { zone: IST_TZ });
      while (d <= end) {
        leaveDays.set(d.toISODate()!, { isHalfDay: lv.isHalfDay, leaveType: lv.leaveType });
        d = d.plus({ days: 1 });
      }
    }

    const today = istToday();
    const days = [];
    for (let dd = 1; dd <= lastDay; dd++) {
      const iso = start.set({ day: dd }).toISODate()!;
      const dayType = resolveDayType(iso, { holidays, dob });
      const record = recByDay.get(iso);
      let status = record?.status ?? null;
      if (!status) {
        if (leaveDays.has(iso)) {
          const lv = leaveDays.get(iso)!;
          status = lv.leaveType === 'wfh' ? 'wfh' : lv.isHalfDay ? 'half_day' : 'on_leave';
        } else if (dayType === 'mandatory_holiday') status = 'holiday';
        else if (dayType === 'sunday' || dayType === 'fourth_saturday') status = 'weekend_off';
        else if (isWorkingDay(dayType) && iso < today) status = 'absent';
      }
      days.push({
        day: iso,
        dayType,
        status, // null = upcoming
        isLate: record?.isLate ?? false,
        checkInAt: record?.checkInAt?.toISOString() ?? null,
        checkOutAt: record?.checkOutAt?.toISOString() ?? null,
        holidayName: holidayNameByDay.get(iso) ?? null,
        remark: remarkByDay.get(iso) ?? null,
      });
    }
    return { month: ym, days };
  },

  async override(
    userId: string,
    day: string,
    input: { status: string; isLate?: boolean; note?: string },
    adminId: string,
  ) {
    const profile = await prisma.employeeProfile.findUnique({ where: { userId }, select: { dateOfBirth: true } });
    if (!profile) throw notFound('Employee not found');
    const holidays = await getHolidayRefs();
    const dob = profile.dateOfBirth ? dbDateToIso(profile.dateOfBirth) : null;
    const dayType = resolveDayType(day, { holidays, dob });
    const record = await prisma.attendanceDay.upsert({
      where: { userId_day: { userId, day: isoToDbDate(day) } },
      update: {
        status: input.status as never,
        isLate: input.isLate ?? undefined,
        adminOverride: true,
        overriddenBy: adminId,
      },
      create: {
        userId,
        day: isoToDbDate(day),
        dayType,
        status: input.status as never,
        isLate: input.isLate ?? false,
        adminOverride: true,
        overriddenBy: adminId,
      },
    });
    if (input.note) {
      await prisma.calendarRemark.create({
        data: { userId, day: isoToDbDate(day), text: input.note, createdBy: adminId },
      });
    }
    return { attendance: this.dto(record) };
  },

  dto(r: {
    id: string;
    day: Date;
    dayType: string;
    status: string;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    isLate: boolean;
    wfhConfirmed: boolean;
  }) {
    return {
      id: r.id,
      day: dbDateToIso(r.day),
      dayType: r.dayType,
      status: r.status,
      checkInAt: r.checkInAt?.toISOString() ?? null,
      checkOutAt: r.checkOutAt?.toISOString() ?? null,
      isLate: r.isLate,
      wfhConfirmed: r.wfhConfirmed,
    };
  },
};
