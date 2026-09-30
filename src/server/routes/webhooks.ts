import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';
import { parseQrisNotificationSmart } from '../utils/paymentParser';

const webhookQrisSchema = z.object({
  app: z.string().trim().optional(),
  title: z.string().trim().optional(),
  text: z.string().trim().min(1, 'Teks notifikasi tidak boleh kosong'),
  timestamp: z.string().trim().optional(),
  referenceId: z.string().trim().optional()
});

function getJakartaDateTime(customIso?: string) {
  const baseDate = customIso ? new Date(customIso) : new Date();
  const validDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const jakartaTime = new Date(validDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');
  const day = String(jakartaTime.getDate()).padStart(2, '0');
  const hours = String(jakartaTime.getHours()).padStart(2, '0');
  const minutes = String(jakartaTime.getMinutes()).padStart(2, '0');
  const seconds = String(jakartaTime.getSeconds()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}`
  };
}

export const webhooksRoute = new Hono<AppEnv>().post(
  '/qris/:token',
  zValidator('json', webhookQrisSchema),
  async (c) => {
    const token = c.req.param('token')?.trim() || c.req.header('X-Webhook-Token')?.trim() || '';

    if (!token) {
      return c.json({ success: false, error: 'Token webhook tidak ditemukan' }, 401);
    }

    const db = getDb(c.env.DB);
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.webhookToken, token))
      .get();

    if (!user) {
      return c.json({ success: false, error: 'Token webhook tidak valid atau sudah diganti' }, 401);
    }

    const body = c.req.valid('json');

    const parsed = await parseQrisNotificationSmart(
      body.text,
      body.title,
      body.app,
      db,
      user.id,
      c.env
    );

    if (!parsed?.amount || parsed.amount <= 0) {
      return c.json({
        success: true,
        ignored: true,
        engine: parsed?.parsedBy === 'ai' ? 'gemini_ai' : 'regex_0_quota',
        message: 'Notifikasi diabaikan karena bukan transaksi pembayaran/pengeluaran.'
      });
    }

    const finalRefId = body.referenceId || parsed.referenceId || null;

    // 1. Check exact referenceId deduplication if available
    if (finalRefId) {
      const existingByRef = await db
        .select()
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, user.id),
            eq(schema.transactions.referenceId, finalRefId)
          )
        )
        .get();

      if (existingByRef) {
        return c.json({
          success: true,
          deduplicated: true,
          message: 'Transaksi dengan nomor referensi ini sudah tercatat sebelumnya.',
          data: existingByRef
        });
      }
    }

    // 2. Check 3-minute time-window deduplication for same userId + amount + merchant
    const recentTx = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, user.id),
          eq(schema.transactions.amount, parsed.amount),
          eq(schema.transactions.name, parsed.merchant)
        )
      )
      .orderBy(desc(schema.transactions.id))
      .limit(1)
      .get();

    if (recentTx?.createdAt) {
      const recentMs = new Date(`${recentTx.createdAt.replace(' ', 'T')}Z`).getTime();
      const diffSeconds = Math.abs(Date.now() - recentMs) / 1000;
      if (!Number.isNaN(diffSeconds) && diffSeconds <= 180) {
        return c.json({
          success: true,
          deduplicated: true,
          message: 'Transaksi identik dalam 3 menit terakhir terdeteksi (anti-dobel aktif).',
          data: recentTx
        });
      }
    }

    const { date, time } = getJakartaDateTime(body.timestamp);
    const appLabel = body.app ? `[${body.app}] ` : '';
    const notesText = `${appLabel}${body.text}`.slice(0, 180);

    const created = await db
      .insert(schema.transactions)
      .values({
        userId: user.id,
        date,
        time,
        category: parsed.category,
        name: parsed.merchant,
        amount: parsed.amount,
        paymentMethod: parsed.paymentMethod,
        referenceId: finalRefId,
        notes: notesText,
        source: 'qris_webhook'
      })
      .returning()
      .get();

    return c.json(
      {
        success: true,
        deduplicated: false,
        engine: parsed.parsedBy === 'ai' ? 'gemini_ai' : 'regex_0_quota',
        data: created
      },
      201
    );
  }
);
