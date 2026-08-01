import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../constants.js';

/** Shared zod primitives used across request/response schemas on both client and server. */

export const uuid = z.string().uuid();

/** Emails are normalized to lowercase + trimmed everywhere. */
export const email = z
  .string()
  .email()
  .transform((s) => s.toLowerCase().trim());

/** An IST calendar date, wire format YYYY-MM-DD (never a full timestamp). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an IST date in YYYY-MM-DD form');

/** A month key, YYYY-MM (used for calendar + leaderboard queries). */
export const yearMonth = z.string().regex(/^\d{4}-\d{2}$/, 'expected YYYY-MM');

/** A new-password field (login uses a laxer `.min(1)` so we never leak the policy on login). */
export const password = z.string().min(MIN_PASSWORD_LENGTH, `min ${MIN_PASSWORD_LENGTH} characters`);

/** WGS84 coordinate captured at check-in/out (nullable — GPS may be denied; PRD forbids punitive UX). */
export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);

export const geoPoint = z.object({
  lat: latitude.nullable().optional(),
  lng: longitude.nullable().optional(),
  accuracy: z.number().nonnegative().nullable().optional(),
});
export type GeoPoint = z.infer<typeof geoPoint>;
