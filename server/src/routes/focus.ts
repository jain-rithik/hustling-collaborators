import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { requireAuth, requireSelfOrManagerOrAdmin } from '../middleware/auth.js';
import { focusService } from '../services/focusService.js';

export const focusRouter = Router();
focusRouter.use(requireAuth);

focusRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await focusService.trend(req.user!.id));
  }),
);

focusRouter.get(
  '/:userId',
  requireSelfOrManagerOrAdmin('userId'),
  asyncHandler(async (req, res) => {
    res.json(await focusService.trend(req.params.userId));
  }),
);
