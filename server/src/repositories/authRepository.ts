import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export const authRepository = {
  findByEmail: (email: string) =>
    prisma.user.findUnique({ where: { email }, include: { profile: true } }),

  findByIdWithProfile: (id: string) =>
    prisma.user.findUnique({ where: { id }, include: { profile: true } }),

  touchLogin: (id: string, at: Date) =>
    prisma.user.update({ where: { id }, data: { lastLoginAt: at } }),

  updatePassword: (id: string, passwordHash: string) =>
    prisma.user.update({ where: { id }, data: { passwordHash } }),

  createRefresh: (data: Prisma.RefreshTokenUncheckedCreateInput) =>
    prisma.refreshToken.create({ data }),

  findRefreshByHash: (tokenHash: string) =>
    prisma.refreshToken.findUnique({ where: { tokenHash } }),

  revokeRefresh: (id: string, replacedBy?: string) =>
    prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date(), replacedBy } }),

  revokeFamily: (familyId: string) =>
    prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),

  revokeAllForUser: (userId: string) =>
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
};
