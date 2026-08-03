import { prisma } from '../lib/prisma.js';
import { forbidden, notFound } from '../lib/errors.js';
import { dbDateToIso, isoToDbDate, istToday } from '../lib/dates.js';
import { notifyMany } from '../lib/notify.js';
import { deadlineState, deliveredOnTime } from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

type CampaignRow = {
  id: string;
  name: string;
  clientName: string | null;
  leadId: string;
  deadline: Date;
  status: string;
  color: string | null;
  deliveredAt: Date | null;
  members: { userId: string }[];
};

function toDto(c: CampaignRow, today: string) {
  return {
    id: c.id,
    name: c.name,
    clientName: c.clientName,
    leadId: c.leadId,
    deadline: dbDateToIso(c.deadline),
    status: c.status,
    color: c.color,
    deliveredAt: c.deliveredAt?.toISOString() ?? null,
    memberIds: c.members.map((m) => m.userId),
    memberCount: c.members.length,
    state: deadlineState(dbDateToIso(c.deadline), today, c.status as never),
  };
}

async function canManage(viewer: AuthContext, campaign: { leadId: string }): Promise<boolean> {
  return viewer.isAdmin || viewer.role === 'reporting_manager' || campaign.leadId === viewer.id;
}

export const campaignService = {
  async list(viewer: AuthContext) {
    const today = istToday();
    const where = viewer.isAdmin
      ? {}
      : { OR: [{ leadId: viewer.id }, { members: { some: { userId: viewer.id } } }] };
    const campaigns = await prisma.campaign.findMany({
      where,
      include: { members: { select: { userId: true } } },
      orderBy: { deadline: 'asc' },
    });
    return campaigns.map((c) => toDto(c, today));
  },

  async get(id: string, viewer: AuthContext) {
    const c = await prisma.campaign.findUnique({
      where: { id },
      include: { members: { select: { userId: true } } },
    });
    if (!c) throw notFound('Campaign not found');
    const isMember = c.members.some((m) => m.userId === viewer.id) || c.leadId === viewer.id;
    if (!viewer.isAdmin && !isMember && viewer.role !== 'reporting_manager') throw forbidden();
    return toDto(c, istToday());
  },

  async create(
    input: {
      name: string;
      clientName?: string;
      leadId: string;
      deadline: string;
      color?: string;
      memberIds: string[];
    },
    creator: AuthContext,
  ) {
    const memberIds = new Set(input.memberIds);
    memberIds.add(input.leadId);
    const c = await prisma.campaign.create({
      data: {
        name: input.name,
        clientName: input.clientName,
        leadId: input.leadId,
        deadline: isoToDbDate(input.deadline),
        color: input.color,
        status: 'in_progress',
        createdBy: creator.id,
        members: { create: [...memberIds].map((userId) => ({ userId })) },
      },
      include: { members: { select: { userId: true } } },
    });
    return toDto(c, istToday());
  },

  async update(
    id: string,
    input: { name?: string; clientName?: string; leadId?: string; deadline?: string; color?: string },
    viewer: AuthContext,
  ) {
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) throw notFound('Campaign not found');
    if (!(await canManage(viewer, c))) throw forbidden();
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: input.name,
        clientName: input.clientName,
        // only admins/RM may reassign the lead
        leadId: input.leadId && (viewer.isAdmin || viewer.role === 'reporting_manager') ? input.leadId : undefined,
        deadline: input.deadline ? isoToDbDate(input.deadline) : undefined,
        color: input.color,
      },
      include: { members: { select: { userId: true } } },
    });
    return toDto(updated, istToday());
  },

  async deliver(id: string, viewer: AuthContext) {
    const c = await prisma.campaign.findUnique({ where: { id }, include: { members: { select: { userId: true } } } });
    if (!c) throw notFound('Campaign not found');
    if (!(await canManage(viewer, c))) throw forbidden();
    const today = istToday();
    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'delivered', deliveredAt: new Date() },
      include: { members: { select: { userId: true } } },
    });
    const onTime = deliveredOnTime(dbDateToIso(c.deadline), today);
    return { campaign: toDto(updated, today), onTime, memeEvent: 'campaign_delivered' as const };
  },

  async remove(id: string) {
    // tasks are un-tagged (campaign_id -> null) by the SetNull FK; members cascade.
    await prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  },

  async addMember(id: string, userId: string, viewer: AuthContext) {
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) throw notFound('Campaign not found');
    if (!(await canManage(viewer, c))) throw forbidden();
    await prisma.campaignMember.upsert({
      where: { campaignId_userId: { campaignId: id, userId } },
      update: {},
      create: { campaignId: id, userId },
    });
    return { ok: true };
  },

  async removeMember(id: string, userId: string, viewer: AuthContext) {
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) throw notFound('Campaign not found');
    if (!(await canManage(viewer, c))) throw forbidden();
    await prisma.campaignMember.deleteMany({ where: { campaignId: id, userId } });
    return { ok: true };
  },

  /** Cron job: flag freshly-overdue campaigns and notify the Lead + members' managers (once). */
  async flagOverdue() {
    const today = istToday();
    const overdue = await prisma.campaign.findMany({
      where: {
        status: { notIn: ['delivered'] },
        overdueNotified: false,
        deadline: { lt: isoToDbDate(today) },
      },
      include: { members: { select: { userId: true } } },
    });
    for (const c of overdue) {
      await prisma.campaign.update({ where: { id: c.id }, data: { status: 'overdue', overdueNotified: true } });
      const managerRows = await prisma.employeeProfile.findMany({
        where: { userId: { in: c.members.map((m) => m.userId) } },
        select: { reportingManagerId: true },
      });
      const recipients = [c.leadId, ...managerRows.map((m) => m.reportingManagerId).filter((x): x is string => !!x)];
      await notifyMany(
        recipients,
        'campaign_overdue',
        'Campaign overdue',
        `${c.name} needs attention — the deadline has passed.`,
        { campaignId: c.id },
      );
    }
    return { flagged: overdue.length };
  },
};
