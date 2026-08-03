import { z } from 'zod';
import { email, password } from './common.js';
import { USER_ROLES } from '../enums.js';

export const loginSchema = z.object({
  email,
  // Login stays lax so we never leak the password policy on the login form.
  password: z.string().min(1, 'password required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'new password must differ from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Re-confirm the signed-in user's own password to unlock a sensitive view (e.g. salary). */
export const verifyPasswordSchema = z.object({ password: z.string().min(1, 'password required') });
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;

/** Shape returned by GET /auth/me and embedded in the login response. */
export interface AuthUser {
  id: string;
  email: string;
  role: (typeof USER_ROLES)[number];
  isAdmin: boolean;
  isFounder: boolean;
  fullName: string;
  employeeCode: string | null;
  photoUrl: string | null;
  reportingManagerId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
