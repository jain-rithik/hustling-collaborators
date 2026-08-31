import { DateTime } from 'luxon';
import {
  BEREAVEMENT_MAX_DAYS,
  FT_ADVANCE_CAP_DAYS,
  IST_TZ,
  LEAVE_TYPE_LABELS,
  type EmploymentType,
  type EntitlementLeaveType,
  type LeaveType,
  OPTIONAL_HOLIDAY_CAP_PER_FY,
  PAID_LEAVE_TYPES,
} from '@hc/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { systemClock } from '../lib/clock.js';
import { notify, notifyMany } from '../lib/notify.js';
import {
  applyLeaveDeduction,
  canClaimOptionalHoliday,
  computeBalance,
  entitlementFor,
  financialYear,
  halfDayBecomesLwp,
  isLongLeave,
  isServingNotice,
  longLeaveNeedsReview,
  optionalHolidayWithinAdvanceWindow,
  plWithinAdvanceWindow,
  poolFor,
  probationBlocksPaidLeave,
  round2,
  sickLeaveBecomesLwp,
  sickLeaveNotSameDay,
  sickLeaveTooEarly,
  wfhTooSoon,
} from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

async function adminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { isActive: true, isAdmin: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

type Tx = Prisma.TransactionClient | PrismaClient;

/** Leave types that move an entitlement balance when approved. */
const BALANCE_AFFECTING: LeaveType[] = ['pl', 'sick', 'half_day', 'comp_off'];
const PAID: readonly LeaveType[] = PAID_LEAVE_TYPES;

/** The employee-facing copy for every automatic conversion to Leave Without Pay (v4 §Leave). */
export const LWP_NOTICES = {
  notice:
    'As per the policy, any leave taken and approved will be considered as leave without pay.',
  probation:
    'Leave taken during your probation period is Leave Without Pay. Paid leaves become available once probation is complete.',
  halfDay:
    'Half day - Leave without pay. A half day has to be informed at least 24 hours before you leave.',
  sick:
    'Leave Request Sent. If approved so will be considered as Leave without pay - since it has not been applied before 9:30 Am.',
  // A half day answers to its own 24-hour rule, not the 5-day one — see the ordering in `create`.
  privilege:
    'Leave Request Sent. If approved so will be considered as Leave without pay - since it has not been applied 5 calendar days prior.',
  optionalHoliday:
    'Leave Request Sent. If approved so will be considered as Leave without pay - since it has not been applied 5 calendar days prior.',
  noticeConverted:
    'Your last leave has been converted to Leave Without Pay as per policy, since you have not completed more than 15 days in the month.',
} as const;

function dayCount(startIso: string, endIso: string): number {
  const s = DateTime.fromISO(startIso, { zone: IST_TZ });
  const e = DateTime.fromISO(endIso, { zone: IST_TZ });
  return Math.round(e.diff(s, 'days').days) + 1;
}

/** Which entitlement pool a ledger row belongs to. Legacy rows with no type count as Privilege. */
function poolOfEntry(leaveType: LeaveType | null): EntitlementLeaveType | 'lwp' {
  if (leaveType === 'sick') return 'sick';
  if (leaveType === 'lwp') return 'lwp';
  return 'pl';
}

type LedgerRow = { amount: unknown; leaveType: LeaveType | null };

/** Per-pool balances from the ledger. LWP rows are a record of unpaid days, not a balance. */
function poolBalances(entries: LedgerRow[]): Record<EntitlementLeaveType, number> {
  const sum = (pool: EntitlementLeaveType) =>
    computeBalance(
      entries.filter((e) => poolOfEntry(e.leaveType) === pool).map((e) => ({ amount: Number(e.amount) })),
    );
  return { pl: sum('pl'), sick: sum('sick') };
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

/** The entitlement pool a given leave type draws on for a given employment type. */
function targetPool(leaveType: LeaveType, employmentType: EmploymentType): EntitlementLeaveType {
  return poolFor(leaveType === 'sick' ? 'sick' : 'pl', employmentType);
}

/** Post the ledger effects of an approved balance-affecting leave, inside a transaction. */
async function postDeduction(
  tx: Tx,
  userId: string,
  leaveType: LeaveType,
  days: number,
  effectiveDate: Date,
  sourceLeaveRequestId: string,
  employmentType: EmploymentType,
  allowAdvance: boolean,
) {
  const ledger = await tx.leaveLedger.findMany({
    where: { userId },
    select: { amount: true, leaveType: true },
  });
  const pool = targetPool(leaveType, employmentType);
  const balances = poolBalances(ledger);
  const balance = balances[pool];

  // Sick leave is a same-day event: it draws on its own pool and then falls to LWP. Comp-off
  // credits and the advance facility are for leave you plan, so neither applies to it.
  const useCompOff = leaveType !== 'sick';
  const credits = useCompOff
    ? await tx.compOffCredit.findMany({
        where: { userId, consumed: false, expiresOn: { gte: effectiveDate } },
        orderBy: [{ expiresOn: 'asc' }, { createdAt: 'asc' }],
      })
    : [];

  const split = applyLeaveDeduction(
    days,
    { compOff: credits.length, pl: Math.max(balance, 0) },
    {
      allowAdvance: allowAdvance && leaveType !== 'sick',
      advanceCap: employmentType === 'full_time' ? FT_ADVANCE_CAP_DAYS : 0,
    },
  );

  // Consume comp-off (indivisible whole days), FIFO by expiry.
  for (const c of credits.slice(0, split.fromCompOff)) {
    await tx.compOffCredit.update({
      where: { id: c.id },
      data: { consumed: true, consumedByLeaveRequestId: sourceLeaveRequestId, consumedOn: effectiveDate },
    });
  }

  const used = round2(split.fromPl + split.fromAdvance);
  let balanceAfter = balance;
  if (used > 0) {
    balanceAfter = round2(balance - used);
    await tx.leaveLedger.create({
      data: {
        userId,
        effectiveDate,
        entryType: 'deduction',
        leaveType: pool,
        amount: -used,
        balanceAfter,
        sourceLeaveRequestId,
        note: `Leave taken (${LEAVE_TYPE_LABELS[leaveType]})`,
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
        balanceAfter, // an entitlement pool is unchanged by LWP
        sourceLeaveRequestId,
        note: 'LWP portion of leave',
      },
    });
  }
  return split;
}

async function postLwp(tx: Tx, userId: string, days: number, effectiveDate: Date, requestId: string, note: string) {
  const ledger = await tx.leaveLedger.findMany({
    where: { userId },
    select: { amount: true, leaveType: true },
  });
  await tx.leaveLedger.create({
    data: {
      userId,
      effectiveDate,
      entryType: 'deduction',
      leaveType: 'lwp',
      amount: -days,
      balanceAfter: poolBalances(ledger).pl,
      sourceLeaveRequestId: requestId,
      note,
    },
  });
}

function toDto(r: {
  id: string;
  userId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  isHalfDay: boolean;
  halfDayArrival: string | null;
  halfDayLeave: string | null;
  isSick: boolean;
  bereavementRelationship: string | null;
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
    halfDayArrival: r.halfDayArrival,
    halfDayLeave: r.halfDayLeave,
    isSick: r.isSick,
    // Visible only to self / RM / Admin — the list & get endpoints already restrict to those viewers.
    bereavementRelationship: r.bereavementRelationship,
    requestedDays: Number(r.requestedDays),
    reason: r.reason,
    status: r.status,
    approverId: r.approverId,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

interface PolicyProfile {
  employmentType: EmploymentType;
  probationEndDate: string | null;
  noticeStartDate: string | null;
  noticeLastDate: string | null;
  reportingManagerId: string | null;
  fullName: string;
}

async function policyProfile(userId: string): Promise<PolicyProfile> {
  const p = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: {
      employmentType: true,
      probationEndDate: true,
      noticeStartDate: true,
      noticeLastDate: true,
      reportingManagerId: true,
      fullName: true,
    },
  });
  if (!p) throw notFound('Employee not found');
  return {
    employmentType: p.employmentType,
    probationEndDate: p.probationEndDate ? dbDateToIso(p.probationEndDate) : null,
    noticeStartDate: p.noticeStartDate ? dbDateToIso(p.noticeStartDate) : null,
    noticeLastDate: p.noticeLastDate ? dbDateToIso(p.noticeLastDate) : null,
    reportingManagerId: p.reportingManagerId,
    fullName: p.fullName,
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

  /**
   * Entitlements and what is left of them — what the leave form shows on the right of each
   * type ("8.5/11"). Interns see one shared Privilege+Sick pool of 4 on both rows.
   */
  async balances(userId: string) {
    const p = await policyProfile(userId);
    const ent = entitlementFor(p.employmentType);
    const today = istToday();
    const ledger = await prisma.leaveLedger.findMany({
      where: { userId },
      select: { amount: true, leaveType: true },
    });
    const balances = poolBalances(ledger);
    const credits = await prisma.compOffCredit.findMany({
      where: { userId, consumed: false, expiresOn: { gte: isoToDbDate(today) } },
      select: { id: true },
    });

    const privilegeRemaining = Math.max(0, balances.pl);
    const sickRemaining = ent.shared ? privilegeRemaining : Math.max(0, balances.sick);
    return {
      employmentType: p.employmentType,
      /** True when Privilege and Sick draw on the same pool (interns). */
      sharedPool: ent.shared,
      privilege: { total: ent.pl, remaining: privilegeRemaining },
      sick: { total: ent.shared ? ent.pl : ent.sick, remaining: sickRemaining },
      compOff: credits.length,
      advanceDebt: Math.max(0, -balances.pl),
      advanceCap: p.employmentType === 'full_time' ? FT_ADVANCE_CAP_DAYS : 0,
      probationEndDate: p.probationEndDate,
      onProbation: probationBlocksPaidLeave(p.probationEndDate, today),
      noticeStartDate: p.noticeStartDate,
      noticeLastDate: p.noticeLastDate,
      onNoticePeriod: isServingNotice(p.noticeStartDate, p.noticeLastDate, today),
    };
  },

  async create(
    input: {
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      isHalfDay: boolean;
      halfDayArrival?: string | null;
      halfDayLeave?: string | null;
      bereavementRelationship?: string | null;
      reason: string;
    },
    viewer: AuthContext,
  ) {
    if (input.isHalfDay && input.startDate !== input.endDate) {
      throw badRequest('A half-day leave must be a single day');
    }
    const now = systemClock.now();
    const today = istToday();
    const days = input.isHalfDay ? 0.5 : dayCount(input.startDate, input.endDate);
    const profile = await policyProfile(viewer.id);

    // ── Hard rules: these requests cannot be raised at all ────────────────────
    if (input.leaveType === 'wfh' && wfhTooSoon(input.startDate, now)) {
      throw badRequest('WFH must be requested at least 24 hours in advance.');
    }
    if (input.leaveType === 'bereavement' && days > BEREAVEMENT_MAX_DAYS) {
      throw badRequest(`Bereavement leave is capped at ${BEREAVEMENT_MAX_DAYS} working days.`);
    }
    if (input.leaveType === 'sick') {
      if (sickLeaveNotSameDay(input.startDate, today)) {
        throw badRequest('Sick leave can only be applied for today — it cannot be booked in advance.');
      }
      if (sickLeaveTooEarly(input.startDate, now)) {
        throw badRequest('Sick leave can only be applied from 5:30 AM on the day itself.');
      }
    }
    if (input.leaveType === 'optional_holiday') {
      const holiday = await prisma.holiday.findUnique({ where: { day: isoToDbDate(input.startDate) } });
      if (!holiday || holiday.type !== 'optional_holiday') {
        throw badRequest('Please choose one of the listed optional holidays.');
      }
      const fy = financialYear(input.startDate);
      const used = await prisma.leaveRequest.count({
        where: {
          userId: viewer.id,
          leaveType: 'optional_holiday',
          status: { in: ['pending', 'approved'] },
          startDate: { gte: isoToDbDate(fy.fyStart), lte: isoToDbDate(fy.fyEnd) },
        },
      });
      if (!canClaimOptionalHoliday(used)) {
        throw badRequest(
          `You have already used your ${OPTIONAL_HOLIDAY_CAP_PER_FY} optional holidays for this financial year.`,
        );
      }
    }

    // ── Soft rules: the request still goes through, but as Leave Without Pay ──
    let leaveType: LeaveType = input.leaveType;
    const notices: string[] = [];
    const toLwp = (message: string) => {
      if (leaveType !== 'lwp') leaveType = 'lwp';
      if (!notices.includes(message)) notices.push(message);
    };

    if (leaveType !== 'lwp' && leaveType !== 'wfh') {
      if (isServingNotice(profile.noticeStartDate, profile.noticeLastDate, input.startDate)) {
        toLwp(LWP_NOTICES.notice);
      } else if (PAID.includes(input.leaveType) && probationBlocksPaidLeave(profile.probationEndDate, input.startDate)) {
        toLwp(LWP_NOTICES.probation);
      } else if (input.isHalfDay && halfDayBecomesLwp(input.startDate, input.halfDayLeave, now)) {
        toLwp(LWP_NOTICES.halfDay);
      } else if (input.leaveType === 'sick' && sickLeaveBecomesLwp(input.startDate, today, now)) {
        toLwp(LWP_NOTICES.sick);
      } else if (input.leaveType === 'pl' && !input.isHalfDay && plWithinAdvanceWindow(input.startDate, today)) {
        toLwp(LWP_NOTICES.privilege);
      } else if (
        input.leaveType === 'optional_holiday' &&
        optionalHolidayWithinAdvanceWindow(input.startDate, today)
      ) {
        toLwp(LWP_NOTICES.optionalHoliday);
      }
    }

    // A long (>3 day) Privilege leave requested inside 15 days goes to Admin for manual review.
    const needsAdminReview =
      !input.isHalfDay && leaveType === 'pl' && isLongLeave(days) && longLeaveNeedsReview(input.startDate, today);
    if (needsAdminReview) {
      notices.push('Leave longer than 3 days needs 15 days notice, so your request has been sent to Admin for review.');
    }

    const request = await prisma.leaveRequest.create({
      data: {
        userId: viewer.id,
        leaveType,
        startDate: isoToDbDate(input.startDate),
        endDate: isoToDbDate(input.endDate),
        isHalfDay: input.isHalfDay,
        halfDayArrival: input.isHalfDay ? input.halfDayArrival ?? null : null,
        halfDayLeave: input.isHalfDay ? input.halfDayLeave ?? null : null,
        // Kept in sync with the leave type so older views that read this flag still work.
        isSick: input.leaveType === 'sick',
        bereavementRelationship:
          input.leaveType === 'bereavement' ? input.bereavementRelationship ?? null : null,
        requestedDays: days,
        reason: input.reason,
      },
    });

    // Notify the approver(s): the reporting manager, plus Admins when a review is required.
    const approvers = new Set<string>();
    if (profile.reportingManagerId) approvers.add(profile.reportingManagerId);
    if (needsAdminReview) (await adminIds()).forEach((id) => approvers.add(id));
    if (approvers.size) {
      await notifyMany(
        [...approvers],
        'leave_request',
        needsAdminReview ? 'Leave request needs review' : 'New leave request',
        `${profile.fullName} requested ${days} day(s) of ${LEAVE_TYPE_LABELS[leaveType]}${
          needsAdminReview ? ' — needs review (15-day notice)' : ''
        }.`,
        { leaveRequestId: request.id },
      );
    }
    // Tell the employee about any automatic conversion or routing.
    if (notices.length) {
      await notify(viewer.id, 'leave_decided', 'Update on your leave request', notices.join(' '), {
        leaveRequestId: request.id,
      });
    }
    return {
      request: toDto(request),
      notices,
      convertedToLwp: leaveType === 'lwp' && input.leaveType !== 'lwp',
      appliedAs: leaveType,
    };
  },

  async approve(id: string, approver: AuthContext, note?: string, overrideLeaveType?: LeaveType) {
    const req = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: { include: { profile: true } } },
    });
    if (!req) throw notFound('Leave request not found');
    if (req.status !== 'pending') throw conflict('This request is already decided');
    await assertApprover(approver, req.userId);
    // Admin may approve a request as a different type — that is how a leave the policy pushed
    // to LWP is granted as paid leave anyway (v4 change log).
    if (overrideLeaveType && !approver.isAdmin) throw forbidden('Only an admin can change the leave type');
    const leaveType: LeaveType = overrideLeaveType ?? req.leaveType;

    const employmentType = req.user.profile?.employmentType ?? 'full_time';
    await prisma.$transaction(async (tx) => {
      if (BALANCE_AFFECTING.includes(leaveType)) {
        await postDeduction(
          tx,
          req.userId,
          leaveType,
          Number(req.requestedDays),
          req.startDate,
          req.id,
          employmentType,
          false,
        );
      } else if (leaveType === 'lwp') {
        await postLwp(tx, req.userId, Number(req.requestedDays), req.startDate, req.id, 'Leave without pay');
      }
      // optional_holiday / bereavement / maternity / paternity / wfh: recorded, no balance impact.
      await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'approved',
          leaveType,
          approverId: approver.id,
          decidedAt: new Date(),
          decisionNote: note,
        },
      });
    });

    const changed = overrideLeaveType && overrideLeaveType !== req.leaveType;
    await notify(
      req.userId,
      'leave_decided',
      'Leave approved',
      changed
        ? `Your leave request has been approved as ${LEAVE_TYPE_LABELS[leaveType]}.`
        : 'Your leave request has been approved.',
      { leaveRequestId: req.id },
    );
    // Policy notice: leave during a notice period is unpaid because the member will not have
    // completed more than 15 days in the month (v4 change log).
    if (leaveType === 'lwp' && req.user.profile?.noticeStartDate) {
      await notify(req.userId, 'leave_decided', 'Leave converted to Leave Without Pay', LWP_NOTICES.noticeConverted, {
        leaveRequestId: req.id,
      });
    }
    return { ok: true, memeEvent: 'leave_approved' as const, leaveType };
  },

  /** Admin re-classifies a still-pending request before deciding it (v4 change log). */
  async setType(id: string, leaveType: LeaveType, admin: AuthContext) {
    if (!admin.isAdmin) throw forbidden('Only an admin can change the leave type');
    const req = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw notFound('Leave request not found');
    if (req.status !== 'pending') throw conflict('Only a pending request can be re-classified');
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { leaveType, isSick: leaveType === 'sick' },
    });
    await notify(
      req.userId,
      'leave_decided',
      'Leave type updated',
      `An admin changed your pending request to ${LEAVE_TYPE_LABELS[leaveType]}.`,
      { leaveRequestId: id },
    );
    return toDto(updated);
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
      halfDayArrival?: string | null;
      halfDayLeave?: string | null;
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
          halfDayArrival: input.isHalfDay ? input.halfDayArrival ?? null : null,
          halfDayLeave: input.isHalfDay ? input.halfDayLeave ?? null : null,
          isSick: input.leaveType === 'sick',
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
        await postLwp(tx, input.userId, days, req.startDate, req.id, 'Admin-added LWP');
      }
      return req;
    });
    return toDto(request);
  },

  async adjust(
    input: { userId: string; amount: number; leaveType?: EntitlementLeaveType; note: string },
    admin: AuthContext,
  ) {
    const pool: EntitlementLeaveType = input.leaveType ?? 'pl';
    const ledger = await prisma.leaveLedger.findMany({
      where: { userId: input.userId },
      select: { amount: true, leaveType: true },
    });
    const balanceAfter = round2(poolBalances(ledger)[pool] + input.amount);
    const entry = await prisma.leaveLedger.create({
      data: {
        userId: input.userId,
        effectiveDate: new Date(),
        entryType: 'adjustment',
        leaveType: pool,
        amount: input.amount,
        balanceAfter,
        createdBy: admin.id,
        note: input.note,
      },
    });
    return { id: entry.id, leaveType: pool, balanceAfter };
  },

  async deleteLedger(id: string) {
    await prisma.leaveLedger.delete({ where: { id } });
    return { deleted: true };
  },
};
