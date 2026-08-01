import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { BCRYPT_COST } from '@hc/shared';

/** Password hashing (bcryptjs — pure JS, no native build, safe on free-tier hosts). */
export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_COST);
export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/** Opaque refresh tokens: a random secret handed to the client, only its SHA-256 stored. */
export const generateRefreshToken = (): string => randomBytes(48).toString('base64url');
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
