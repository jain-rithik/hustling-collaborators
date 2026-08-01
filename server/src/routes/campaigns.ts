import { Router } from 'express';
import { addMemberSchema, createCampaignSchema, updateCampaignSchema } from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAdmin, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { campaignService } from '../services/campaignService.js';
import { taskService } from '../services/taskService.js';

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

campaignsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ campaigns: await campaignService.list(req.user!) });
  }),
);

campaignsRouter.post(
  '/',
  requireRole('reporting_manager'),
  validate({ body: createCampaignSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ campaign: await campaignService.create(req.body, req.user!) });
  }),
);

campaignsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ campaign: await campaignService.get(req.params.id, req.user!) });
  }),
);

campaignsRouter.patch(
  '/:id',
  validate({ body: updateCampaignSchema }),
  asyncHandler(async (req, res) => {
    res.json({ campaign: await campaignService.update(req.params.id, req.body, req.user!) });
  }),
);

campaignsRouter.post(
  '/:id/deliver',
  asyncHandler(async (req, res) => {
    res.json(await campaignService.deliver(req.params.id, req.user!));
  }),
);

campaignsRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await campaignService.remove(req.params.id));
  }),
);

// Campaign Lead's contextual view of all members' task status.
campaignsRouter.get(
  '/:id/tasks',
  asyncHandler(async (req, res) => {
    res.json({ tasks: await taskService.list({ campaignId: req.params.id }, req.user!) });
  }),
);

campaignsRouter.post(
  '/:id/members',
  requireRole('reporting_manager'),
  validate({ body: addMemberSchema }),
  asyncHandler(async (req, res) => {
    res.json(await campaignService.addMember(req.params.id, req.body.userId, req.user!));
  }),
);

campaignsRouter.delete(
  '/:id/members/:userId',
  requireRole('reporting_manager'),
  asyncHandler(async (req, res) => {
    res.json(await campaignService.removeMember(req.params.id, req.params.userId, req.user!));
  }),
);
