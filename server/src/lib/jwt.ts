import jwt from 'jsonwebtoken';
import { ACCESS_TOKEN_TTL, type UserRole } from '@hc/shared';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string; // userId
  role: UserRole;
  isAdmin: boolean;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') throw new Error('unexpected token payload');
  return {
    sub: String(decoded.sub),
    role: decoded.role as UserRole,
    isAdmin: Boolean(decoded.isAdmin),
  };
}
