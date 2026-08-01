import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

/** Single shared Prisma client. Repositories are the only layer that touches this. */
export const prisma = new PrismaClient({
  log: isProd ? ['warn', 'error'] : ['warn', 'error'],
});
