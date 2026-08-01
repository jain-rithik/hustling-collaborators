import { Router } from 'express';
import { checkInSchema, overrideAttendanceSchema, yearMonth } from '@hc/shared';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { requireAdmin, requireAuth, requireSelfOrManagerOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { istToday } from '../lib/dates.js';
import { attendanceService } from '../services/attendanceService.js';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

attendanceRouter.get(
  '/today',
  asyncHandler(async (req, res) => {
    res.json(await attendanceService.today(req.user!));
  }),
);

attendanceRouter.post(
  '/check-in',
  validate({ body: checkInSchema }),
  asyncHandler(async (req, res) => {
    res.json(await attendanceService.checkIn(req.user!, req.body));
  }),
);

attendanceRouter.post(
  '/check-out',
  validate({ body: checkInSchema }),
  asyncHandler(async (req, res) => {
    res.json(await attendanceService.checkOut(req.user!, req.body));
  }),
);

attendanceRouter.post(
  '/wfh-confirm',
  asyncHandler(async (req, res) => {
    res.json(await attendanceService.wfhConfirm(req.user!));
  }),
);

attendanceRouter.get(
  '/:userId',
  requireSelfOrManagerOrAdmin('userId'),
  validate({ query: z.object({ month: yearMonth.optional() }) }),
  asyncHandler(async (req, res) => {
    const month = (req.query.month as string | undefined) ?? istToday().slice(0, 7);
    res.json(await attendanceService.month(req.params.userId, month));
  }),
);

attendanceRouter.patch(
  '/:userId/:day',
  requireAdmin,
  validate({ body: overrideAttendanceSchema }),
  asyncHandler(async (req, res) => {
    res.json(await attendanceService.override(req.params.userId, req.params.day, req.body, req.user!.id));
  }),
);
