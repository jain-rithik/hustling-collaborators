import { Router } from 'express';
import { authRouter } from './auth.js';
import { profilesRouter } from './profiles.js';
import { tasksRouter } from './tasks.js';
import { campaignsRouter } from './campaigns.js';
import { attendanceRouter } from './attendance.js';
import { leaveRouter } from './leave.js';
import { compOffRouter } from './compOff.js';
import { holidaysRouter, remarksRouter } from './holidays.js';
import { leaderboardRouter } from './leaderboard.js';
import { focusRouter } from './focus.js';
import { notificationsRouter } from './notifications.js';
import { adminRouter } from './admin.js';
import { memeRouter } from './meme.js';
import { jobsRouter } from './jobs.js';

/** Root of /api/v1. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/profiles', profilesRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/campaigns', campaignsRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/leave', leaveRouter);
apiRouter.use('/comp-off', compOffRouter);
apiRouter.use('/holidays', holidaysRouter);
apiRouter.use('/calendar-remarks', remarksRouter);
apiRouter.use('/leaderboard', leaderboardRouter);
apiRouter.use('/focus', focusRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/meme', memeRouter);
apiRouter.use('/internal/jobs', jobsRouter);
// Convenience: upcoming birthdays live under profiles (GET /profiles/birthdays).
