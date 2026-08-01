import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { auth, login, prisma, resetDb, type Fixture } from './helpers.js';

// Only runs when a Postgres test DB is provided (CI). Keeps local `npm test` green without a DB.
const RUN = !!process.env.RUN_API_TESTS;

describe.skipIf(!RUN)('API integration', () => {
  let app: Express;
  let fx: Fixture;
  let founderT = '';
  let managerT = '';
  let m1T = '';

  beforeAll(async () => {
    const { createApp } = await import('../../src/app.js');
    app = createApp();
    fx = await resetDb();
    founderT = await login(app, fx.founder);
    managerT = await login(app, fx.manager);
    m1T = await login(app, fx.member1);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const userId = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

  describe('auth', () => {
    it('returns the current user', async () => {
      const me = await request(app).get('/api/v1/auth/me').set(auth(m1T));
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('m1@test.dev');
    });
    it('rejects a wrong password (401)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: fx.member1, password: 'nope' });
      expect(res.status).toBe(401);
    });
    it('rejects an unauthenticated call (401)', async () => {
      expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    });
  });

  describe('RBAC', () => {
    it('scopes salary: own visible, peer forbidden, manager sees reportee', async () => {
      const m1 = await userId(fx.member1);
      const m2 = await userId(fx.member2);
      const own = await request(app).get(`/api/v1/profiles/${m1}`).set(auth(m1T));
      expect(own.body.profile.salaryAmount).toBe(50000);

      const peer = await request(app).get(`/api/v1/profiles/${m2}`).set(auth(m1T));
      expect(peer.status).toBe(403);

      const mgr = await request(app).get(`/api/v1/profiles/${m2}`).set(auth(managerT));
      expect(mgr.body.profile.salaryAmount).toBe(60000);
    });

    it('blocks non-admins from the admin console; founder passes', async () => {
      expect((await request(app).get('/api/v1/admin/users').set(auth(m1T))).status).toBe(403);
      expect((await request(app).get('/api/v1/admin/users').set(auth(founderT))).status).toBe(200);
    });

    it('admin short-circuits every scope (founder lists all profiles)', async () => {
      const res = await request(app).get('/api/v1/profiles').set(auth(founderT));
      expect(res.status).toBe(200);
      expect(res.body.profiles.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('tasks', () => {
    it('On-it → Nailed-it computes actual vs estimate + returns a meme event', async () => {
      const create = await request(app).post('/api/v1/tasks').set(auth(m1T)).send({ title: 'shortlist', estimatedMinutes: 30 });
      expect(create.status).toBe(201);
      const id = create.body.task.id;
      const started = await request(app).post(`/api/v1/tasks/${id}/start`).set(auth(m1T));
      expect(started.body.task.status).toBe('active');
      const done = await request(app).post(`/api/v1/tasks/${id}/complete`).set(auth(m1T)).send({});
      expect(done.body.task.status).toBe('done');
      expect(done.body.task.actualMinutes).toBeGreaterThanOrEqual(0);
      expect(['task_completed_on_time', 'task_completed_late']).toContain(done.body.memeEvent);
    });

    it('enforces one active task per user (409)', async () => {
      const a = await request(app).post('/api/v1/tasks').set(auth(m1T)).send({ title: 'A', estimatedMinutes: 10 });
      const b = await request(app).post('/api/v1/tasks').set(auth(m1T)).send({ title: 'B', estimatedMinutes: 10 });
      await request(app).post(`/api/v1/tasks/${a.body.task.id}/start`).set(auth(m1T));
      const second = await request(app).post(`/api/v1/tasks/${b.body.task.id}/start`).set(auth(m1T));
      expect(second.status).toBe(409);
    });
  });

  describe('leave & comp-off', () => {
    it('manager approval of a 2-day PL deducts the balance', async () => {
      const m1 = await userId(fx.member1);
      const req = await request(app)
        .post('/api/v1/leave/requests')
        .set(auth(m1T))
        .send({ leaveType: 'pl', startDate: '2026-12-10', endDate: '2026-12-11', reason: 'break' });
      expect(req.status).toBe(201);
      const before = await request(app).get(`/api/v1/profiles/${m1}/leave-balance`).set(auth(m1T));
      const approve = await request(app)
        .post(`/api/v1/leave/requests/${req.body.request.id}/approve`)
        .set(auth(managerT))
        .send({});
      expect(approve.status).toBe(200);
      const after = await request(app).get(`/api/v1/profiles/${m1}/leave-balance`).set(auth(m1T));
      expect(after.body.pl).toBe(before.body.pl - 2);
    });

    it('rejects a retrospective comp-off request (400)', async () => {
      const res = await request(app)
        .post('/api/v1/comp-off/requests')
        .set(auth(m1T))
        .send({ offDate: '2020-01-05', plannedWork: 'x', reason: 'y' });
      expect(res.status).toBe(400);
    });
  });

  describe('meme', () => {
    it('returns a line for a known event', async () => {
      const res = await request(app).get('/api/v1/meme?event=task_completed_on_time').set(auth(m1T));
      expect(res.status).toBe(200);
      expect(typeof res.body.line).toBe('string');
    });
  });
});
