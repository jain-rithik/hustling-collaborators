import { prisma } from '../lib/prisma.js';

export const notificationService = {
  async list(userId: string) {
    const rows = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const unread = rows.filter((r) => !r.isRead).length;
    return {
      unread,
      notifications: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        payload: r.payload,
        isRead: r.isRead,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },

  async markRead(id: string, userId: string) {
    await prisma.notification.updateMany({ where: { id, recipientId: userId }, data: { isRead: true } });
    return { ok: true };
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({ where: { recipientId: userId, isRead: false }, data: { isRead: true } });
    return { ok: true };
  },
};
