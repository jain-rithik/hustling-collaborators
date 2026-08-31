import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import { auth, login, prisma, PW, resetDb, type Fixture } from './helpers.js';

// Only runs when a Postgres test DB is provided (CI). Keeps local `npm test` green without a DB.
const RUN = !!process.env.RUN_API_TESTS;

/**
 * The leave policy is all about *when* a request is raised, so this suite drives the clock
 * instead of the wall. Every service reads "now" through lib/clock, so replacing that one
 * module makes the whole policy engine deterministic end to end.
 */
const clock = vi.hoisted(() => ({ iso: '2026-09-10T09:00' }));
vi.mock('../../src/lib/clock.js', async () => {
  const { DateTime } = await import('luxon');
  const now = () => DateTime.fromISO(clock.iso, { zone: 'Asia/Kolkata' });
  return { systemClock: { now }, fixedClock: () => ({ now }) };
});

const at = (iso: string) => {
  clock.iso = iso;
};

describe.skipIf(!RUN)('v4 — leave policy', () => {
  let app: Express;
  let fx: Fixture;
  let founderT = '';
  let m1T = '';
  let internT = '';
  let probieT = '';
  let leaverT = '';
  let m1Id = '';
  let internId = '';

  const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

  beforeAll(async () => {
    const { createApp } = await import('../../src/app.js');
    app = createApp();
    fx = await resetDb();

    const hash = await bcrypt.hash(PW, 10);
    const extra = async (
      email: string,
      profile: {
        fullName: string;
        employmentType: 'intern' | 'full_time';
        joiningDate: string;
        probationEndDate?: string;
        noticeStartDate?: string;
        noticeLastDate?: string;
      },
    ) => {
      const user = await prisma.user.create({ data: { email, passwordHash: hash, role: 'team_member' } });
      await prisma.employeeProfile.create({
        data: {
          userId: user.id,
          fullName: profile.fullName,
          employmentType: profile.employmentType,
          joiningDate: d(profile.joiningDate),
          probationEndDate: profile.probationEndDate ? d(profile.probationEndDate) : null,
          noticeStartDate: profile.noticeStartDate ? d(profile.noticeStartDate) : null,
          noticeLastDate: profile.noticeLastDate ? d(profile.noticeLastDate) : null,
        },
      });
      return user.id;
    };

    internId = await extra('intern@test.dev', {
      fullName: 'The Intern',
      employmentType: 'intern',
      joiningDate: '2026-06-01',
      probationEndDate: '2026-07-31',
    });
    await extra('probie@test.dev', {
      fullName: 'Still On Probation',
      employmentType: 'full_time',
      joiningDate: '2026-08-01',
      probationEndDate: '2026-10-31',
    });
    await extra('leaver@test.dev', {
      fullName: 'Serving Notice',
      employmentType: 'full_time',
      joiningDate: '2025-04-01',
      noticeStartDate: '2026-09-05',
      noticeLastDate: '2026-10-04',
    });

    founderT = await login(app, fx.founder);
    m1T = await login(app, fx.member1);
    internT = await login(app, 'intern@test.dev');
    probieT = await login(app, 'probie@test.dev');
    leaverT = await login(app, 'leaver@test.dev');
    m1Id = (await prisma.user.findUniqueOrThrow({ where: { email: fx.member1 } })).id;

    // Member One also holds Sick Leave, so a sick day can be paid from the right pool.
    await prisma.leaveLedger.create({
      data: {
        userId: m1Id,
        effectiveDate: d('2026-04-01'),
        entryType: 'opening',
        leaveType: 'sick',
        amount: 5,
        balanceAfter: 5,
        note: 'seed sick',
      },
    });
  });

  beforeEach(() => at('2026-09-10T09:00'));

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const raise = (token: string, body: Record<string, unknown>) =>
    request(app)
      .post('/api/v1/leave/requests')
      .set(auth(token))
      .send({ isHalfDay: false, reason: 'Personal', ...body });

  describe('entitlements', () => {
    it('gives a full-time member 11 Privilege and 7 Sick as separate pools', async () => {
      const res = await request(app).get(`/api/v1/leave/balances/${m1Id}`).set(auth(m1T));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        employmentType: 'full_time',
        sharedPool: false,
        privilege: { total: 11, remaining: 10 },
        sick: { total: 7, remaining: 5 },
        advanceCap: 5,
      });
    });

    it('gives an intern one shared pool of 4 across Privilege and Sick', async () => {
      const res = await request(app).get(`/api/v1/leave/balances/${internId}`).set(auth(internT));
      expect(res.body).toMatchObject({
        employmentType: 'intern',
        sharedPool: true,
        privilege: { total: 4 },
        sick: { total: 4 },
        advanceCap: 0,
      });
      // Both rows read the same number because they are the same pool.
      expect(res.body.sick.remaining).toBe(res.body.privilege.remaining);
    });

    it('keeps a balance private from a teammate', async () => {
      const m2T = await login(app, fx.member2);
      expect((await request(app).get(`/api/v1/leave/balances/${m1Id}`).set(auth(m2T))).status).toBe(403);
    });
  });

  describe('sick leave is a same-day event', () => {
    it('cannot be booked for tomorrow', async () => {
      const res = await raise(m1T, { leaveType: 'sick', startDate: '2026-09-11', endDate: '2026-09-11' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/only be applied for today/i);
    });

    it('cannot be filed before 5:30 AM', async () => {
      at('2026-09-10T05:00');
      const res = await raise(m1T, { leaveType: 'sick', startDate: '2026-09-10', endDate: '2026-09-10' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/5:30 AM/);
    });

    it('stays paid when it is raised before 9:30 AM', async () => {
      at('2026-09-10T09:15');
      const res = await raise(m1T, { leaveType: 'sick', startDate: '2026-09-10', endDate: '2026-09-10' });
      expect(res.status).toBe(201);
      expect(res.body.appliedAs).toBe('sick');
      expect(res.body.notices).toEqual([]);
    });

    it('becomes Leave Without Pay after 9:30 AM, with the policy wording', async () => {
      at('2026-09-10T10:00');
      const res = await raise(m1T, { leaveType: 'sick', startDate: '2026-09-10', endDate: '2026-09-10' });
      expect(res.status).toBe(201);
      expect(res.body.appliedAs).toBe('lwp');
      expect(res.body.convertedToLwp).toBe(true);
      expect(res.body.notices).toContain(
        'Leave Request Sent. If approved so will be considered as Leave without pay - since it has not been applied before 9:30 Am.',
      );
    });
  });

  describe('privilege leave and half days answer to different notice periods', () => {
    it('stays paid with 5 clear calendar days', async () => {
      const res = await raise(m1T, { leaveType: 'pl', startDate: '2026-09-20', endDate: '2026-09-20' });
      expect(res.body.appliedAs).toBe('pl');
      expect(res.body.notices).toEqual([]);
    });

    it('becomes Leave Without Pay inside 5 days', async () => {
      const res = await raise(m1T, { leaveType: 'pl', startDate: '2026-09-12', endDate: '2026-09-12' });
      expect(res.body.appliedAs).toBe('lwp');
      expect(res.body.notices[0]).toMatch(/5 calendar days prior/);
    });

    it('needs only 24 hours for a half day — the 5-day rule does not apply to it', async () => {
      const res = await raise(m1T, {
        leaveType: 'pl',
        startDate: '2026-09-12',
        endDate: '2026-09-12',
        isHalfDay: true,
        halfDayArrival: '10:30',
        halfDayLeave: '14:00',
      });
      expect(res.body.appliedAs).toBe('pl');
      expect(res.body.notices).toEqual([]);
    });

    it('a half day for the 30th raised after 2 PM on the 29th is unpaid', async () => {
      at('2026-09-29T15:00');
      const res = await raise(m1T, {
        leaveType: 'pl',
        startDate: '2026-09-30',
        endDate: '2026-09-30',
        isHalfDay: true,
        halfDayArrival: '10:30',
        halfDayLeave: '14:00',
      });
      expect(res.body.appliedAs).toBe('lwp');
      expect(res.body.notices[0]).toMatch(/^Half day - Leave without pay/);
    });
  });

  describe('optional holidays', () => {
    it('is unpaid when claimed inside 5 days', async () => {
      await prisma.holiday.create({ data: { day: d('2026-09-12'), name: 'Onam', type: 'optional_holiday' } });
      const res = await raise(m1T, {
        leaveType: 'optional_holiday',
        startDate: '2026-09-12',
        endDate: '2026-09-12',
      });
      expect(res.status).toBe(201);
      expect(res.body.appliedAs).toBe('lwp');
      expect(res.body.notices[0]).toMatch(/5 calendar days prior/);
    });

    it('stays paid with more notice', async () => {
      await prisma.holiday.create({ data: { day: d('2026-10-20'), name: 'Diwali (optional)', type: 'optional_holiday' } });
      const res = await raise(m1T, {
        leaveType: 'optional_holiday',
        startDate: '2026-10-20',
        endDate: '2026-10-20',
      });
      expect(res.body.appliedAs).toBe('optional_holiday');
      expect(res.body.notices).toEqual([]);
    });
  });

  describe('probation and notice period', () => {
    it('makes every paid leave unpaid during probation', async () => {
      const res = await raise(probieT, { leaveType: 'pl', startDate: '2026-09-20', endDate: '2026-09-20' });
      expect(res.body.appliedAs).toBe('lwp');
      expect(res.body.notices[0]).toMatch(/probation period is Leave Without Pay/);
    });

    it('applies to bereavement too', async () => {
      const res = await raise(probieT, {
        leaveType: 'bereavement',
        startDate: '2026-09-20',
        endDate: '2026-09-20',
        bereavementRelationship: 'pet',
      });
      expect(res.body.appliedAs).toBe('lwp');
    });

    it('makes every leave unpaid while serving notice, with the policy wording', async () => {
      const res = await raise(leaverT, { leaveType: 'pl', startDate: '2026-09-20', endDate: '2026-09-20' });
      expect(res.body.appliedAs).toBe('lwp');
      expect(res.body.notices).toContain(
        'As per the policy, any leave taken and approved will be considered as leave without pay.',
      );
    });

    it('rebases every accrual onto the v4 entitlement model, keeping what was taken', async () => {
      // Simulate a ledger written under the old model: a stale 18-PL opening plus a real deduction.
      const stale = await prisma.leaveLedger.create({
        data: {
          userId: internId,
          effectiveDate: d('2026-06-01'),
          entryType: 'opening',
          leaveType: 'pl',
          amount: 18,
          balanceAfter: 18,
          note: 'legacy opening under the old model',
        },
      });
      const deduction = await prisma.leaveLedger.create({
        data: {
          userId: internId,
          effectiveDate: d('2026-07-06'),
          entryType: 'deduction',
          leaveType: 'pl',
          amount: -1,
          balanceAfter: 17,
          note: 'Leave taken',
        },
      });

      const res = await request(app)
        .post('/api/v1/internal/jobs/rebase-accrual')
        .set({ Authorization: `Bearer ${process.env.JOB_SECRET}` });
      expect(res.status).toBe(200);

      expect(await prisma.leaveLedger.findUnique({ where: { id: stale.id } })).toBeNull();
      // What the member actually took survives untouched.
      expect(await prisma.leaveLedger.findUnique({ where: { id: deduction.id } })).not.toBeNull();

      // The intern is back on the v4 model: +1 a month to a cap of 4, minus the day taken.
      const balances = await request(app).get(`/api/v1/leave/balances/${internId}`).set(auth(internT));
      expect(balances.body.privilege).toEqual({ total: 4, remaining: 3 });
    });

    it('reverses the notice month’s credit when notice started on or before the 15th', async () => {
      const res = await request(app)
        .post('/api/v1/internal/jobs/monthly-accrual')
        .set({ Authorization: `Bearer ${process.env.JOB_SECRET}` });
      expect(res.status).toBe(200);

      const clawbacks = await prisma.leaveLedger.findMany({
        where: { entryType: 'clawback', userId: { not: undefined } },
      });
      const leaver = await prisma.user.findUniqueOrThrow({ where: { email: 'leaver@test.dev' } });
      const theirs = clawbacks.filter((c) => c.userId === leaver.id);
      expect(theirs.length).toBeGreaterThan(0);
      expect(theirs.every((c) => Number(c.amount) < 0)).toBe(true);
      expect(theirs.every((c) => c.effectiveDate.toISOString().slice(0, 10) === '2026-09-01')).toBe(true);

      // Idempotent: a second run must not double-reverse.
      await request(app)
        .post('/api/v1/internal/jobs/monthly-accrual')
        .set({ Authorization: `Bearer ${process.env.JOB_SECRET}` });
      const again = await prisma.leaveLedger.count({ where: { entryType: 'clawback', userId: leaver.id } });
      expect(again).toBe(theirs.length);
    });
  });

  describe('approval draws on the right pool', () => {
    it('takes a sick day from Sick Leave, not Privilege', async () => {
      at('2026-09-10T09:15');
      const created = await raise(m1T, { leaveType: 'sick', startDate: '2026-09-10', endDate: '2026-09-10' });
      const before = await request(app).get(`/api/v1/leave/balances/${m1Id}`).set(auth(m1T));

      const approved = await request(app)
        .post(`/api/v1/leave/requests/${created.body.request.id}/approve`)
        .set(auth(founderT))
        .send({});
      expect(approved.status).toBe(200);

      const after = await request(app).get(`/api/v1/leave/balances/${m1Id}`).set(auth(m1T));
      expect(after.body.sick.remaining).toBe(before.body.sick.remaining - 1);
      expect(after.body.privilege.remaining).toBe(before.body.privilege.remaining);
    });

    it('lets an admin approve a policy-converted request as paid leave anyway', async () => {
      const created = await raise(m1T, { leaveType: 'pl', startDate: '2026-09-12', endDate: '2026-09-12' });
      expect(created.body.appliedAs).toBe('lwp');

      const before = await request(app).get(`/api/v1/leave/balances/${m1Id}`).set(auth(m1T));
      const approved = await request(app)
        .post(`/api/v1/leave/requests/${created.body.request.id}/approve`)
        .set(auth(founderT))
        .send({ leaveType: 'pl' });
      expect(approved.status).toBe(200);
      expect(approved.body.leaveType).toBe('pl');

      const after = await request(app).get(`/api/v1/leave/balances/${m1Id}`).set(auth(m1T));
      expect(after.body.privilege.remaining).toBe(before.body.privilege.remaining - 1);
    });

    it('refuses a leave-type override from a non-admin approver', async () => {
      const created = await raise(m1T, { leaveType: 'pl', startDate: '2026-09-25', endDate: '2026-09-25' });
      const managerT = await login(app, fx.manager);
      const res = await request(app)
        .post(`/api/v1/leave/requests/${created.body.request.id}/approve`)
        .set(auth(managerT))
        .send({ leaveType: 'lwp' });
      expect(res.status).toBe(403);
    });

    it('lets an admin re-classify a pending request', async () => {
      const created = await raise(m1T, { leaveType: 'pl', startDate: '2026-09-28', endDate: '2026-09-28' });
      const res = await request(app)
        .patch(`/api/v1/leave/requests/${created.body.request.id}/type`)
        .set(auth(founderT))
        .send({ leaveType: 'lwp' });
      expect(res.status).toBe(200);
      expect(res.body.request.leaveType).toBe('lwp');
    });
  });
});
