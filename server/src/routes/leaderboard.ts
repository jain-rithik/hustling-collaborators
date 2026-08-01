import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { leaderboardService } from '../services/leaderboardService.js';

export const leaderboardRouter = Router();
leaderboardRouter.use(requireAuth);

leaderboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ board: await leaderboardService.current(req.query.month as string | undefined) });
  }),
);
