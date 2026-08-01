import { prisma } from './prisma.js';
import { type HolidayRef, resolveDayType } from '../domain/index.js';
import { dbDateToIso } from './dates.js';
import type { IsoDate } from '../domain/index.js';

/** All seeded/admin holidays as domain HolidayRefs. */
export async function getHolidayRefs(): Promise<HolidayRef[]> {
  const rows = await prisma.holiday.findMany({ select: { day: true, type: true } });
  return rows.map((r) => ({ day: dbDateToIso(r.day), type: r.type as HolidayRef['type'] }));
}

/** Resolve a single day's type for an employee (fetches holidays once). */
export async function dayTypeFor(day: IsoDate, dob?: IsoDate | null) {
  const holidays = await getHolidayRefs();
  return resolveDayType(day, { holidays, dob });
}
