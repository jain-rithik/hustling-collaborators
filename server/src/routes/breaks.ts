import { Router } from 'express';
import { startBreakSchema } from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { breakService } from '../services/breakService.js';

export const breaksRouter = Router();
breaksRouter.use(requireAuth);

breaksRouter.get(
  '/today',
  asyncHandler(async (req, res) => {
    res.json(await breakService.today(req.user!));
  }),
);

breaksRouter.post(
  '/start',
  validate({ body: startBreakSchema }),
  asyncHandler(async (req, res) => {
    res.json(await breakService.start(req.user!, req.body.type));
  }),
);

breaksRouter.post(
  '/end',
  asyncHandler(async (req, res) => {
    res.json(await breakService.end(req.user!));
  }),
);
