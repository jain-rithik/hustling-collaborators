import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { auth, login, prisma, resetDb, type Fixture } from './helpers.js';

// Only runs when a Postgres test DB is provided (CI). Keeps local `npm test` green without a DB.
const RUN = !!process.env.RUN_API_TESTS;

/** v4 change log: task scheduling & ordering, campaign details, profile privacy, admin notes. */
describe.skipIf(!RUN)('v4 — tasks, campaigns, profiles, admin', () => {
  let app: Express;
  let fx: Fixture;
  let founderT = '';
  let managerT = '';
  let m1T = '';
  let m1Id = '';

  beforeAll(async () => {
    const { createApp } = await import('../../src/app.js');
    app = createApp();
    fx = await resetDb();
    founderT = await login(app, fx.founder);
    managerT = await login(app, fx.manager);
    m1T = await login(app, fx.member1);
    m1Id = (await prisma.user.findUniqueOrThrow({ where: { email: fx.member1 } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const addTask = (token: string, body: Record<string, unknown>) =>
    request(app).post('/api/v1/tasks').set(auth(token)).send(body);

  describe('one person cannot be in two places at once', () => {
    it('rejects a task whose planned window overlaps another task that day', async () => {
      const first = await addTask(m1T, {
        title: 'Creator outreach',
        estimatedMinutes: 60,
        plannedStartTime: '10:00',
        plannedEndTime: '11:00',
      });
      expect(first.status).toBe(201);

      const clash = await addTask(m1T, {
        title: 'Overlapping work',
        estimatedMinutes: 60,
        plannedStartTime: '10:30',
        plannedEndTime: '11:30',
      });
      expect(clash.status).toBe(409);
      expect(clash.body.error.message).toContain('Creator outreach');
    });

    it('allows a task that starts exactly when the previous one ends', async () => {
      const res = await addTask(m1T, {
        title: 'Deck review',
        estimatedMinutes: 60,
        plannedStartTime: '11:00',
        plannedEndTime: '12:00',
      });
      expect(res.status).toBe(201);
    });

    it('lets a task without a planned window slot in anywhere', async () => {
      const res = await addTask(m1T, { title: 'Ad-hoc follow-ups', estimatedMinutes: 30 });
      expect(res.status).toBe(201);
    });
  });

  describe('the day’s sequence only changes when the member changes it', () => {
    it('keeps a started task exactly where it was in the list', async () => {
      const before = await request(app).get(`/api/v1/tasks?date=${today()}`).set(auth(m1T));
      const ids = before.body.tasks.map((t: { id: string }) => t.id);
      expect(ids.length).toBeGreaterThanOrEqual(3);

      const started = await request(app).post(`/api/v1/tasks/${ids[0]}/start`).set(auth(m1T));
      expect(started.status).toBe(200);

      const after = await request(app).get(`/api/v1/tasks?date=${today()}`).set(auth(m1T));
      expect(after.body.tasks.map((t: { id: string }) => t.id)).toEqual(ids);
    });

    it('saves a manual top-to-bottom order', async () => {
      const before = await request(app).get(`/api/v1/tasks?date=${today()}`).set(auth(m1T));
      const ids: string[] = before.body.tasks.map((t: { id: string }) => t.id);
      const reversed = [...ids].reverse();

      const res = await request(app).post('/api/v1/tasks/reorder').set(auth(m1T)).send({ ids: reversed });
      expect(res.status).toBe(200);

      const after = await request(app).get(`/api/v1/tasks?date=${today()}`).set(auth(m1T));
      expect(after.body.tasks.map((t: { id: string }) => t.id)).toEqual(reversed);
    });

    it('refuses to reorder somebody else’s tasks', async () => {
      const mine = await request(app).get(`/api/v1/tasks?date=${today()}`).set(auth(m1T));
      const ids = mine.body.tasks.map((t: { id: string }) => t.id);
      const res = await request(app).post('/api/v1/tasks/reorder').set(auth(managerT)).send({ ids });
      expect(res.status).toBe(403);
    });
  });

  describe('unfinished work from earlier days stays visible', () => {
    it('carries yesterday’s open task onto today’s list, flagged', async () => {
      const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      await addTask(m1T, {
        title: 'Yesterday’s leftover',
        estimatedMinutes: 45,
        workDate: yesterday,
        plannedStartTime: '15:00',
        plannedEndTime: '15:45',
      });

      const plain = await request(app).get(`/api/v1/tasks?date=${today()}`).set(auth(m1T));
      expect(plain.body.tasks.some((t: { title: string }) => t.title === 'Yesterday’s leftover')).toBe(false);

      const withCarry = await request(app).get(`/api/v1/tasks?date=${today()}&carryOver=1`).set(auth(m1T));
      const carried = withCarry.body.tasks.find((t: { title: string }) => t.title === 'Yesterday’s leftover');
      expect(carried).toBeDefined();
      expect(carried.carriedOver).toBe(true);
      expect(carried.workDate).toBe(yesterday);
    });

    it('gives the member their past-30-day log grouped into date tabs', async () => {
      const res = await request(app).get('/api/v1/tasks/history').set(auth(m1T));
      expect(res.status).toBe(200);
      expect(res.body.days.length).toBeGreaterThanOrEqual(2);
      const day = res.body.days[0];
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('total');
      expect(day).toHaveProperty('pending');
      expect(Array.isArray(day.tasks)).toBe(true);
    });

    it('lets an admin read a member’s history, but not a teammate', async () => {
      expect((await request(app).get(`/api/v1/tasks/history?ownerId=${m1Id}`).set(auth(founderT))).status).toBe(200);
      const m2T = await login(app, fx.member2);
      expect((await request(app).get(`/api/v1/tasks/history?ownerId=${m1Id}`).set(auth(m2T))).status).toBe(403);
    });
  });

  describe('campaigns show who and when without tapping in', () => {
    let campaignId = '';

    it('creates a campaign and returns the lead and members by name', async () => {
      const res = await request(app)
        .post('/api/v1/campaigns')
        .set(auth(managerT))
        .send({
          name: 'Festive Push',
          clientName: 'Acme Foods',
          leadId: m1Id,
          deadline: '2026-12-01',
          memberIds: [],
        });
      expect(res.status).toBe(201);
      campaignId = res.body.campaign.id;
      // The lead is always part of the team, even when no members were ticked.
      expect(res.body.campaign.leadName).toBe('Member One');
      expect(res.body.campaign.memberNames).toContain('Member One');
      expect(res.body.campaign.members[0]).toMatchObject({ userId: m1Id, fullName: 'Member One' });
    });

    it('replaces the team on update and keeps the lead in it', async () => {
      const m2Id = (await prisma.user.findUniqueOrThrow({ where: { email: fx.member2 } })).id;
      const res = await request(app)
        .patch(`/api/v1/campaigns/${campaignId}`)
        .set(auth(managerT))
        .send({ memberIds: [m2Id] });
      expect(res.status).toBe(200);
      expect(res.body.campaign.memberNames.sort()).toEqual(['Member One', 'Member Two']);
    });

    it('lets anyone on the campaign add and read the brief', async () => {
      const added = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/notes`)
        .set(auth(m1T))
        .send({ text: 'Brief: https://docs.google.com/spreadsheets/d/abc123' });
      expect(added.status).toBe(201);
      expect(added.body.note.authorName).toBe('Member One');

      const list = await request(app).get(`/api/v1/campaigns/${campaignId}/notes`).set(auth(managerT));
      expect(list.status).toBe(200);
      expect(list.body.notes).toHaveLength(1);

      const del = await request(app)
        .delete(`/api/v1/campaigns/${campaignId}/notes/${added.body.note.id}`)
        .set(auth(m1T));
      expect(del.status).toBe(200);
      expect((await request(app).get(`/api/v1/campaigns/${campaignId}/notes`).set(auth(m1T))).body.notes).toHaveLength(0);
    });
  });

  describe('profiles', () => {
    it('lets a member maintain their own details', async () => {
      const res = await request(app)
        .patch('/api/v1/profiles/me')
        .set(auth(m1T))
        .send({
          designation: 'Creator Partnerships Lead',
          dateOfBirth: '1998-06-14',
          joiningDate: '2026-01-05',
          gender: 'undisclosed',
          employmentType: 'full_time',
        });
      expect(res.status).toBe(200);
      expect(res.body.profile).toMatchObject({
        designation: 'Creator Partnerships Lead',
        dateOfBirth: '1998-06-14',
        joiningDate: '2026-01-05',
        gender: 'undisclosed',
      });
      // Probation is re-derived from the joining date, never typed in.
      expect(res.body.profile.probationEndDate).toBe('2026-03-31');
    });

    it('shows a joining date only to the member themselves and to Admin', async () => {
      const own = await request(app).get(`/api/v1/profiles/${m1Id}`).set(auth(m1T));
      expect(own.body.profile.joiningDate).toBe('2026-01-05');

      const admin = await request(app).get(`/api/v1/profiles/${m1Id}`).set(auth(founderT));
      expect(admin.body.profile.joiningDate).toBe('2026-01-05');

      // Their reporting manager may open the profile, but the joining date is withheld.
      const manager = await request(app).get(`/api/v1/profiles/${m1Id}`).set(auth(managerT));
      expect(manager.status).toBe(200);
      expect(manager.body.profile.joiningDate).toBeNull();

      // …and it is absent from the team directory every member can read.
      const directory = await request(app).get('/api/v1/profiles').set(auth(m1T));
      const others = directory.body.profiles.filter((p: { userId: string }) => p.userId !== m1Id);
      expect(others.every((p: { joiningDate: string | null }) => p.joiningDate === null)).toBe(true);
    });

    it('computes salary on a fixed 30-day month', async () => {
      const res = await request(app).get(`/api/v1/profiles/${m1Id}/salary-view`).set(auth(m1T));
      expect(res.status).toBe(200);
      expect(res.body.daysBasis).toBe(30);
      expect(res.body.perDayRate).toBe(1666.67); // ₹50,000 ÷ 30
      expect(res.body.paidDays).toBe(30 - res.body.lwpDays);
    });
  });

  describe('admin', () => {
    it('drops a note to chosen team members', async () => {
      const res = await request(app)
        .post('/api/v1/admin/notify')
        .set(auth(founderT))
        .send({ userIds: [m1Id], title: 'Town hall on Friday', body: 'Please block 4 PM on Friday for the town hall.' });
      expect(res.status).toBe(200);
      expect(res.body.notified).toBe(1);

      const note = await prisma.notification.findFirst({
        where: { recipientId: m1Id, type: 'admin_note' },
        orderBy: { createdAt: 'desc' },
      });
      expect(note?.title).toBe('Town hall on Friday');
    });

    it('is admin-only', async () => {
      const res = await request(app)
        .post('/api/v1/admin/notify')
        .set(auth(m1T))
        .send({ userIds: [m1Id], title: 'Nope', body: 'Not allowed' });
      expect(res.status).toBe(403);
    });

    it('records a notice period and tells the member what it means', async () => {
      const res = await request(app)
        .patch(`/api/v1/profiles/${m1Id}/notice-period`)
        .set(auth(founderT))
        .send({ noticeStartDate: '2026-09-10', noticeLastDate: '2026-10-09' });
      expect(res.status).toBe(200);
      expect(res.body.profile).toMatchObject({ noticeStartDate: '2026-09-10', noticeLastDate: '2026-10-09' });

      const note = await prisma.notification.findFirst({
        where: { recipientId: m1Id, title: 'Notice period recorded' },
      });
      expect(note?.body).toContain('leave without pay');

      // …and lifting it clears both dates.
      const lifted = await request(app)
        .patch(`/api/v1/profiles/${m1Id}/notice-period`)
        .set(auth(founderT))
        .send({ noticeStartDate: null, noticeLastDate: null });
      expect(lifted.body.profile.noticeStartDate).toBeNull();
      expect(lifted.body.profile.onNoticePeriod).toBe(false);
    });

    it('rejects a last working day before the notice start', async () => {
      const res = await request(app)
        .patch(`/api/v1/profiles/${m1Id}/notice-period`)
        .set(auth(founderT))
        .send({ noticeStartDate: '2026-09-10', noticeLastDate: '2026-09-01' });
      expect(res.status).toBe(422);
    });
  });
});
