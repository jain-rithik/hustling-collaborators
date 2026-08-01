import pino from 'pino';
import { env, isTest } from '../config/env.js';

/** Structured JSON logger. Silent under test so the suite output stays clean. */
export const logger = pino({
  level: isTest ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
});
