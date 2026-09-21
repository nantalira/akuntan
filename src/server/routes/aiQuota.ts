import { Hono } from 'hono';
import { getDb } from '../../db/client';
import type { Bindings } from '../index';
import { getAiQuotaStatus } from '../utils/aiUsage';

export const aiQuotaRoute = new Hono<{ Bindings: Bindings }>().get('/', async (c) => {
  const db = getDb(c.env.DB);
  const modelName = c.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const status = await getAiQuotaStatus(db, modelName, c.env.AI_DAILY_LIMIT);

  return c.json({
    success: true,
    ...status
  });
});
