import { Hono } from 'hono';
import { getDb } from '../../db/client';
import type { AppEnv } from '../index';
import { getAiQuotaStatus, resolveUserGeminiConfig } from '../utils/aiUsage';

export const aiQuotaRoute = new Hono<AppEnv>().get('/', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const modelName = c.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const { isCustomKey } = await resolveUserGeminiConfig(db, userId, c.env.GEMINI_API_KEY);
  const status = await getAiQuotaStatus(db, userId, modelName, c.env.AI_DAILY_LIMIT, isCustomKey);

  return c.json({
    success: true,
    ...status
  });
});
