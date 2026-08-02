import type { Response } from 'express';
import { changePasswordSchema, loginSchema, REFRESH_TOKEN_TTL_DAYS } from '@hc/shared';
import { asyncHandler } from '../lib/http.js';
import { isProd } from '../config/env.js';
import { authService } from '../services/authService.js';

export const REFRESH_COOKIE = 'hc_refresh';
const REFRESH_PATH = '/api/v1/auth';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    // Web (vercel.app) and API (onrender.com) are cross-site, so the refresh cookie
    // must be SameSite=None; Secure in production. 'lax' keeps localhost dev working.
    sameSite: isProd ? 'none' : 'lax',
    path: REFRESH_PATH,
    maxAge: REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
}

export const authController = {
  login: asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.login(input.email, input.password);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  }),

  refresh: asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const { accessToken, refreshToken, user } = await authService.refresh(raw);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),

  me: asyncHandler(async (req, res) => {
    res.json({ user: await authService.me(req.user!.id) });
  }),

  changePassword: asyncHandler(async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, input.currentPassword, input.newPassword);
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
};
