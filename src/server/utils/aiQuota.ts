import { eq, sql } from 'drizzle-orm';
import { type getDb, schema } from '../../db/client';
import {
  type AiQuotaStatus,
  getAiDailyLimit,
  getTodayDateString,
  resolveUserGeminiConfig
} from './aiUsage';

export { type AiQuotaStatus, getAiDailyLimit, getTodayDateString, resolveUserGeminiConfig };

type AppDb = ReturnType<typeof getDb>;

export type ConsumeQuotaOptions = {
  modelName?: string;
  overrideLimit?: string | number;
  serverApiKey?: string;
};

export type ConsumeQuotaResult = {
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  date: string;
  isCustomKey: boolean;
  message?: string;
};

/**
 * Returns user quota status directly from D1 users table.
 */
export async function getAiQuotaStatus(
  db: AppDb,
  userId: number,
  modelName: string = 'gemini-3.5-flash-lite',
  overrideLimit?: string | number,
  isCustomKey: boolean = false
): Promise<AiQuotaStatus> {
  const date = getTodayDateString();

  if (isCustomKey) {
    return {
      date,
      used: 0,
      limit: 9999,
      remaining: 9999,
      model: modelName,
      status: 'safe',
      isCustomKey: true
    };
  }

  const user = await db
    .select({
      used: schema.users.aiQuotaUsed,
      limit: schema.users.aiQuotaLimit
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  const used = user?.used ?? 0;
  const limit = user?.limit ?? (overrideLimit ? Number(overrideLimit) : 20);
  const remaining = Math.max(0, limit - used);

  let status: 'safe' | 'warning' | 'exceeded' = 'safe';
  if (remaining === 0) {
    status = 'exceeded';
  } else if (remaining <= Math.ceil(limit * 0.2)) {
    status = 'warning';
  }

  return {
    date,
    used,
    limit,
    remaining,
    model: modelName,
    status,
    isCustomKey: false
  };
}

/**
 * Synchronously checks and consumes AI quota using a single atomic SQLite UPDATE with RETURNING on users table.
 * Enforces Anti-Race Condition without read-then-write leaks on Cloudflare D1.
 * Returns allowed: false (HTTP 429 payload) immediately if 0 rows are returned.
 */
export async function consumeAiQuotaAtomic(
  db: AppDb,
  userId: number,
  options: ConsumeQuotaOptions = {}
): Promise<ConsumeQuotaResult> {
  const date = getTodayDateString();
  const { isCustomKey } = await resolveUserGeminiConfig(db, userId, options.serverApiKey);

  // 1. Custom key users are unmetered against the shared server quota
  if (isCustomKey) {
    return {
      allowed: true,
      remaining: 9999,
      used: 0,
      limit: 9999,
      date,
      isCustomKey: true
    };
  }

  // If overrideLimit is provided (e.g. for testing), optionally align ai_quota_limit first
  if (options.overrideLimit !== undefined) {
    const parsedLimit = Number(options.overrideLimit);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      await db.run(sql`
        UPDATE ${schema.users}
        SET ${sql.identifier('ai_quota_limit')} = ${parsedLimit}
        WHERE ${sql.identifier('id')} = ${userId}
      `);
    }
  }

  // 2. Single atomic SQL mutation on users table with RETURNING
  const res = await db.all<{ ai_quota_used: number; ai_quota_limit: number }>(sql`
    UPDATE ${schema.users}
    SET ${sql.identifier('ai_quota_used')} = ${sql.identifier('ai_quota_used')} + 1
    WHERE ${sql.identifier('id')} = ${userId}
      AND ${sql.identifier('ai_quota_used')} < ${sql.identifier('ai_quota_limit')}
    RETURNING ${sql.identifier('ai_quota_used')}, ${sql.identifier('ai_quota_limit')}
  `);

  if (!res || res.length === 0) {
    // 0 rows updated means quota is completely exhausted
    return {
      allowed: false,
      remaining: 0,
      used: 0,
      limit: 0,
      date,
      isCustomKey: false,
      message:
        'Kuota harian AI telah habis. Silakan catat manual atau masukkan Gemini API Key pribadi di Pengaturan Profil.'
    };
  }

  const used = res[0].ai_quota_used;
  const limit = res[0].ai_quota_limit;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: true,
    remaining,
    used,
    limit,
    date,
    isCustomKey: false
  };
}
