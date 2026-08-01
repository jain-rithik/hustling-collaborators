import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wrap an async handler so thrown/rejected errors reach the errorHandler middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
