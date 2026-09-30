import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';

const updateBudgetsSchema = z.object({
  budgets: z
    .array(
      z.object({
        category: z.string().min(1),
        monthlyLimit: z.number().nonnegative()
      })
    )
    .optional(),
  category: z.string().optional(),
  monthlyLimit: z.number().nonnegative().optional()
});

export const budgetsRoute = new Hono<AppEnv>()
  .get('/', async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const list = await db
      .select()
      .from(schema.budgets)
      .where(eq(schema.budgets.userId, userId))
      .all();
    return c.json({
      success: true,
      data: list
    });
  })
  .put('/', zValidator('json', updateBudgetsSchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const body = c.req.valid('json');

    // Handle array batch update
    if (body.budgets && Array.isArray(body.budgets)) {
      for (const item of body.budgets) {
        await db
          .insert(schema.budgets)
          .values({
            userId,
            category: item.category,
            monthlyLimit: item.monthlyLimit
          })
          .onConflictDoUpdate({
            target: [schema.budgets.userId, schema.budgets.category],
            set: { monthlyLimit: item.monthlyLimit }
          });
      }
      return c.json({ success: true, message: 'Anggaran berhasil diperbarui' });
    }

    // Handle single item update
    if (body.category && typeof body.monthlyLimit === 'number') {
      await db
        .insert(schema.budgets)
        .values({
          userId,
          category: body.category,
          monthlyLimit: body.monthlyLimit
        })
        .onConflictDoUpdate({
          target: [schema.budgets.userId, schema.budgets.category],
          set: { monthlyLimit: body.monthlyLimit }
        });
      return c.json({ success: true, message: 'Anggaran berhasil diperbarui' });
    }

    return c.json({ success: false, error: 'Format data anggaran tidak valid' }, 400);
  });
