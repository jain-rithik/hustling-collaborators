import { Router } from 'express';
import { env } from '../config/env.js';
import { asyncHandler } from '../lib/http.js';
import { notFound, unauthorized } from '../lib/errors.js';
import { istToday } from '../lib/dates.js';
import { campaignService } from '../services/campaignService.js';
import { leaderboardService } from '../services/leaderboardService.js';
import { jobService } from '../services/jobService.js';
import { breakService } from '../services/breakService.js';

/** Internal cron endpoints, authenticated with JOB_SECRET (architecture §9.1). */
export const jobsRouter = Router();

jobsRouter.use((req, _res, next) => {
  if (req.headers.authorization !== `Bearer ${env.JOB_SECRET}`) return next(unauthorized());
  next();
});

jobsRouter.post(
  '/:job',
  asyncHandler(async (req, res) => {
    switch (req.params.job) {
      case 'flag-overdue':
        return void res.json(await campaignService.flagOverdue());
      case 'monthly-accrual':
        return void res.json(await jobService.runAccrual());
      case 'nightly-leaderboard':
        return void res.json(await leaderboardService.writeSnapshots(istToday().slice(0, 7)));
      case 'break-sweep':
        return void res.json(await breakService.sweep());
      default:
        throw notFound('Unknown job');
    }
  }),
);
