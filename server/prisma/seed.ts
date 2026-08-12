import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BCRYPT_COST, type EmploymentType, type UserRole } from '@hc/shared';
import { monthlyAccrualSchedule } from '../src/domain/leaveAccrual.js';

const prisma = new PrismaClient();

const readData = <T>(file: string): T =>
  JSON.parse(readFileSync(new URL(`./data/${file}`, import.meta.url), 'utf8')) as T;

const DEFAULT_PASSWORD = 'Hustle@123';
// A fixed reference "today" so seeded balances are reproducible in dev/CI.
const SEED_TODAY = '2026-08-01';

// ─────────────────────────── RBAC reference tables ──────────────────────────

const PERMISSIONS: Array<[string, string]> = [
  ['task.view_own', 'View own tasks'],
  ['task.view_any', 'View any task'],
  ['task.edit_own', 'Start/complete/edit own tasks'],
  ['task.edit_any', 'Edit any task'],
  ['task.delete_any', 'Delete any task'],
  ['task.create_on_behalf', 'Create a task for another user'],
  ['attendance.check_in', 'Check in / out for self'],
  ['attendance.view_own', 'View own attendance'],
  ['attendance.view_reportee', "View reportees' attendance"],
  ['attendance.override', 'Override any attendance day'],
  ['leave.request', 'Submit a leave request'],
  ['leave.approve_reportee', "Approve reportees' leave"],
  ['leave.approve_any', 'Approve any leave'],
  ['leave.manual', 'Add leave directly'],
  ['leave.adjust', 'Adjust a leave balance'],
  ['leave.delete', 'Delete a leave/ledger entry'],
  ['compoff.request', 'Submit a comp-off request'],
  ['compoff.approve', 'Approve a comp-off request'],
  ['compoff.credit', 'Credit / grant comp-off'],
  ['compoff.delete', 'Delete a comp-off credit'],
  ['campaign.create', 'Create a campaign'],
  ['campaign.edit', 'Edit a campaign'],
  ['campaign.deliver', 'Mark a campaign delivered'],
  ['campaign.delete', 'Delete a campaign'],
  ['campaign.view_lead', "View a led campaign's task status"],
  ['profile.view_own', 'View own profile'],
  ['profile.view_reportee', "View reportees' profiles"],
  ['profile.view_any', 'View any profile'],
  ['profile.edit', 'Edit any profile'],
  ['profile.delete', 'Delete a profile'],
  ['salary.view_own', 'View own salary/deductions'],
  ['salary.view_reportee', "View reportees' salary/deductions"],
  ['holiday.manage', 'Add/edit/remove holidays'],
  ['remark.manage', 'Add/edit/remove calendar remarks'],
  ['admin.toggle_admin', 'Grant/revoke admin'],
  ['admin.set_role', 'Set a user role'],
  ['admin.manage_users', 'Enable/disable users'],
  ['leaderboard.view', 'View the leaderboard'],
  ['focus.view_own', 'View own focus time'],
  ['focus.view_reportee', "View reportees' focus time"],
];

const ROLE_PERMS: Record<UserRole, string[]> = {
  admin: PERMISSIONS.map(([k]) => k), // everything
  reporting_manager: [
    'task.view_own',
    'task.view_any',
    'task.edit_own',
    'attendance.check_in',
    'attendance.view_own',
    'attendance.view_reportee',
    'leave.request',
    'leave.approve_reportee',
    'compoff.request',
    'campaign.create',
    'campaign.edit',
    'campaign.deliver',
    'campaign.view_lead',
    'profile.view_own',
    'profile.view_reportee',
    'salary.view_own',
    'salary.view_reportee',
    'leaderboard.view',
    'focus.view_own',
    'focus.view_reportee',
  ],
  team_member: [
    'task.view_own',
    'task.edit_own',
    'attendance.check_in',
    'attendance.view_own',
    'leave.request',
    'compoff.request',
    'campaign.view_lead',
    'profile.view_own',
    'salary.view_own',
    'leaderboard.view',
    'focus.view_own',
  ],
};

async function seedRbac() {
  for (const [key, description] of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
  }
  const roles: Array<[UserRole, string, string]> = [
    ['admin', 'Admin', 'Full edit/delete across every module'],
    ['reporting_manager', 'Reporting Manager', 'Manages own reportees'],
    ['team_member', 'Team Member', 'Owns their own data'],
  ];
  for (const [key, label, description] of roles) {
    await prisma.role.upsert({ where: { key }, update: { label, description }, create: { key, label, description } });
    await prisma.rolePermission.deleteMany({ where: { roleKey: key } });
    await prisma.rolePermission.createMany({
      data: ROLE_PERMS[key].map((permissionKey) => ({ roleKey: key, permissionKey })),
      skipDuplicates: true,
    });
  }
  console.log(`  ✓ RBAC: ${PERMISSIONS.length} permissions, 3 roles`);
}

// ─────────────────────────────── Holidays ───────────────────────────────────

async function seedHolidays() {
  const { holidays } = readData<{ holidays: Array<{ date: string; name: string; type: string }> }>(
    'holidays-fy2627.json',
  );
  for (const h of holidays) {
    const day = new Date(`${h.date}T00:00:00Z`);
    const type = h.type === 'MANDATORY' ? 'mandatory_holiday' : 'optional_holiday';
    await prisma.holiday.upsert({
      where: { day },
      update: { name: h.name, type, seeded: true },
      create: { day, name: h.name, type, seeded: true },
    });
  }
  console.log(`  ✓ Holidays: ${holidays.length} seeded (FY 2026-27)`);
}

// ─────────────────────────────── Meme bank ──────────────────────────────────

async function seedMemeBank() {
  const bank = readData<Record<string, string[]>>('meme-bank.json');
  const rows = Object.entries(bank)
    .filter(([eventKey]) => !eventKey.startsWith('_'))
    .flatMap(([eventKey, lines]) => lines.map((text) => ({ eventKey, text, isActive: true })));
  // Replace the entire bank so an updated file never leaves stale lines behind
  // (re-running the seed refreshes copy in place). meme_lines has no dependents.
  await prisma.memeLine.deleteMany({});
  await prisma.memeLine.createMany({ data: rows });
  console.log(`  ✓ Meme bank: ${rows.length} lines`);
}

// ─────────────────────────────── People ─────────────────────────────────────

interface SeedPerson {
  email: string;
  fullName: string;
  code: string;
  role: UserRole;
  isAdmin?: boolean;
  isFounder?: boolean;
  type: EmploymentType;
  joining: string;
  dob: string;
  designation: string;
  salary: number; // FAKE demo salary in ₹
  managerEmail?: string;
}

const FOUNDER_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'founder@hustlingcollaborators.com';

const PEOPLE: SeedPerson[] = [
  { email: FOUNDER_EMAIL, fullName: process.env.SEED_ADMIN_NAME ?? 'Founder', code: 'HC-001', role: 'admin', isAdmin: true, isFounder: true, type: 'full_time', joining: '2024-01-01', dob: '1995-05-20', designation: 'Founder', salary: 0 },
  { email: 'priya@hustlingcollaborators.com', fullName: 'Priya Nair', code: 'HC-002', role: 'reporting_manager', type: 'full_time', joining: '2025-04-01', dob: '1994-11-02', designation: 'Reporting Manager', salary: 90000, managerEmail: FOUNDER_EMAIL },
  { email: 'anshuman@hustlingcollaborators.com', fullName: 'Anshuman Verma', code: 'HC-003', role: 'team_member', isAdmin: true, type: 'full_time', joining: '2025-06-01', dob: '1998-09-12', designation: 'Ops Lead', salary: 60000, managerEmail: 'priya@hustlingcollaborators.com' },
  { email: 'rohan@hustlingcollaborators.com', fullName: 'Rohan Mehta', code: 'HC-004', role: 'team_member', type: 'full_time', joining: '2026-04-01', dob: '1999-03-15', designation: 'Influencer Manager', salary: 45000, managerEmail: 'priya@hustlingcollaborators.com' },
  { email: 'sneha@hustlingcollaborators.com', fullName: 'Sneha Kapoor', code: 'HC-005', role: 'team_member', type: 'full_time', joining: '2026-06-01', dob: '2000-01-08', designation: 'Content Strategist', salary: 42000, managerEmail: 'priya@hustlingcollaborators.com' },
  { email: 'arjun@hustlingcollaborators.com', fullName: 'Arjun Singh', code: 'HC-006', role: 'team_member', type: 'full_time', joining: '2026-02-01', dob: '1997-07-21', designation: 'Performance Marketer', salary: 48000, managerEmail: 'priya@hustlingcollaborators.com' },
  { email: 'kabir@hustlingcollaborators.com', fullName: 'Kabir Das', code: 'HC-007', role: 'team_member', type: 'intern', joining: '2026-05-01', dob: '2003-12-30', designation: 'Marketing Intern', salary: 15000, managerEmail: 'priya@hustlingcollaborators.com' },
  { email: 'meera@hustlingcollaborators.com', fullName: 'Meera Iyer', code: 'HC-008', role: 'team_member', type: 'full_time', joining: '2026-07-01', dob: '1999-08-08', designation: 'Community Manager', salary: 40000, managerEmail: 'priya@hustlingcollaborators.com' },
];

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function seedPeople() {
  const founderPassword = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
  const idByEmail = new Map<string, string>();

  // First pass: users + profiles (without manager links).
  for (const p of PEOPLE) {
    const password = p.isFounder ? founderPassword : DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { role: p.role, isAdmin: p.isAdmin ?? false, isFounder: p.isFounder ?? false },
      create: {
        email: p.email,
        passwordHash,
        role: p.role,
        isAdmin: p.isAdmin ?? false,
        isFounder: p.isFounder ?? false,
      },
    });
    idByEmail.set(p.email, user.id);

    await prisma.employeeProfile.upsert({
      where: { userId: user.id },
      update: {
        fullName: p.fullName,
        employeeCode: p.code,
        employmentType: p.type,
        joiningDate: asDate(p.joining),
        dateOfBirth: asDate(p.dob),
        designation: p.designation,
        department: 'Marketing',
        salaryAmount: p.salary,
      },
      create: {
        userId: user.id,
        fullName: p.fullName,
        employeeCode: p.code,
        employmentType: p.type,
        joiningDate: asDate(p.joining),
        dateOfBirth: asDate(p.dob),
        designation: p.designation,
        department: 'Marketing',
        salaryAmount: p.salary,
      },
    });
  }

  // Second pass: manager links + accrual ledger.
  for (const p of PEOPLE) {
    const userId = idByEmail.get(p.email)!;
    if (p.managerEmail) {
      await prisma.employeeProfile.update({
        where: { userId },
        data: { reportingManagerId: idByEmail.get(p.managerEmail) ?? null },
      });
    }

    const existing = await prisma.leaveLedger.count({ where: { userId } });
    if (existing === 0) {
      const schedule = monthlyAccrualSchedule(p.joining, p.type, SEED_TODAY);
      for (const e of schedule) {
        await prisma.leaveLedger.create({
          data: {
            userId,
            effectiveDate: asDate(e.effectiveDate),
            entryType: e.entryType,
            leaveType: e.entryType === 'expiry' ? null : 'pl',
            amount: e.amount,
            balanceAfter: e.balanceAfter,
            note: e.note,
          },
        });
      }
    }
  }
  console.log(`  ✓ People: ${PEOPLE.length} users + profiles + accrual ledgers`);
  return idByEmail;
}

// ─────────────────────────────── Campaigns ──────────────────────────────────

async function seedCampaigns(idByEmail: Map<string, string>) {
  const founder = idByEmail.get(FOUNDER_EMAIL)!;
  const specs = [
    {
      name: 'Sugar Cosmetics — Festive Push',
      clientName: 'Sugar Cosmetics',
      leadEmail: 'rohan@hustlingcollaborators.com',
      deadline: '2026-08-20',
      color: '#FF6B6B',
      memberEmails: ['rohan@hustlingcollaborators.com', 'sneha@hustlingcollaborators.com', 'kabir@hustlingcollaborators.com'],
    },
    {
      name: 'boAt — Creator Collab',
      clientName: 'boAt Lifestyle',
      leadEmail: 'arjun@hustlingcollaborators.com',
      deadline: '2026-09-05',
      color: '#00D4AA',
      memberEmails: ['arjun@hustlingcollaborators.com', 'meera@hustlingcollaborators.com', 'anshuman@hustlingcollaborators.com'],
    },
  ];

  for (const s of specs) {
    const existing = await prisma.campaign.findFirst({ where: { name: s.name } });
    if (existing) continue;
    const campaign = await prisma.campaign.create({
      data: {
        name: s.name,
        clientName: s.clientName,
        leadId: idByEmail.get(s.leadEmail)!,
        deadline: asDate(s.deadline),
        status: 'in_progress',
        color: s.color,
        createdBy: founder,
        members: {
          create: s.memberEmails.map((email) => ({ userId: idByEmail.get(email)! })),
        },
      },
    });

    // A couple of demo tasks tagged to the campaign.
    const lead = idByEmail.get(s.leadEmail)!;
    await prisma.task.create({
      data: {
        title: '100 profiles shortlisting',
        ownerId: lead,
        campaignId: campaign.id,
        estimatedMinutes: 90,
        status: 'todo',
        workDate: asDate(SEED_TODAY),
        createdBy: lead,
      },
    });
  }
  console.log(`  ✓ Campaigns: ${specs.length} with members + demo tasks`);
}

// ─────────────────────────────── Runner ─────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Hustling Collaborators…');
  await seedRbac();
  await seedHolidays();
  await seedMemeBank();
  const idByEmail = await seedPeople();
  await seedCampaigns(idByEmail);
  console.log('✅ Seed complete.');
  console.log(`   Founder login: ${FOUNDER_EMAIL} / ${process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_PASSWORD}`);
  console.log(`   Everyone else: <email> / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
