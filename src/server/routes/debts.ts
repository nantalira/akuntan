import { desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb, schema } from '../../db/client';
import type { Bindings } from '../index';

export const debtsRoute = new Hono<{ Bindings: Bindings }>()
  .get('/', async (c) => {
    const db = getDb(c.env.DB);
    const rows = await db.select().from(schema.debts).orderBy(desc(schema.debts.updatedAt)).all();

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
  .post('/settle', async (c) => {
    const db = getDb(c.env.DB);
    const body = await c.req.json<{
      contactName: string;
      amount?: number; // jika kosong, lunas total
      target: 'we_owe' | 'owed_to_us';
    }>();

    if (!body.contactName) {
      return c.json({ success: false, error: 'Nama kontak harus diisi' }, 400);
    }

    const contact = body.contactName.trim().toUpperCase();
    const existing = await db
      .select()
      .from(schema.debts)
      .where(eq(schema.debts.contactName, contact))
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
