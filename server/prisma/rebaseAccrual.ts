/**
 * One-time maintenance: rebuild every leave accrual entry on the v4 entitlement model
 * (11 Privilege + 7 Sick per FY earned prorata for full-time staff; +1 a month to a shared
 * pool of 4 for interns). Ledgers written before v4 still hold the old 18-combined-Paid-Leave
 * credits, so the nightly accrual alone would leave a mix of both models.
 *
 * Only the entries the system generates are cleared — opening / accrual / expiry / clawback.
 * Deductions (leave actually taken) and manual Admin adjustments are never touched.
 * Idempotent: running it twice lands on the same balances.
 *
 * Exists alongside the `rebase-accrual` job endpoint because Render's free tier has no shell
 * and its instance sleeps — this path needs only a database URL, which is what the
 * "Rebase leave accrual" workflow has.
 *
 *   npm run db:rebase-accrual --workspace @hc/server
 */

// The work runs through the app's own service layer so it can never drift from what
// `monthly-accrual` does. That layer validates the API's auth secrets when it loads, so give
// them throwaway values first — this script never signs or verifies a token.
process.env.JWT_SECRET ||= 'maintenance-script-does-not-sign-tokens';
process.env.REFRESH_SECRET ||= 'maintenance-script-does-not-sign-tokens';
process.env.JOB_SECRET ||= 'maintenance-script-does-not-serve-requests';

export {}; // top-level await needs this file to be a module

const { prisma } = await import('../src/lib/prisma.js');
const { jobService } = await import('../src/services/jobService.js');

type Pools = { privilege: number; sick: number; lwp: number };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Balance per pool, the same way the app reads it: legacy rows with no type count as Privilege. */
async function balances(): Promise<Map<string, Pools>> {
  const rows = await prisma.leaveLedger.findMany({
    select: { userId: true, leaveType: true, amount: true },
  });
  const out = new Map<string, Pools>();
  for (const r of rows) {
    const p = out.get(r.userId) ?? { privilege: 0, sick: 0, lwp: 0 };
    const key = r.leaveType === 'sick' ? 'sick' : r.leaveType === 'lwp' ? 'lwp' : 'privilege';
    p[key] = round2(p[key] + Number(r.amount));
    out.set(r.userId, p);
  }
  return out;
}

const fmt = (p?: Pools) =>
  p ? `Privilege ${p.privilege}, Sick ${p.sick}` : 'Privilege 0, Sick 0';

async function main() {
  const people = await prisma.employeeProfile.findMany({
    select: { userId: true, fullName: true, employmentType: true },
    orderBy: { fullName: 'asc' },
  });
  const before = await balances();

  console.log('🔁 Rebasing leave accrual onto the v4 entitlement model…\n');
  const result = await jobService.rebaseAccrual();
  const after = await balances();

  for (const p of people) {
    console.log(
      `  ${p.fullName.padEnd(20)} ${p.employmentType.padEnd(10)} ` +
        `${fmt(before.get(p.userId)).padEnd(28)} →  ${fmt(after.get(p.userId))}`,
    );
  }

  const taken = await prisma.leaveLedger.count({ where: { entryType: 'deduction' } });
  const adjustments = await prisma.leaveLedger.count({ where: { entryType: 'adjustment' } });
  console.log(
    `\n✅ Removed ${result.removed} system-generated entries, posted ${result.posted} fresh ones.` +
      `\n   Left untouched: ${taken} deduction(s) and ${adjustments} manual adjustment(s).`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Rebase failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
