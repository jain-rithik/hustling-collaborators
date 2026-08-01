import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await notificationService.list(req.user!.id));
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    res.json(await notificationService.markRead(req.params.id, req.user!.id));
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    res.json(await notificationService.markAllRead(req.user!.id));
  }),
);
