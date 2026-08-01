import 'dotenv/config';
import { z } from 'zod';

/**
 * Validate process.env at boot — fail fast with a clear message if anything is
 * missing/malformed (architecture §8.6). The domain layer must NEVER import this
 * (it stays pure); only services/lib/app do.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  REFRESH_SECRET: z.string().min(16, 'REFRESH_SECRET must be at least 16 chars'),
  JOB_SECRET: z.string().min(8, 'JOB_SECRET must be at least 8 chars'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:\n', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed — see server/.env.example');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
