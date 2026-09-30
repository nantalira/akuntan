import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../index';
import { verifyAuthToken } from '../utils/auth';

export const AUTH_COOKIE_NAME = 'akuntan_session';

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // 1. Check Authorization: Bearer <token> header first
  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Fallback to HttpOnly cookie
  if (!token) {
    token = getCookie(c, AUTH_COOKIE_NAME);
  }

  if (!token) {
    return c.json({ success: false, error: 'Unauthorized: Sesi login diperlukan' }, 401);
  }

  const payload = await verifyAuthToken(token, c.env);
  if (!payload) {
    return c.json(
      { success: false, error: 'Unauthorized: Sesi telah berakhir atau tidak valid' },
      401
    );
  }

  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  c.set('userName', payload.name);

  await next();
});
