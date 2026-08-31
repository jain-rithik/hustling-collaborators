import { Router } from 'express';
import { completeTaskSchema, createTaskSchema, reorderTasksSchema, updateTaskSchema } from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { taskService } from '../services/taskService.js';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { ownerId, date, from, to, campaignId, carryOver } = req.query as Record<string, string | undefined>;
    res.json({
      tasks: await taskService.list(
        { ownerId, date, from, to, campaignId, carryOver: carryOver === '1' || carryOver === 'true' },
        req.user!,
      ),
    });
  }),
);

// The past-30-days log, grouped into date tabs (v4 change log).
tasksRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const { ownerId, days } = req.query as Record<string, string | undefined>;
    const parsed = days ? Number(days) : undefined;
    res.json(
      await taskService.history(
        ownerId ?? req.user!.id,
        req.user!,
        Number.isFinite(parsed) && parsed! > 0 ? Math.min(parsed!, 90) : undefined,
      ),
    );
  }),
);

// Manual top-to-bottom ordering.
tasksRouter.post(
  '/reorder',
  validate({ body: reorderTasksSchema }),
  asyncHandler(async (req, res) => {
    res.json(await taskService.reorder(req.body.ids, req.user!));
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
