import { Router } from 'express';
import {
  adjustLeaveSchema,
  createLeaveSchema,
  decideRequestSchema,
  manualLeaveSchema,
  setLeaveTypeSchema,
} from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAdmin, requireAuth, requireSelfOrManagerOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { leaveService } from '../services/leaveService.js';

export const leaveRouter = Router();
leaveRouter.use(requireAuth);

leaveRouter.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const { userId, status } = req.query as Record<string, string | undefined>;
    res.json({ requests: await leaveService.list({ userId, status }, req.user!) });
  }),
);

leaveRouter.post(
  '/requests',
  validate({ body: createLeaveSchema }),
  asyncHandler(async (req, res) => {
    // Also returns `notices` — the policy messages the client shows as a confirmation popup.
    res.status(201).json(await leaveService.create(req.body, req.user!));
  }),
);

// Entitlements + what is left of them, for the leave form's per-type counters.
leaveRouter.get(
  '/balances/:userId',
  requireSelfOrManagerOrAdmin('userId'),
  asyncHandler(async (req, res) => {
    res.json(await leaveService.balances(req.params.userId));
  }),
);

leaveRouter.post(
  '/requests/:id/approve',
  validate({ body: decideRequestSchema }),
  asyncHandler(async (req, res) => {
    res.json(await leaveService.approve(req.params.id, req.user!, req.body.note, req.body.leaveType));
  }),
);

leaveRouter.post(
  '/requests/:id/reject',
  validate({ body: decideRequestSchema }),
  asyncHandler(async (req, res) => {
    res.json({ request: await leaveService.reject(req.params.id, req.user!, req.body.note) });
  }),
);

leaveRouter.patch(
  '/requests/:id/type',
  requireAdmin,
  validate({ body: setLeaveTypeSchema }),
  asyncHandler(async (req, res) => {
    res.json({ request: await leaveService.setType(req.params.id, req.body.leaveType, req.user!) });
  }),
);

leaveRouter.post(
  '/requests/:id/cancel',
  asyncHandler(async (req, res) => {
    res.json({ request: await leaveService.cancel(req.params.id, req.user!) });
  }),
);

leaveRouter.post(
  '/manual',
  requireAdmin,
  validate({ body: manualLeaveSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ request: await leaveService.manual(req.body, req.user!) });
  }),
);

leaveRouter.post(
  '/adjust',
  requireAdmin,
  validate({ body: adjustLeaveSchema }),
  asyncHandler(async (req, res) => {
    res.json(await leaveService.adjust(req.body, req.user!));
  }),
);

leaveRouter.delete(
  '/ledger/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await leaveService.deleteLedger(req.params.id));
  }),
);
