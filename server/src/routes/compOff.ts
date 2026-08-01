import { Router } from 'express';
import { createCompOffRequestSchema, creditCompOffSchema } from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { compOffService } from '../services/compOffService.js';

export const compOffRouter = Router();
compOffRouter.use(requireAuth);

compOffRouter.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const { userId, status } = req.query as Record<string, string | undefined>;
    res.json({ requests: await compOffService.listRequests({ userId, status }, req.user!) });
  }),
);

compOffRouter.post(
  '/requests',
  validate({ body: createCompOffRequestSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await compOffService.createRequest(req.body, req.user!));
  }),
);

compOffRouter.post(
  '/requests/:id/approve',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await compOffService.decideRequest(req.params.id, true, req.user!));
  }),
);

compOffRouter.post(
  '/requests/:id/reject',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await compOffService.decideRequest(req.params.id, false, req.user!));
  }),
);

compOffRouter.post(
  '/credits',
  requireAdmin,
  validate({ body: creditCompOffSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await compOffService.credit(req.body, req.user!));
  }),
);

compOffRouter.delete(
  '/credits/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await compOffService.deleteCredit(req.params.id));
  }),
);

compOffRouter.get(
  '/eligible',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId, date } = req.query as Record<string, string>;
    res.json(await compOffService.eligible(userId, date));
  }),
);
