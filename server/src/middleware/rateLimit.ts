import rateLimit from 'express-rate-limit';

/** Basic protection on /auth/* (architecture §2.2 / §10.5). Gentle, non-punitive copy. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'rate_limited', message: 'Thoda ruk ja bhidu — bahut tries ho gaye 😅' },
  },
});
