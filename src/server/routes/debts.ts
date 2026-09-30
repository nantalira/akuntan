import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';

const settleDebtSchema = z.object({
  contactName: z.string().min(1, 'Nama kontak harus diisi'),
  amount: z.number().nonnegative().optional(),
  target: z.enum(['we_owe', 'owed_to_us'])
});

export const debtsRoute = new Hono<AppEnv>()
  .get('/', async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const rows = await db
      .select()
      .from(schema.debts)
      .where(eq(schema.debts.userId, userId))
      .orderBy(desc(schema.debts.updatedAt))
      .all();

    const data = rows.map((r) => ({
      id: r.id,
      contactName: r.contactName,
      totalOwedToUs: r.totalOwedToUs, // Mereka hutang ke kita (Piutang)
      totalWeOwe: r.totalWeOwe, // Kita hutang ke mereka (Hutang)
      netBalance: r.totalOwedToUs - r.totalWeOwe, // Positif = kita lebih banyak piutang, Negatif = kita berhutang
      updatedAt: r.updatedAt
    }));

    return c.json({ success: true, data });
  })
  .post('/settle', zValidator('json', settleDebtSchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const body = c.req.valid('json');

    const contact = body.contactName.trim().toUpperCase();
    const existing = await db
      .select()
      .from(schema.debts)
      .where(and(eq(schema.debts.userId, userId), eq(schema.debts.contactName, contact)))
      .get();

    if (!existing) {
      return c.json({ success: false, error: 'Kontak tidak ditemukan' }, 404);
    }

    let updatedWeOwe = existing.totalWeOwe;
    let updatedOwedToUs = existing.totalOwedToUs;

    if (body.target === 'we_owe') {
      // Kita melunasi hutang ke mereka
      const settleAmount = body.amount ?? existing.totalWeOwe;
      updatedWeOwe = Math.max(0, existing.totalWeOwe - settleAmount);
    } else {
      // Mereka melunasi hutang ke kita
      const settleAmount = body.amount ?? existing.totalOwedToUs;
      updatedOwedToUs = Math.max(0, existing.totalOwedToUs - settleAmount);
    }

    const updated = await db
      .update(schema.debts)
      .set({
        totalWeOwe: updatedWeOwe,
        totalOwedToUs: updatedOwedToUs,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(schema.debts.id, existing.id))
      .returning();

    return c.json({ success: true, data: updated[0] });
  });
