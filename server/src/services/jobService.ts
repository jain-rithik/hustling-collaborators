import { prisma } from '../lib/prisma.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { computeBalance, monthlyAccrualSchedule, round2 } from '../domain/index.js';

/** Scheduled jobs. All are idempotent + self-healing (safe to re-run / after a missed cron). */
export const jobService = {
  /** Post any missing opening/accrual/expiry ledger entries for every employee up to today. */
  async runAccrual() {
    const today = istToday();
    const profiles = await prisma.employeeProfile.findMany({
      select: { userId: true, joiningDate: true, employmentType: true },
    });
    let posted = 0;
    for (const p of profiles) {
      const schedule = monthlyAccrualSchedule(dbDateToIso(p.joiningDate), p.employmentType, today);
      const existing = await prisma.leaveLedger.findMany({
        where: { userId: p.userId, entryType: { in: ['opening', 'accrual', 'expiry'] } },
        select: { effectiveDate: true, entryType: true },
      });
      const seen = new Set(existing.map((e) => `${dbDateToIso(e.effectiveDate)}:${e.entryType}`));
      const ledger = await prisma.leaveLedger.findMany({
        where: { userId: p.userId },
        select: { amount: true, leaveType: true },
      });
      let balance = computeBalance(
        ledger.filter((e) => e.leaveType !== 'lwp').map((e) => ({ amount: Number(e.amount) })),
      );
      for (const e of schedule) {
        if (seen.has(`${e.effectiveDate}:${e.entryType}`)) continue;
        balance = round2(balance + e.amount);
        await prisma.leaveLedger.create({
          data: {
            userId: p.userId,
            effectiveDate: isoToDbDate(e.effectiveDate),
            entryType: e.entryType,
            leaveType: e.entryType === 'expiry' ? null : 'pl',
            amount: e.amount,
            balanceAfter: balance,
            note: e.note,
          },
        });
        posted++;
      }
    }
    return { posted };
  },
};
