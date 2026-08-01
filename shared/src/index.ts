/**
 * @hc/shared — the single contract imported by BOTH the web app and the server.
 * Enums, business constants, and zod request/response schemas live here so a change
 * to any contract is a compile error everywhere it is used.
 */
export * from './enums.js';
export * from './constants.js';
export * from './schemas/common.js';
export * from './schemas/auth.js';
export * from './schemas/requests.js';
