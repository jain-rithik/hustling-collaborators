import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '@hc/shared';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { asyncHandler } from '../lib/http.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface AuthContext {
  id: string;
  role: UserRole;
  isAdmin: boolean;
  isActive: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthContext;
      /** Admin "on behalf" target (set by actAs when the caller is an admin). */
      actingFor?: string;
    }
  }
}

/**
 * Verify the access JWT and load the CURRENT user from the DB (cheap at 8 users).
 * Loading fresh means an admin-toggle or account-disable takes effect immediately,
 * not only on next token refresh (architecture §7.4).
 */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    throw unauthorized('Session expired — please log in again');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, isAdmin: true, isActive: true },
  });
  if (!user) throw unauthorized();
  if (!user.isActive) throw forbidden('This account is disabled');

  req.user = user;
  next();
});

/** Admin short-circuits every check to "allow" (PRD "unrestricted"). */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user?.isAdmin) throw forbidden('Admin only');
  next();
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (req.user?.isAdmin || (req.user && roles.includes(req.user.role))) return next();
    throw forbidden();
  };

/** Allow the target user themselves, their reporting manager, or an admin. */
export const requireSelfOrManagerOrAdmin =
  (param = 'userId'): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const targetId = req.params[param];
    if (req.user?.isAdmin || req.user?.id === targetId) return next();
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: targetId },
      select: { reportingManagerId: true },
    });
    if (profile?.reportingManagerId === req.user?.id) return next();
    throw forbidden();
  });

/** Allow the target's reporting manager or an admin (not the user themselves). */
export const requireManagerOrAdmin =
  (param = 'userId'): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const targetId = req.params[param];
    if (req.user?.isAdmin) return next();
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: targetId },
      select: { reportingManagerId: true },
    });
    if (profile?.reportingManagerId === req.user?.id) return next();
    throw forbidden();
  });

/**
 * Contextual Campaign-Lead permission (PRD §3 / architecture §7.5). Allows the lead
 * of THIS campaign (or an admin) — grants nothing on any other campaign.
 */
export const requireCampaignLead =
  (param = 'id'): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (req.user?.isAdmin) return next();
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params[param] },
      select: { leadId: true },
    });
    if (campaign?.leadId === req.user?.id) return next();
    throw forbidden();
  });

/** Admin "on behalf": only an admin may act for another user (architecture §7.6). */
export const actAs: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const target = (req.header('X-Act-For') ?? (req.body as { ownerId?: string })?.ownerId) || null;
  if (target && req.user?.isAdmin) req.actingFor = String(target);
  next();
};
