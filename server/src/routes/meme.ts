import { Router } from 'express';
import { memeQuerySchema } from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { randomMeme } from '../services/memeService.js';

export const memeRouter = Router();
memeRouter.use(requireAuth);

memeRouter.get(
  '/',
  validate({ query: memeQuerySchema }),
  asyncHandler(async (req, res) => {
    const line = await randomMeme(req.query.event as string, req.query.exclude as string | undefined);
    res.json({ line });
  }),
);
