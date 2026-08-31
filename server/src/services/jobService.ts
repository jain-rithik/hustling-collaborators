import type { EntitlementLeaveType } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import {
  computeBalance,
  monthlyAccrualSchedule,
  noticeMonthAccrualIsUnpaid,
  noticeMonthStart,
  round2,
} from '../domain/index.js';
import { notify } from '../lib/notify.js';

/** Scheduled jobs. All are idempotent + self-healing (safe to re-run / after a missed cron). */
export const jobService = {
  /**
   * Post any missing opening/accrual/expiry ledger entries for every employee up to today, per
   * entitlement pool (Privilege and Sick are tracked separately for full-time staff; an intern's
   * single pool posts to Privilege).
   */
  async runAccrual() {
    const today = istToday();
    const profiles = await prisma.employeeProfile.findMany({
      select: {
        userId: true,
        joiningDate: true,
        employmentType: true,
        noticeStartDate: true,
      },
    });
    let posted = 0;
    for (const p of profiles) {
      const schedule = monthlyAccrualSchedule(dbDateToIso(p.joiningDate), p.employmentType, today);
      const existing = await prisma.leaveLedger.findMany({
        where: { userId: p.userId, entryType: { in: ['opening', 'accrual', 'expiry'] } },
        select: { effectiveDate: true, entryType: true, leaveType: true },
      });
      const seen = new Set(
        existing.map((e) => `${dbDateToIso(e.effectiveDate)}:${e.entryType}:${e.leaveType ?? 'pl'}`),
      );
      const ledger = await prisma.leaveLedger.findMany({
        where: { userId: p.userId },
        select: { amount: true, leaveType: true },
      });
      const balance: Record<EntitlementLeaveType, number> = {
        pl: computeBalance(
          ledger
            .filter((e) => e.leaveType !== 'lwp' && e.leaveType !== 'sick')
            .map((e) => ({ amount: Number(e.amount) })),
        ),
        sick: computeBalance(
          ledger.filter((e) => e.leaveType === 'sick').map((e) => ({ amount: Number(e.amount) })),
        ),
      };

      for (const e of schedule) {
        if (seen.has(`${e.effectiveDate}:${e.entryType}:${e.leaveType}`)) continue;
        balance[e.leaveType] = round2(balance[e.leaveType] + e.amount);
        await prisma.leaveLedger.create({
          data: {
            userId: p.userId,
            effectiveDate: isoToDbDate(e.effectiveDate),
            entryType: e.entryType,
            leaveType: e.leaveType,
            amount: e.amount,
            balanceAfter: balance[e.leaveType],
            note: e.note,
          },
        });
        posted++;
      }

      // Notice starting on or before the 15th → that month's credit was never really earned.
      if (p.noticeStartDate) {
        posted += await reverseNoticeMonthAccrual(p.userId, dbDateToIso(p.noticeStartDate), balance);
      }
    }
    return { posted };
  },
};

/**
 * Reverse the leave credited in the month a notice period began, when notice started on or
 * before the 15th (v4 change log). Idempotent: the reversal is keyed on the ledger note.
 */
export async function reverseNoticeMonthAccrual(
  userId: string,
  noticeStartDate: string,
  balance: Record<EntitlementLeaveType, number>,
): Promise<number> {
  if (!noticeMonthAccrualIsUnpaid(noticeStartDate)) return 0;
  const monthStart = noticeMonthStart(noticeStartDate);
  const effectiveDate = isoToDbDate(monthStart);

  const credits = await prisma.leaveLedger.findMany({
    where: { userId, effectiveDate, entryType: { in: ['opening', 'accrual'] } },
    select: { amount: true, leaveType: true },
  });
  if (!credits.length) return 0;
  const already = await prisma.leaveLedger.count({
    where: { userId, effectiveDate, entryType: 'clawback' },
  });
  if (already) return 0;

  let posted = 0;
  for (const c of credits) {
    const pool: EntitlementLeaveType = c.leaveType === 'sick' ? 'sick' : 'pl';
    const amount = round2(-Number(c.amount));
    balance[pool] = round2(balance[pool] + amount);
    await prisma.leaveLedger.create({
      data: {
        userId,
        effectiveDate,
        entryType: 'clawback',
        leaveType: pool,
        amount,
        balanceAfter: balance[pool],
        note: 'Notice period started on or before the 15th — this month’s leave credit reversed',
      },
    });
    posted++;
  }
  if (posted) {
    await notify(
      userId,
      'leave_decided',
      'Leave credit adjusted',
      'Your leave earned this month has been reversed as per policy, since you have not completed more than 15 days in the month.',
      { noticeStartDate },
    );
  }
  return posted;
}
