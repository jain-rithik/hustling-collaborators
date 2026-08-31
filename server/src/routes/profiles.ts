import { Router } from 'express';
import {
  createProfileSchema,
  deleteProfileSchema,
  setNoticePeriodSchema,
  updateOwnProfileSchema,
  updateProfileSchema,
} from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAdmin, requireAuth, requireSelfOrManagerOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { profileService } from '../services/profileService.js';

export const profilesRouter = Router();
profilesRouter.use(requireAuth);

profilesRouter.get(
  '/birthdays',
  asyncHandler(async (_req, res) => {
    res.json({ birthdays: await profileService.birthdays() });
  }),
);

profilesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ profiles: await profileService.list(req.user!) });
  }),
);

// A member maintaining their own details (v4 change log).
profilesRouter.patch(
  '/me',
  validate({ body: updateOwnProfileSchema }),
  asyncHandler(async (req, res) => {
    res.json({ profile: await profileService.updateOwn(req.user!.id, req.body) });
  }),
);

profilesRouter.post(
  '/',
  requireAdmin,
  validate({ body: createProfileSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ profile: await profileService.create(req.body) });
  }),
);

profilesRouter.get(
  '/:userId',
  requireSelfOrManagerOrAdmin('userId'),
  asyncHandler(async (req, res) => {
    res.json({ profile: await profileService.get(req.params.userId, req.user!) });
  }),
);

profilesRouter.patch(
  '/:userId',
  requireAdmin,
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    res.json({ profile: await profileService.update(req.params.userId, req.body) });
  }),
);

// Admin puts a member on notice, or lifts it (v4 change log).
profilesRouter.patch(
  '/:userId/notice-period',
  requireAdmin,
  validate({ body: setNoticePeriodSchema }),
  asyncHandler(async (req, res) => {
    res.json({ profile: await profileService.setNoticePeriod(req.params.userId, req.body) });
  }),
);

profilesRouter.delete(
  '/:userId',
  requireAdmin,
  validate({ body: deleteProfileSchema }),
  asyncHandler(async (req, res) => {
    res.json(await profileService.remove(req.params.userId, req.body.confirmName));
  }),
);

profilesRouter.get(
  '/:userId/leave-balance',
  requireSelfOrManagerOrAdmin('userId'),
  asyncHandler(async (req, res) => {
    res.json(await profileService.leaveBalance(req.params.userId));
  }),
);

profilesRouter.get(
  '/:userId/leave-ledger',
  requireSelfOrManagerOrAdmin('userId'),
  asyncHandler(async (req, res) => {
    res.json({ ledger: await profileService.leaveLedger(req.params.userId) });
  }),
);

profilesRouter.get(
  '/:userId/salary-view',
  requireSelfOrManagerOrAdmin('userId'),
  asyncHandler(async (req, res) => {
    res.json(await profileService.salaryView(req.params.userId));
  }),
);
