import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'The requested resource was not found.' } });
};

/**
 * Single funnel for all errors → `{ error: { code, message, details? } }`. The client
 * maps `code` to friendly copy; the real error is logged server-side (PRD §6.7).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Some details need a quick check — please review and try again.',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err }, 'AppError (5xx)');
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'internal', message: 'Something went wrong on our side. Please try again shortly.' },
  });
};
