import { randomUUID } from 'node:crypto';
import type { EmployeeProfile, User } from '@prisma/client';
import { type AuthUser, REFRESH_TOKEN_TTL_DAYS } from '@hc/shared';
import { authRepository } from '../repositories/authRepository.js';
import { signAccessToken } from '../lib/jwt.js';
import {
  generateRefreshToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../lib/hash.js';
import { unauthorized } from '../lib/errors.js';

type UserWithProfile = User & { profile: EmployeeProfile | null };

const refreshExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000);

function toAuthUser(u: UserWithProfile): AuthUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    isAdmin: u.isAdmin,
    isFounder: u.isFounder,
    fullName: u.profile?.fullName ?? '',
    employeeCode: u.profile?.employeeCode ?? null,
    photoUrl: u.profile?.photoUrl ?? null,
    reportingManagerId: u.profile?.reportingManagerId ?? null,
  };
}

async function mintRefresh(userId: string, familyId: string): Promise<string> {
  const raw = generateRefreshToken();
  await authRepository.createRefresh({
    userId,
    tokenHash: hashToken(raw),
    familyId,
    expiresAt: refreshExpiry(),
  });
  return raw;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const authService = {
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await authRepository.findByEmail(email);
    // Same message whether the email is unknown or the password is wrong (no user enumeration).
    const generic = () => unauthorized('Incorrect email or password.');
    if (!user || !user.isActive) throw generic();
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw generic();

    await authRepository.touchLogin(user.id, new Date());
    const accessToken = signAccessToken({ sub: user.id, role: user.role, isAdmin: user.isAdmin });
    const refreshToken = await mintRefresh(user.id, randomUUID());
    return { accessToken, refreshToken, user: toAuthUser(user) };
  },

  async refresh(raw: string | undefined): Promise<AuthResult> {
    if (!raw) throw unauthorized();
    const rec = await authRepository.findRefreshByHash(hashToken(raw));
    if (!rec) throw unauthorized('Session expired — please log in again');

    // Reuse of a revoked token, or an expired token → revoke the whole family (breach guard).
    if (rec.revokedAt || rec.expiresAt < new Date()) {
      await authRepository.revokeFamily(rec.familyId);
      throw unauthorized('Session expired — please log in again');
    }

    const user = await authRepository.findByIdWithProfile(rec.userId);
    if (!user || !user.isActive) throw unauthorized();

    const refreshToken = await mintRefresh(user.id, rec.familyId);
    await authRepository.revokeRefresh(rec.id, hashToken(refreshToken));
    const accessToken = signAccessToken({ sub: user.id, role: user.role, isAdmin: user.isAdmin });
    return { accessToken, refreshToken, user: toAuthUser(user) };
  },

  async logout(raw: string | undefined): Promise<void> {
    if (!raw) return;
    const rec = await authRepository.findRefreshByHash(hashToken(raw));
    if (rec) await authRepository.revokeFamily(rec.familyId);
  },

  async me(userId: string): Promise<AuthUser> {
    const user = await authRepository.findByIdWithProfile(userId);
    if (!user) throw unauthorized();
    return toAuthUser(user);
  },

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await authRepository.findByIdWithProfile(userId);
    if (!user) throw unauthorized();
    const ok = await verifyPassword(current, user.passwordHash);
    if (!ok) throw unauthorized('Your current password is incorrect.');
    await authRepository.updatePassword(userId, await hashPassword(next));
    await authRepository.revokeAllForUser(userId); // force re-login everywhere
  },

  /** Re-confirm the signed-in user's own password to unlock a sensitive view (e.g. salary). */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await authRepository.findByIdWithProfile(userId);
    if (!user) throw unauthorized();
    return verifyPassword(password, user.passwordHash);
  },
};
