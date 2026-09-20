import { Hono } from 'hono';
import { getDb, schema } from '../../db/client';
import type { Bindings } from '../index';

export const budgetsRoute = new Hono<{ Bindings: Bindings }>()
  .get('/', async (c) => {
    const db = getDb(c.env.DB);
    const list = await db.select().from(schema.budgets).all();
    return c.json({
      success: true,
      data: list
    });
  })
  .put('/', async (c) => {
    const db = getDb(c.env.DB);
    const body = await c.req.json<{
      budgets?: Array<{ category: string; monthlyLimit: number }>;
      category?: string;
      monthlyLimit?: number;
    }>();

    // Handle array batch update
    if (body.budgets && Array.isArray(body.budgets)) {
      for (const item of body.budgets) {
        await db
          .insert(schema.budgets)
          .values({
            category: item.category,
            monthlyLimit: item.monthlyLimit
          })
          .onConflictDoUpdate({
            target: schema.budgets.category,
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
          category: body.category,
          monthlyLimit: body.monthlyLimit
        })
        .onConflictDoUpdate({
          target: schema.budgets.category,
          set: { monthlyLimit: body.monthlyLimit }
        });
      return c.json({ success: true, message: 'Anggaran berhasil diperbarui' });
    }

    return c.json({ success: false, error: 'Format data anggaran tidak valid' }, 400);
  });
