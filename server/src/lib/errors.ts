/**
 * Typed application errors. The single errorHandler middleware turns these into the
 * `{ error: { code, message, details? } }` envelope; the client maps `code` to gentle,
 * funny copy (PRD §6.7 / §7.3 — never punitive, never a raw stack).
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'bad_request', message, details);

export const unauthorized = (message = 'Not authenticated') =>
  new AppError(401, 'unauthorized', message);

export const forbidden = (message = 'You do not have access to this') =>
  new AppError(403, 'forbidden', message);

export const notFound = (message = 'Not found') => new AppError(404, 'not_found', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'conflict', message, details);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'unprocessable', message, details);
