import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import { systemClock } from '../lib/clock.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { getHolidayRefs } from '../lib/calendar.js';
import { classifyCheckIn, isWorkingDay, resolveDayType } from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

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
      throw badRequest('Aaj office check-in ki zaroorat nahi — it is an off/WFH day 🙂');
    }
    const now = systemClock.now();
    const { isLate } = classifyCheckIn(now);
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
    const memeEvent = isLate ? 'checkin_late' : now.weekday === 1 ? 'monday_first_checkin' : 'checkin_on_time';
    return { attendance: this.dto(record), memeEvent };
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
      throw badRequest('WFH toggle sirf 2nd Saturday ko available hai 🏠');
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

    const [holidays, dob, records, remarks, leaves] = await Promise.all([
      getHolidayRefs(),
      dobOf(userId),
      prisma.attendanceDay.findMany({ where: { userId, day: { gte: from, lt: to } } }),
      prisma.calendarRemark.findMany({ where: { userId, day: { gte: from, lt: to } } }),
      prisma.leaveRequest.findMany({
        where: { userId, status: 'approved', startDate: { lt: to }, endDate: { gte: from } },
      }),
    ]);
    const recByDay = new Map(records.map((r) => [dbDateToIso(r.day), r]));
    const remarkByDay = new Map(remarks.map((r) => [dbDateToIso(r.day), r.text]));
    const leaveDays = new Map<string, boolean>();
    for (const lv of leaves) {
      let d = DateTime.fromJSDate(lv.startDate, { zone: IST_TZ });
      const end = DateTime.fromJSDate(lv.endDate, { zone: IST_TZ });
      while (d <= end) {
        leaveDays.set(d.toISODate()!, lv.isHalfDay);
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
        if (leaveDays.has(iso)) status = leaveDays.get(iso) ? 'half_day' : 'on_leave';
        else if (dayType === 'mandatory_holiday') status = 'holiday';
        else if (dayType === 'sunday' || dayType === 'fourth_saturday') status = 'weekend_off';
        else if (isWorkingDay(dayType) && iso < today) status = 'absent';
      }
      days.push({
        day: iso,
        dayType,
        status, // null = upcoming
        isLate: record?.isLate ?? false,
        checkInAt: record?.checkInAt?.toISOString() ?? null,
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
