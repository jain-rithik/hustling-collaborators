import { Router } from 'express';
import { authRouter } from './auth.js';

/** Root of /api/v1. Module routers are mounted here as they are built. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
