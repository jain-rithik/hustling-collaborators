import { prisma } from '../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
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

/**
 * Campaign cards show who is on the work without anyone having to tap in (v4 change log), so
 * every campaign carries the lead's and members' names, not just their ids.
 */
function toDto(c: CampaignRow, today: string, names: Map<string, string>) {
  const memberIds = c.members.map((m) => m.userId);
  return {
    id: c.id,
    name: c.name,
    clientName: c.clientName,
    leadId: c.leadId,
    leadName: names.get(c.leadId) ?? null,
    deadline: dbDateToIso(c.deadline),
    status: c.status,
    color: c.color,
    deliveredAt: c.deliveredAt?.toISOString() ?? null,
    memberIds,
    members: memberIds.map((id) => ({ userId: id, fullName: names.get(id) ?? '' })),
    memberNames: memberIds.map((id) => names.get(id)).filter((n): n is string => !!n),
    memberCount: memberIds.length,
    state: deadlineState(dbDateToIso(c.deadline), today, c.status as never),
  };
}

/** Full names for every user id referenced by the given campaigns. */
async function nameMap(campaigns: CampaignRow[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const c of campaigns) {
    ids.add(c.leadId);
    c.members.forEach((m) => ids.add(m.userId));
  }
  if (!ids.size) return new Map();
  const profiles = await prisma.employeeProfile.findMany({
    where: { userId: { in: [...ids] } },
    select: { userId: true, fullName: true },
  });
  return new Map(profiles.map((p) => [p.userId, p.fullName]));
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
    const names = await nameMap(campaigns);
    return campaigns.map((c) => toDto(c, today, names));
  },

  async get(id: string, viewer: AuthContext) {
    const c = await prisma.campaign.findUnique({
      where: { id },
      include: { members: { select: { userId: true } } },
    });
    if (!c) throw notFound('Campaign not found');
    const isMember = c.members.some((m) => m.userId === viewer.id) || c.leadId === viewer.id;
    if (!viewer.isAdmin && !isMember && viewer.role !== 'reporting_manager') throw forbidden();
    return toDto(c, istToday(), await nameMap([c]));
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
    return toDto(c, istToday(), await nameMap([c]));
  },

  async update(
    id: string,
    input: {
      name?: string;
      clientName?: string;
      leadId?: string;
      deadline?: string;
      color?: string;
      memberIds?: string[];
    },
    viewer: AuthContext,
  ) {
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) throw notFound('Campaign not found');
    if (!(await canManage(viewer, c))) throw forbidden();
    const canReassign = viewer.isAdmin || viewer.role === 'reporting_manager';
    const leadId = input.leadId && canReassign ? input.leadId : c.leadId;

    const updated = await prisma.$transaction(async (tx) => {
      if (input.memberIds) {
        // The lead is always part of the team (v4 change log).
        const wanted = new Set(input.memberIds);
        wanted.add(leadId);
        await tx.campaignMember.deleteMany({ where: { campaignId: id, userId: { notIn: [...wanted] } } });
        for (const userId of wanted) {
          await tx.campaignMember.upsert({
            where: { campaignId_userId: { campaignId: id, userId } },
            update: {},
            create: { campaignId: id, userId },
          });
        }
      } else if (input.leadId && canReassign) {
        await tx.campaignMember.upsert({
          where: { campaignId_userId: { campaignId: id, userId: leadId } },
          update: {},
          create: { campaignId: id, userId: leadId },
        });
      }
      return tx.campaign.update({
        where: { id },
        data: {
          name: input.name,
          clientName: input.clientName,
          // only admins/RM may reassign the lead
          leadId: input.leadId && canReassign ? input.leadId : undefined,
          deadline: input.deadline ? isoToDbDate(input.deadline) : undefined,
          color: input.color,
        },
        include: { members: { select: { userId: true } } },
      });
    });
    return toDto(updated, istToday(), await nameMap([updated]));
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
    return {
      campaign: toDto(updated, today, await nameMap([updated])),
      onTime,
      memeEvent: 'campaign_delivered' as const,
    };
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

  /**
   * Campaign Brief & Details (v4 change log) — the brief, a Google Sheet link, or any note a
   * member wants on the campaign. Anyone who can see the campaign can read and add notes.
   */
  async listNotes(campaignId: string, viewer: AuthContext) {
    await campaignService.get(campaignId, viewer); // reuses the access check
    const notes = await prisma.campaignNote.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, profile: { select: { fullName: true } } } } },
    });
    return notes.map((n) => ({
      id: n.id,
      text: n.text,
      authorId: n.authorId,
      authorName: n.author?.profile?.fullName ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  },

  async addNote(campaignId: string, text: string, viewer: AuthContext) {
    await campaignService.get(campaignId, viewer);
    const trimmed = text.trim();
    if (!trimmed) throw badRequest('Add a note or paste a link before saving.');
    const note = await prisma.campaignNote.create({
      data: { campaignId, authorId: viewer.id, text: trimmed },
      include: { author: { select: { profile: { select: { fullName: true } } } } },
    });
    return {
      id: note.id,
      text: note.text,
      authorId: note.authorId,
      authorName: note.author?.profile?.fullName ?? null,
      createdAt: note.createdAt.toISOString(),
    };
  },

  /** A member may delete their own note; admins and the campaign lead may delete any. */
  async removeNote(campaignId: string, noteId: string, viewer: AuthContext) {
    const note = await prisma.campaignNote.findUnique({
      where: { id: noteId },
      include: { campaign: { select: { id: true, leadId: true } } },
    });
    if (!note || note.campaignId !== campaignId) throw notFound('Note not found');
    const mayDelete = viewer.isAdmin || note.authorId === viewer.id || note.campaign.leadId === viewer.id;
    if (!mayDelete) throw forbidden();
    await prisma.campaignNote.delete({ where: { id: noteId } });
    return { deleted: true };
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
