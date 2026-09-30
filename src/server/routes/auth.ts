import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { users } from '../../db/schema';
import type { AppEnv } from '../index';
import { AUTH_COOKIE_NAME, authMiddleware } from '../middleware/auth';
import { generateWebhookToken, hashPassword, signAuthToken, verifyPassword } from '../utils/auth';

const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(80),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter').max(128)
});

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi')
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  geminiApiKey: z.string().nullable().optional()
});

function serializeUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    hasCustomGeminiKey: Boolean(u.geminiApiKey && u.geminiApiKey.trim().length > 0),
    geminiApiKeyMasked: u.geminiApiKey
      ? `${u.geminiApiKey.slice(0, 6)}...${u.geminiApiKey.slice(-4)}`
      : null,
    webhookToken: u.webhookToken,
    createdAt: u.createdAt
  };
}

export const authRoute = new Hono<AppEnv>()
  .post('/register', zValidator('json', registerSchema), async (c) => {
    const { name, email, password } = c.req.valid('json');
    const normalizedEmail = email.trim().toLowerCase();
    const db = drizzle(c.env.DB);

    // Check if email already exists
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();

    if (existing) {
      return c.json(
        { success: false, error: 'Email sudah terdaftar. Silakan masuk (Login).' },
        409
      );
    }

    const passwordHash = await hashPassword(password);
    const webhookToken = generateWebhookToken();

    const inserted = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        webhookToken
      })
      .returning()
      .get();

    const token = await signAuthToken(
      { sub: inserted.id, email: inserted.email, name: inserted.name },
      c.env
    );

    setCookie(c, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    });

    return c.json(
      {
        success: true,
        token,
        data: serializeUser(inserted)
      },
      201
    );
  })
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json');
    const normalizedEmail = email.trim().toLowerCase();
    const db = drizzle(c.env.DB);

    const user = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();

    if (!user?.passwordHash) {
      return c.json({ success: false, error: 'Email atau password salah' }, 401);
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return c.json({ success: false, error: 'Email atau password salah' }, 401);
    }

    const token = await signAuthToken({ sub: user.id, email: user.email, name: user.name }, c.env);

    setCookie(c, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    });

    return c.json({
      success: true,
      token,
      data: serializeUser(user)
    });
  })
  .post('/logout', (c) => {
    deleteCookie(c, AUTH_COOKIE_NAME, { path: '/' });
    return c.json({ success: true });
  })
  .get('/me', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);

    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
      return c.json({ success: false, error: 'Akun tidak ditemukan' }, 404);
    }

    return c.json({
      success: true,
      data: serializeUser(user)
    });
  })
  .put('/profile', authMiddleware, zValidator('json', updateProfileSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const db = drizzle(c.env.DB);

    const updateValues: Partial<typeof users.$inferInsert> = {};
    if (body.name !== undefined) {
      updateValues.name = body.name.trim();
    }
    if (body.geminiApiKey !== undefined) {
      const cleanedKey = body.geminiApiKey?.trim() || null;
      updateValues.geminiApiKey = cleanedKey;
    }

    const updated = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, userId))
      .returning()
      .get();

    if (!updated) {
      return c.json({ success: false, error: 'Akun tidak ditemukan' }, 404);
    }

    return c.json({
      success: true,
      data: serializeUser(updated)
    });
  })
  .post('/webhook-token/regenerate', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);

    const newWebhookToken = generateWebhookToken();
    const updated = await db
      .update(users)
      .set({ webhookToken: newWebhookToken })
      .where(eq(users.id, userId))
      .returning()
      .get();

    if (!updated) {
      return c.json({ success: false, error: 'Akun tidak ditemukan' }, 404);
    }

    return c.json({
      success: true,
      data: serializeUser(updated)
    });
  });
