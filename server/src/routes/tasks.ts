import { Router } from 'express';
import { completeTaskSchema, createTaskSchema, updateTaskSchema } from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { taskService } from '../services/taskService.js';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { ownerId, date, campaignId } = req.query as Record<string, string | undefined>;
    res.json({ tasks: await taskService.list({ ownerId, date, campaignId }, req.user!) });
  }),
);

tasksRouter.post(
  '/',
  validate({ body: createTaskSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json({ task: await taskService.create(req.body, req.user!) });
  }),
);

tasksRouter.patch(
  '/:id',
  validate({ body: updateTaskSchema }),
  asyncHandler(async (req, res) => {
    res.json({ task: await taskService.update(req.params.id, req.body, req.user!) });
  }),
);

tasksRouter.post(
  '/:id/start',
  asyncHandler(async (req, res) => {
    res.json({ task: await taskService.start(req.params.id, req.user!) });
  }),
);

tasksRouter.post(
  '/:id/complete',
  validate({ body: completeTaskSchema }),
  asyncHandler(async (req, res) => {
    res.json(await taskService.complete(req.params.id, req.body, req.user!));
  }),
);

tasksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await taskService.remove(req.params.id, req.user!));
  }),
);
