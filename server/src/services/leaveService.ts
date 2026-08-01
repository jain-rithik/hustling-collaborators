import { DateTime } from 'luxon';
import { IST_TZ, type LeaveType } from '@hc/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { dbDateToIso, isoToDbDate } from '../lib/dates.js';
import { notify } from '../lib/notify.js';
import { applyLeaveDeduction, computeBalance, round2 } from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

type Tx = Prisma.TransactionClient | PrismaClient;

const BALANCE_AFFECTING: LeaveType[] = ['pl', 'half_day', 'comp_off'];

function dayCount(startIso: string, endIso: string): number {
  const s = DateTime.fromISO(startIso, { zone: IST_TZ });
  const e = DateTime.fromISO(endIso, { zone: IST_TZ });
  return Math.round(e.diff(s, 'days').days) + 1;
}

/** PL balance = ledger sum EXCLUDING lwp-typed entries (LWP never touches PL). */
function plBalance(entries: { amount: unknown; leaveType: LeaveType | null }[]): number {
  return computeBalance(
    entries.filter((e) => e.leaveType !== 'lwp').map((e) => ({ amount: Number(e.amount) })),
  );
}

async function assertApprover(approver: AuthContext, userId: string) {
  if (approver.isAdmin) return;
  const p = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { reportingManagerId: true },
  });
  if (p?.reportingManagerId === approver.id) return;
  throw forbidden('Only the reporting manager or an admin can decide this');
}

/** Post the ledger effects of an approved balance-affecting leave, inside a transaction. */
async function postDeduction(
  tx: Tx,
  userId: string,
  leaveType: LeaveType,
  days: number,
  effectiveDate: Date,
  sourceLeaveRequestId: string,
  employmentType: string,
  allowAdvance: boolean,
) {
  const ledger = await tx.leaveLedger.findMany({
    where: { userId },
    select: { amount: true, leaveType: true },
  });
  const balance = plBalance(ledger);
  const credits = await tx.compOffCredit.findMany({
    where: { userId, consumed: false, expiresOn: { gte: effectiveDate } },
    orderBy: [{ expiresOn: 'asc' }, { createdAt: 'asc' }],
  });

  const split = applyLeaveDeduction(
    days,
    { compOff: credits.length, pl: Math.max(balance, 0) },
    { allowAdvance, advanceCap: employmentType === 'full_time' ? 5 : 0 },
  );

  // Consume comp-off (indivisible whole days), FIFO by expiry.
  for (const c of credits.slice(0, split.fromCompOff)) {
    await tx.compOffCredit.update({
      where: { id: c.id },
      data: { consumed: true, consumedByLeaveRequestId: sourceLeaveRequestId, consumedOn: effectiveDate },
    });
  }

  const plUsed = round2(split.fromPl + split.fromAdvance);
  let balanceAfter = balance;
  if (plUsed > 0) {
    balanceAfter = round2(balance - plUsed);
    await tx.leaveLedger.create({
      data: {
        userId,
        effectiveDate,
        entryType: 'deduction',
        leaveType: 'pl',
        amount: -plUsed,
        balanceAfter,
        sourceLeaveRequestId,
        note: `Leave taken (${leaveType})`,
      },
    });
  }
  if (split.fromLwp > 0) {
    await tx.leaveLedger.create({
      data: {
        userId,
        effectiveDate,
        entryType: 'deduction',
        leaveType: 'lwp',
        amount: -split.fromLwp,
        balanceAfter, // PL unchanged by LWP
        sourceLeaveRequestId,
        note: 'LWP portion of leave',
      },
    });
  }
  return split;
}

function toDto(r: {
  id: string;
  userId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  isHalfDay: boolean;
  requestedDays: unknown;
  reason: string;
  status: string;
  approverId: string | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    userId: r.userId,
    leaveType: r.leaveType,
    startDate: dbDateToIso(r.startDate),
    endDate: dbDateToIso(r.endDate),
    isHalfDay: r.isHalfDay,
    requestedDays: Number(r.requestedDays),
    reason: r.reason,
    status: r.status,
    approverId: r.approverId,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export const leaveService = {
  async list(query: { userId?: string; status?: string }, viewer: AuthContext) {
    const userId = query.userId ?? viewer.id;
    if (userId !== viewer.id && !viewer.isAdmin) await assertApprover(viewer, userId);
    const rows = await prisma.leaveRequest.findMany({
      where: { userId, ...(query.status ? { status: query.status as never } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  },

  async create(
    input: {
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      isHalfDay: boolean;
      reason: string;
    },
    viewer: AuthContext,
  ) {
    if (input.isHalfDay && input.startDate !== input.endDate) {
      throw badRequest('A half-day leave must be a single day');
    }
    const days = input.isHalfDay ? 0.5 : dayCount(input.startDate, input.endDate);
    const request = await prisma.leaveRequest.create({
      data: {
        userId: viewer.id,
        leaveType: input.leaveType,
        startDate: isoToDbDate(input.startDate),
        endDate: isoToDbDate(input.endDate),
        isHalfDay: input.isHalfDay,
        requestedDays: days,
        reason: input.reason,
      },
    });
    // Notify the reporting manager.
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: viewer.id },
      select: { reportingManagerId: true, fullName: true },
    });
    if (profile?.reportingManagerId) {
      await notify(
        profile.reportingManagerId,
        'leave_request',
        'New leave request',
        `${profile.fullName} requested ${days} day(s) of ${input.leaveType}`,
        { leaveRequestId: request.id },
      );
    }
    return toDto(request);
  },

  async approve(id: string, approver: AuthContext, note?: string) {
    const req = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: { include: { profile: true } } },
    });
    if (!req) throw notFound('Leave request not found');
    if (req.status !== 'pending') throw conflict('This request is already decided');
    await assertApprover(approver, req.userId);

    const employmentType = req.user.profile?.employmentType ?? 'full_time';
    await prisma.$transaction(async (tx) => {
      if (BALANCE_AFFECTING.includes(req.leaveType)) {
        await postDeduction(
          tx,
          req.userId,
          req.leaveType,
          Number(req.requestedDays),
          req.startDate,
          req.id,
          employmentType,
          false,
        );
      } else if (req.leaveType === 'lwp') {
        await tx.leaveLedger.create({
          data: {
            userId: req.userId,
            effectiveDate: req.startDate,
            entryType: 'deduction',
            leaveType: 'lwp',
            amount: -Number(req.requestedDays),
            balanceAfter: plBalance(
              await tx.leaveLedger.findMany({ where: { userId: req.userId }, select: { amount: true, leaveType: true } }),
            ),
            sourceLeaveRequestId: req.id,
            note: 'Leave without pay',
          },
        });
      }
      // optional_holiday / birthday / bereavement / maternity / paternity: recorded, no PL impact.
      await tx.leaveRequest.update({
        where: { id },
        data: { status: 'approved', approverId: approver.id, decidedAt: new Date(), decisionNote: note },
      });
    });

    await notify(req.userId, 'leave_decided', 'Leave approved 🎉', 'Your leave request was approved', {
      leaveRequestId: req.id,
    });
    return { ok: true, memeEvent: 'leave_approved' as const };
  },

  async reject(id: string, approver: AuthContext, note?: string) {
    const req = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw notFound('Leave request not found');
    if (req.status !== 'pending') throw conflict('This request is already decided');
    await assertApprover(approver, req.userId);
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'rejected', approverId: approver.id, decidedAt: new Date(), decisionNote: note },
    });
    await notify(req.userId, 'leave_decided', 'Leave not approved', note ?? 'Your leave request was rejected', {
      leaveRequestId: req.id,
    });
    return toDto(updated);
  },

  async cancel(id: string, viewer: AuthContext) {
    const req = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw notFound('Leave request not found');
    if (req.userId !== viewer.id) throw forbidden();
    if (req.status !== 'pending') throw conflict('Only a pending request can be cancelled');
    const updated = await prisma.leaveRequest.update({ where: { id }, data: { status: 'cancelled' } });
    return toDto(updated);
  },

  async manual(
    input: {
      userId: string;
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      isHalfDay: boolean;
      reason: string;
    },
    admin: AuthContext,
  ) {
    const days = input.isHalfDay ? 0.5 : dayCount(input.startDate, input.endDate);
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: input.userId },
      select: { employmentType: true },
    });
    if (!profile) throw notFound('Employee not found');
    const request = await prisma.$transaction(async (tx) => {
      const req = await tx.leaveRequest.create({
        data: {
          userId: input.userId,
          leaveType: input.leaveType,
          startDate: isoToDbDate(input.startDate),
          endDate: isoToDbDate(input.endDate),
          isHalfDay: input.isHalfDay,
          requestedDays: days,
          reason: input.reason,
          status: 'approved',
          approverId: admin.id,
          decidedAt: new Date(),
        },
      });
      if (BALANCE_AFFECTING.includes(input.leaveType)) {
        await postDeduction(tx, input.userId, input.leaveType, days, req.startDate, req.id, profile.employmentType, true);
      } else if (input.leaveType === 'lwp') {
        await tx.leaveLedger.create({
          data: {
            userId: input.userId,
            effectiveDate: req.startDate,
            entryType: 'deduction',
            leaveType: 'lwp',
            amount: -days,
            balanceAfter: plBalance(
              await tx.leaveLedger.findMany({ where: { userId: input.userId }, select: { amount: true, leaveType: true } }),
            ),
            sourceLeaveRequestId: req.id,
            note: 'Admin-added LWP',
          },
        });
      }
      return req;
    });
    return toDto(request);
  },

  async adjust(input: { userId: string; amount: number; note: string }, admin: AuthContext) {
    const ledger = await prisma.leaveLedger.findMany({
      where: { userId: input.userId },
      select: { amount: true, leaveType: true },
    });
    const balanceAfter = round2(plBalance(ledger) + input.amount);
    const entry = await prisma.leaveLedger.create({
      data: {
        userId: input.userId,
        effectiveDate: new Date(),
        entryType: 'adjustment',
        leaveType: 'pl',
        amount: input.amount,
        balanceAfter,
        createdBy: admin.id,
        note: input.note,
      },
    });
    return { id: entry.id, balanceAfter };
  },

  async deleteLedger(id: string) {
    await prisma.leaveLedger.delete({ where: { id } });
    return { deleted: true };
  },
};
