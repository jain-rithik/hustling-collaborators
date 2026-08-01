import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';
import { dbDateToIso, isoToDbDate } from '../lib/dates.js';
import { financialYear } from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

export const holidayService = {
  async list(fy?: string) {
    const holidays = await prisma.holiday.findMany({ orderBy: { day: 'asc' } });
    const mapped = holidays.map((h) => ({
      id: h.id,
      day: dbDateToIso(h.day),
      name: h.name,
      type: h.type,
      seeded: h.seeded,
    }));
    if (!fy) return mapped;
    return mapped.filter((h) => financialYear(h.day).label.startsWith(fy));
  },

  async create(input: { day: string; name: string; type: string }, admin: AuthContext) {
    const existing = await prisma.holiday.findUnique({ where: { day: isoToDbDate(input.day) } });
    if (existing) throw conflict('A holiday already exists on that date');
    const h = await prisma.holiday.create({
      data: {
        day: isoToDbDate(input.day),
        name: input.name,
        type: input.type as never,
        seeded: false,
        createdBy: admin.id,
      },
    });
    return { id: h.id, day: dbDateToIso(h.day), name: h.name, type: h.type };
  },

  async update(id: string, input: { day?: string; name?: string; type?: string }) {
    const h = await prisma.holiday.update({
      where: { id },
      data: {
        day: input.day ? isoToDbDate(input.day) : undefined,
        name: input.name,
        type: input.type as never,
      },
    });
    return { id: h.id, day: dbDateToIso(h.day), name: h.name, type: h.type };
  },

  async remove(id: string) {
    await prisma.holiday.delete({ where: { id } });
    return { deleted: true };
  },

  // ── Calendar remarks ──────────────────────────────────────────────────────
  async listRemarks(userId: string, month: string | undefined) {
    const where = month
      ? { userId, day: { gte: isoToDbDate(`${month}-01`), lt: nextMonth(month) } }
      : { userId };
    const remarks = await prisma.calendarRemark.findMany({ where, orderBy: { day: 'asc' } });
    return remarks.map((r) => ({ id: r.id, day: dbDateToIso(r.day), text: r.text }));
  },

  async createRemark(input: { userId: string; day: string; text: string }, admin: AuthContext) {
    const r = await prisma.calendarRemark.create({
      data: { userId: input.userId, day: isoToDbDate(input.day), text: input.text, createdBy: admin.id },
    });
    return { id: r.id, day: dbDateToIso(r.day), text: r.text };
  },

  async updateRemark(id: string, text: string) {
    const r = await prisma.calendarRemark.update({ where: { id }, data: { text } });
    return { id: r.id, day: dbDateToIso(r.day), text: r.text };
  },

  async deleteRemark(id: string) {
    const existing = await prisma.calendarRemark.findUnique({ where: { id } });
    if (!existing) throw notFound('Remark not found');
    await prisma.calendarRemark.delete({ where: { id } });
    return { deleted: true };
  },
};

function nextMonth(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
}
