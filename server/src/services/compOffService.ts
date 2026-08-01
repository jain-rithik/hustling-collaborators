import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { systemClock } from '../lib/clock.js';
import { dbDateToIso, isoToDbDate } from '../lib/dates.js';
import { getHolidayRefs } from '../lib/calendar.js';
import { notify, notifyMany } from '../lib/notify.js';
import {
  computeFocusMinutes,
  creditExpiry,
  isCompOffEligibleGuideline,
  isPreApprovalValid,
  resolveDayType,
} from '../domain/index.js';
import type { AuthContext } from '../middleware/auth.js';

const OFF_DAY_TYPES = ['sunday', 'fourth_saturday', 'mandatory_holiday'];

async function adminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

async function assertViewer(viewer: AuthContext, userId: string) {
  if (viewer.isAdmin || viewer.id === userId) return;
  const p = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { reportingManagerId: true },
  });
  if (p?.reportingManagerId === viewer.id) return;
  throw forbidden();
}

export const compOffService = {
  async listRequests(query: { userId?: string; status?: string }, viewer: AuthContext) {
    const userId = query.userId ?? viewer.id;
    await assertViewer(viewer, userId);
    const rows = await prisma.compOffRequest.findMany({
      where: { userId, ...(query.status ? { status: query.status as never } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      offDate: dbDateToIso(r.offDate),
      campaignId: r.campaignId,
      plannedWork: r.plannedWork,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  async createRequest(
    input: { offDate: string; campaignId?: string | null; plannedWork: string; reason: string },
    viewer: AuthContext,
  ) {
    const now = systemClock.now();
    if (!isPreApprovalValid(now, input.offDate)) {
      throw badRequest('Comp-off request off day se pehle karni hoti hai — no retro requests 🙏');
    }
    const holidays = await getHolidayRefs();
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: viewer.id },
      select: { dateOfBirth: true, reportingManagerId: true, fullName: true },
    });
    const dob = profile?.dateOfBirth ? dbDateToIso(profile.dateOfBirth) : null;
    const dayType = resolveDayType(input.offDate, { holidays, dob });
    if (!OFF_DAY_TYPES.includes(dayType)) {
      throw badRequest('Comp-off sirf off days (Sunday / 4th Saturday / holiday) ke liye hai');
    }
    const request = await prisma.compOffRequest.create({
      data: {
        userId: viewer.id,
        offDate: isoToDbDate(input.offDate),
        campaignId: input.campaignId ?? null,
        plannedWork: input.plannedWork,
        reason: input.reason,
      },
    });
    const recipients = await adminIds();
    if (profile?.reportingManagerId) recipients.push(profile.reportingManagerId);
    await notifyMany(
      recipients,
      'comp_off_request',
      'Comp-off request',
      `${profile?.fullName ?? 'A team member'} wants to work ${input.offDate}`,
      { compOffRequestId: request.id },
    );
    return { id: request.id, status: request.status };
  },

  async decideRequest(id: string, approve: boolean, admin: AuthContext) {
    const req = await prisma.compOffRequest.findUnique({ where: { id } });
    if (!req) throw notFound('Comp-off request not found');
    if (req.status !== 'pending') throw conflict('This request is already decided');
    const updated = await prisma.compOffRequest.update({
      where: { id },
      data: { status: approve ? 'approved' : 'rejected', approverId: admin.id, decidedAt: new Date() },
    });
    await notify(
      req.userId,
      'comp_off_request',
      approve ? 'Comp-off approved to work' : 'Comp-off request declined',
      approve ? `You're cleared to work ${dbDateToIso(req.offDate)}` : 'Your comp-off request was declined',
      { compOffRequestId: id },
    );
    return { id: updated.id, status: updated.status };
  },

  async credit(
    input: { userId: string; creditedForDate: string; compOffRequestId?: string; note?: string },
    admin: AuthContext,
  ) {
    const credit = await prisma.compOffCredit.create({
      data: {
        userId: input.userId,
        creditedForDate: isoToDbDate(input.creditedForDate),
        compOffRequestId: input.compOffRequestId ?? null,
        expiresOn: isoToDbDate(creditExpiry(input.creditedForDate)),
        creditedBy: admin.id,
        note: input.note,
      },
    });
    await notify(
      input.userId,
      'comp_off_credited',
      'Comp-off credited 🎉',
      'You earned a comp-off day — use it before 31 March',
      { compOffCreditId: credit.id },
    );
    return { id: credit.id, expiresOn: dbDateToIso(credit.expiresOn), memeEvent: 'comp_off_approved' };
  },

  async deleteCredit(id: string) {
    await prisma.compOffCredit.delete({ where: { id } });
    return { deleted: true };
  },

  /** Admin reference: minutes logged on an approved off day + whether the 6h guideline is met. */
  async eligible(userId: string, date: string) {
    const tasks = await prisma.task.findMany({
      where: { ownerId: userId, workDate: isoToDbDate(date), status: 'done' },
      select: { actualMinutes: true },
    });
    const loggedMinutes = computeFocusMinutes(tasks.map((t) => ({ actualMinutes: t.actualMinutes })));
    return { loggedMinutes, meetsGuideline: isCompOffEligibleGuideline(loggedMinutes) };
  },
};
