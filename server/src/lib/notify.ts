import type { NotificationType } from '@hc/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/** Create an in-app notification (PRD: in-app only, no external channels). */
export async function notify(
  recipientId: string,
  type: NotificationType,
  title: string,
  body: string,
  payload?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.notification.create({ data: { recipientId, type, title, body, payload } });
}

export async function notifyMany(
  recipientIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  payload?: Prisma.InputJsonValue,
): Promise<void> {
  const unique = [...new Set(recipientIds)].filter(Boolean);
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((recipientId) => ({ recipientId, type, title, body, payload })),
  });
}
