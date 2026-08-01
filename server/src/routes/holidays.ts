import { Router } from 'express';
import {
  createHolidaySchema,
  createRemarkSchema,
  updateHolidaySchema,
  updateRemarkSchema,
} from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { holidayService } from '../services/holidayService.js';

export const holidaysRouter = Router();
holidaysRouter.use(requireAuth);

holidaysRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ holidays: await holidayService.list(req.query.fy as string | undefined) });
  }),
);

holidaysRouter.post(
  '/',
  requireAdmin,
  validate({ body: createHolidaySchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ holiday: await holidayService.create(req.body, req.user!) });
  }),
);

holidaysRouter.patch(
  '/:id',
  requireAdmin,
  validate({ body: updateHolidaySchema }),
  asyncHandler(async (req, res) => {
    res.json({ holiday: await holidayService.update(req.params.id, req.body) });
  }),
);

holidaysRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await holidayService.remove(req.params.id));
  }),
);

// ── Calendar remarks (mounted under /calendar-remarks) ───────────────────────
export const remarksRouter = Router();
remarksRouter.use(requireAuth);

remarksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = (req.query.userId as string | undefined) ?? req.user!.id;
    res.json({ remarks: await holidayService.listRemarks(userId, req.query.month as string | undefined) });
  }),
);

remarksRouter.post(
  '/',
  requireAdmin,
  validate({ body: createRemarkSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ remark: await holidayService.createRemark(req.body, req.user!) });
  }),
);

remarksRouter.patch(
  '/:id',
  requireAdmin,
  validate({ body: updateRemarkSchema }),
  asyncHandler(async (req, res) => {
    res.json({ remark: await holidayService.updateRemark(req.params.id, req.body.text) });
  }),
);

remarksRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await holidayService.deleteRemark(req.params.id));
  }),
);
