import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Express } from 'express';

/** Shared Prisma client for API tests. Only used when RUN_API_TESTS is set (see api.test.ts). */
export const prisma = new PrismaClient();

export const PW = 'Test@1234';

export interface Fixture {
  founder: string;
  manager: string;
  member1: string;
  member2: string;
}

/** Truncate everything and seed a tiny org: founder(admin), manager, and two reportees. */
export async function resetDb(): Promise<Fixture> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    leave_ledger, leave_requests, comp_off_credits, comp_off_requests,
    attendance_days, calendar_remarks, tasks, campaign_members, campaigns,
    notifications, leaderboard_snapshots, refresh_tokens, employee_profiles,
    role_permissions, roles, permissions, holidays, meme_lines, users
    RESTART IDENTITY CASCADE`);

  const hash = await bcrypt.hash(PW, 10);
  const mkUser = (email: string, role: string, isAdmin = false, isFounder = false) =>
    prisma.user.create({ data: { email, passwordHash: hash, role: role as never, isAdmin, isFounder } });

  const founder = await mkUser('founder@test.dev', 'admin', true, true);
  const manager = await mkUser('manager@test.dev', 'reporting_manager');
  const member1 = await mkUser('m1@test.dev', 'team_member');
  const member2 = await mkUser('m2@test.dev', 'team_member');

  const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
  await prisma.employeeProfile.create({
    data: { userId: founder.id, fullName: 'The Founder', employmentType: 'full_time', joiningDate: d('2024-01-01') },
  });
  await prisma.employeeProfile.create({
    data: { userId: manager.id, fullName: 'The Manager', employmentType: 'full_time', joiningDate: d('2025-01-01') },
  });
  await prisma.employeeProfile.create({
    data: {
      userId: member1.id,
      fullName: 'Member One',
      employmentType: 'full_time',
      joiningDate: d('2026-01-01'),
      salaryAmount: 50000,
      reportingManagerId: manager.id,
    },
  });
  await prisma.employeeProfile.create({
    data: {
      userId: member2.id,
      fullName: 'Member Two',
      employmentType: 'full_time',
      joiningDate: d('2026-01-01'),
      salaryAmount: 60000,
      reportingManagerId: manager.id,
    },
  });

  // A generous opening PL balance for member1 so leave-approval tests have room.
  await prisma.leaveLedger.create({
    data: { userId: member1.id, effectiveDate: d('2026-04-01'), entryType: 'opening', leaveType: 'pl', amount: 10, balanceAfter: 10, note: 'seed' },
  });

  // Minimal meme bank so the meme endpoint returns something.
  await prisma.memeLine.create({ data: { eventKey: 'task_completed_on_time', text: 'Ye badhiya tha guru 🙌' } });

  return { founder: 'founder@test.dev', manager: 'manager@test.dev', member1: 'm1@test.dev', member2: 'm2@test.dev' };
}

export async function login(app: Express, email: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: PW });
  if (!res.body.accessToken) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
