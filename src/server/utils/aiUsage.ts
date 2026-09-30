import { and, eq, sql } from 'drizzle-orm';
import { type getDb, schema } from '../../db/client';

export type AiQuotaStatus = {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  model: string;
  status: 'safe' | 'warning' | 'exceeded';
  isCustomKey?: boolean;
};

type AppDb = ReturnType<typeof getDb>;

export function getTodayDateString(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export function getAiDailyLimit(modelName?: string, overrideLimit?: string | number): number {
  if (overrideLimit) {
    const parsed = typeof overrideLimit === 'number' ? overrideLimit : parseInt(overrideLimit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  const model = (modelName || '').toLowerCase();
  if (model.includes('lite')) {
    return 500;
  }
  return 20;
}

export async function resolveUserGeminiConfig(
  db: AppDb,
  userId: number,
  serverApiKey?: string
): Promise<{ apiKey?: string; isCustomKey: boolean }> {
  const user = await db
    .select({ geminiApiKey: schema.users.geminiApiKey })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  const customKey = user?.geminiApiKey?.trim();
  if (customKey && customKey.length > 0) {
    return { apiKey: customKey, isCustomKey: true };
  }
  return { apiKey: serverApiKey, isCustomKey: false };
}

export async function getAiQuotaStatus(
  db: AppDb,
  userId: number,
  modelName: string = 'gemini-3.5-flash-lite',
  overrideLimit?: string | number,
  isCustomKey: boolean = false
): Promise<AiQuotaStatus> {
  const date = getTodayDateString();
  const record = await db
    .select()
    .from(schema.aiUsage)
    .where(and(eq(schema.aiUsage.userId, userId), eq(schema.aiUsage.date, date)))
    .get();

  const used = record?.requestCount ?? 0;
  const limit = isCustomKey ? 9999 : getAiDailyLimit(modelName, overrideLimit);
  const remaining = Math.max(0, limit - used);

  let status: 'safe' | 'warning' | 'exceeded' = 'safe';
  if (!isCustomKey) {
    if (remaining === 0) {
      status = 'exceeded';
    } else if (remaining <= Math.ceil(limit * 0.2)) {
      status = 'warning';
    }
  }

  return {
    date,
    used,
    limit,
    remaining,
    model: modelName,
    status,
    isCustomKey
  };
}

export async function incrementAiUsage(
  db: AppDb,
  userId: number,
  modelName: string
): Promise<number> {
  const date = getTodayDateString();

  await db
    .insert(schema.aiUsage)
    .values({
      userId,
      date,
      requestCount: 1,
      modelUsed: modelName
    })
    .onConflictDoUpdate({
      target: [schema.aiUsage.userId, schema.aiUsage.date],
      set: {
        requestCount: sql`${schema.aiUsage.requestCount} + 1`,
        modelUsed: modelName,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

  const record = await db
    .select({ requestCount: schema.aiUsage.requestCount })
    .from(schema.aiUsage)
    .where(and(eq(schema.aiUsage.userId, userId), eq(schema.aiUsage.date, date)))
    .get();

  return record?.requestCount ?? 1;
}
