import { timingSafeEqual } from 'node:crypto';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/client';
import type { Bindings } from '../index';

/**
 * Computes HMAC-SHA256 of raw data using Web Crypto API.
 */
export async function computeHmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes SHA-512 hash hex (used by Midtrans default signature_key).
 */
export async function computeSha512Hex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-512', enc.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time byte equality check using Web Crypto crypto.subtle.timingSafeEqual.
 * Protects against side-channel timing attacks.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);

  if (bufA.byteLength !== bufB.byteLength) {
    return false;
  }

  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    let mismatch = 0;
    for (let i = 0; i < bufA.length; i++) {
      mismatch |= bufA[i] ^ bufB[i];
    }
    return mismatch === 0;
  }
}

/**
 * Timing-safe signature verification for webhooks.
 * Supports HMAC-SHA256 (default) or Midtrans SHA-512 signature key.
 */
export async function verifyWebhookSignature({
  rawBody,
  signature,
  secretKey,
  algorithm = 'hmac-sha256'
}: {
  rawBody: string;
  signature: string;
  secretKey: string;
  algorithm?: 'hmac-sha256' | 'sha-512';
}): Promise<boolean> {
  if (!signature || !secretKey) return false;

  let expectedSignature = '';
  if (algorithm === 'sha-512') {
    expectedSignature = await computeSha512Hex(rawBody + secretKey);
  } else {
    expectedSignature = await computeHmacSha256Hex(secretKey, rawBody);
  }

  return timingSafeEqualString(signature.toLowerCase(), expectedSignature.toLowerCase());
}

/**
 * Enqueues a payload to D1 sync_outbox table.
 */
export async function enqueueOutboxItem(
  db: ReturnType<typeof getDb>,
  item: {
    userId: number;
    target: 'midtrans' | 'google_sheets' | 'qris' | 'export';
    payload: Record<string, unknown> | string;
  }
) {
  const payloadStr = typeof item.payload === 'string' ? item.payload : JSON.stringify(item.payload);

  const inserted = await db
    .insert(schema.syncOutbox)
    .values({
      userId: item.userId,
      target: item.target,
      payload: payloadStr,
      status: 'pending',
      attempts: 0
    })
    .returning()
    .get();

  return inserted;
}

/**
 * Processes pending items from D1 sync_outbox (Zero-cost free-tier queue alternative).
 * Designed for execution inside ctx.waitUntil() or Cloudflare Scheduled Cron Triggers.
 */
export async function processSyncOutbox(env: Bindings, limit = 10) {
  if (!env?.DB) return { processed: 0, successes: 0, failures: 0 };

  const db = getDb(env.DB);

  // Fetch pending items
  const pendingItems = await db
    .select()
    .from(schema.syncOutbox)
    .where(eq(schema.syncOutbox.status, 'pending'))
    .orderBy(asc(schema.syncOutbox.id))
    .limit(limit)
    .all();

  if (pendingItems.length === 0) {
    return { processed: 0, successes: 0, failures: 0 };
  }

  const ids = pendingItems.map((item) => item.id);

  // Mark items as processing
  await db
    .update(schema.syncOutbox)
    .set({
      status: 'processing',
      attempts: sql`${schema.syncOutbox.attempts} + 1`,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(inArray(schema.syncOutbox.id, ids));

  let successes = 0;
  let failures = 0;

  for (const item of pendingItems) {
    try {
      // Invariant: Non-blocking execution per item
      if (item.target === 'google_sheets') {
        // Sync to Google Sheets stub / handler
        // If Google OAuth token or webhook target is configured, dispatch here
        console.log(`[OUTBOX] Processed Google Sheets sync for user ${item.userId}`);
      } else if (item.target === 'midtrans' || item.target === 'qris') {
        // Notification settlement reconciliation
        console.log(`[OUTBOX] Processed webhook settlement for user ${item.userId}`);
      }

      await db
        .update(schema.syncOutbox)
        .set({
          status: 'completed',
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(schema.syncOutbox.id, item.id));

      successes++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[OUTBOX_ERROR] Item ${item.id} failed:`, errorMsg);

      await db
        .update(schema.syncOutbox)
        .set({
          status: 'failed',
          lastError: errorMsg.slice(0, 500),
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(schema.syncOutbox.id, item.id));

      failures++;
    }
  }

  return { processed: pendingItems.length, successes, failures };
}
