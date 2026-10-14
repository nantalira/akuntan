import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';
import {
  computeSha512Hex,
  enqueueOutboxItem,
  processSyncOutbox,
  timingSafeEqualString,
  verifyWebhookSignature
} from '../utils/outbox';
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

export const webhooksRoute = new Hono<AppEnv>()
  .post('/qris/:token', zValidator('json', webhookQrisSchema), async (c) => {
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

    // Enqueue outbox item for asynchronous Google Sheets sync (non-blocking)
    await enqueueOutboxItem(db, {
      userId: user.id,
      target: 'google_sheets',
      payload: {
        transactionId: created.id,
        date: created.date,
        time: created.time,
        name: created.name,
        amount: created.amount,
        category: created.category,
        paymentMethod: created.paymentMethod
      }
    });

    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(processSyncOutbox(c.env));
    }

    return c.json(
      {
        success: true,
        deduplicated: false,
        engine: parsed.parsedBy === 'ai' ? 'gemini_ai' : 'regex_0_quota',
        data: created
      },
      201
    );
  })
  .post('/midtrans', async (c) => {
    // Invariant: Webhook verification MUST read raw body before JSON parsing
    const rawBody = await c.req.text();
    if (!rawBody) {
      return c.json({ success: false, error: 'Empty payload' }, 400);
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
    }

    const serverKey = c.env.MIDTRANS_SERVER_KEY || c.env.WEBHOOK_SECRET || 'test_server_key';
    const orderId = String(payload.order_id || payload.orderId || '');
    const statusCode = String(payload.status_code || payload.statusCode || '');
    const grossAmount = String(payload.gross_amount || payload.grossAmount || '');
    const signatureKey = String(
      payload.signature_key || payload.signatureKey || c.req.header('X-Signature') || ''
    );

    // Invariant: Timing-safe cryptographic verification
    let isValid = false;
    if (c.req.header('X-Signature-SHA256') || c.req.header('X-Signature')) {
      const hmacSig = c.req.header('X-Signature-SHA256') || c.req.header('X-Signature') || '';
      isValid = await verifyWebhookSignature({
        rawBody,
        signature: hmacSig,
        secretKey: serverKey,
        algorithm: 'hmac-sha256'
      });
    } else if (signatureKey && orderId && statusCode && grossAmount) {
      const expectedHash = await computeSha512Hex(
        `${orderId}${statusCode}${grossAmount}${serverKey}`
      );
      isValid = timingSafeEqualString(signatureKey.toLowerCase(), expectedHash.toLowerCase());
    } else if (signatureKey) {
      isValid = await verifyWebhookSignature({
        rawBody,
        signature: signatureKey,
        secretKey: serverKey,
        algorithm: 'hmac-sha256'
      });
    }

    if (!isValid) {
      return c.json({ success: false, error: 'Invalid webhook signature' }, 401);
    }

    const db = getDb(c.env.DB);
    const transactionId = String(payload.transaction_id || orderId);

    // Invariant: Idempotency checking via ID transaksi in D1 before mutating billing
    const existingTx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.referenceId, transactionId))
      .get();

    if (existingTx) {
      return c.json({
        success: true,
        deduplicated: true,
        message: 'Transaction already processed',
        data: existingTx
      });
    }

    const transactionStatus = String(payload.transaction_status || 'settlement');
    const fraudStatus = String(payload.fraud_status || 'accept');

    // Deterministic payment method mapping
    const paymentType = String(payload.payment_type || '').toLowerCase();
    let paymentMethod = 'QRIS';
    if (paymentType.includes('gopay')) {
      paymentMethod = 'GoPay';
    } else if (paymentType.includes('shopeepay')) {
      paymentMethod = 'ShopeePay';
    } else if (paymentType.includes('bank_transfer') || paymentType.includes('echannel')) {
      paymentMethod = 'Transfer';
    } else if (paymentType.includes('cstore')) {
      paymentMethod = 'Indomaret/Alfamart';
    }

    const amount = Math.round(Number.parseFloat(grossAmount || '0'));
    const { date, time } = getJakartaDateTime(payload.transaction_time as string | undefined);

    // Determine user to credit (default to first active user or specified custom field)
    const customUserId = Number(payload.custom_field1);
    let targetUserId = Number.isInteger(customUserId) && customUserId > 0 ? customUserId : 0;
    if (!targetUserId) {
      const firstUser = await db.select({ id: schema.users.id }).from(schema.users).limit(1).get();
      targetUserId = firstUser?.id || 1;
    }

    let created = null;
    const isPaid =
      (transactionStatus === 'settlement' || transactionStatus === 'capture') &&
      fraudStatus === 'accept';

    if (isPaid && amount > 0) {
      created = await db
        .insert(schema.transactions)
        .values({
          userId: targetUserId,
          name: `Pembayaran ${orderId}`,
          amount,
          date,
          time,
          category: 'Primer',
          paymentMethod,
          referenceId: transactionId,
          notes: `Midtrans payment ${orderId} (${paymentType})`,
          source: 'qris_webhook'
        })
        .returning()
        .get();

      // Enqueue outbox item for async notification and cloud sheet sync
      await enqueueOutboxItem(db, {
        userId: targetUserId,
        target: 'midtrans',
        payload: {
          orderId,
          transactionId,
          amount,
          paymentMethod,
          transactionStatus
        }
      });

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(processSyncOutbox(c.env));
      }
    }

    return c.json(
      {
        success: true,
        deduplicated: false,
        status: transactionStatus,
        transaction: created
      },
      200
    );
  });
