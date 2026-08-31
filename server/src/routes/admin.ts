import { Router } from 'express';
import { adminNotifySchema, adminToggleSchema, setActiveSchema, setRoleSchema } from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { istToday } from '../lib/dates.js';
import { adminService } from '../services/adminService.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    res.json({ users: await adminService.listUsers() });
  }),
);

adminRouter.patch(
  '/users/:id/admin-toggle',
  validate({ body: adminToggleSchema }),
  asyncHandler(async (req, res) => {
    res.json(await adminService.toggleAdmin(req.params.id, req.body.isAdmin));
  }),
);

adminRouter.patch(
  '/users/:id/role',
  validate({ body: setRoleSchema }),
  asyncHandler(async (req, res) => {
    res.json(await adminService.setRole(req.params.id, req.body.role));
  }),
);

adminRouter.patch(
  '/users/:id/active',
  validate({ body: setActiveSchema }),
  asyncHandler(async (req, res) => {
    res.json(await adminService.setActive(req.params.id, req.body.isActive));
  }),
);

adminRouter.get(
  '/daily-overview',
  asyncHandler(async (req, res) => {
    const date = (req.query.date as string | undefined) ?? istToday();
    res.json(await adminService.dailyOverview(date));
  }),
);

// Admin drops an alert/note to any team member (v4 change log).
adminRouter.post(
  '/notify',
  validate({ body: adminNotifySchema }),
  asyncHandler(async (req, res) => {
    res.json(await adminService.notifyMembers(req.body.userIds, req.body.title, req.body.body, req.user!));
  }),
);

adminRouter.get(
  '/pending-requests',
  asyncHandler(async (_req, res) => {
    res.json(await adminService.pendingRequests());
  }),
);

adminRouter.get(
  '/late-report',
  asyncHandler(async (req, res) => {
    const month = (req.query.month as string | undefined) ?? istToday().slice(0, 7);
    res.json(await adminService.lateReport(month));
  }),
);
