import { and, desc, eq, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb, schema } from '../../db/client';
import type { Bindings } from '../index';

export const transactionsRoute = new Hono<{ Bindings: Bindings }>()
  .get('/', async (c) => {
    const db = getDb(c.env.DB);
    const month = c.req.query('month'); // e.g. '2026-09'
    const category = c.req.query('category');
    const search = c.req.query('search');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const conditions = [];

    if (month) {
      conditions.push(like(schema.transactions.date, `${month}%`));
    }
    if (category && category !== 'Semua') {
      conditions.push(eq(schema.transactions.category, category));
    }
    if (search) {
      conditions.push(
        sql`(${schema.transactions.name} LIKE ${`%${search}%`} OR ${schema.transactions.notes} LIKE ${`%${search}%`} OR ${schema.transactions.debtor} LIKE ${`%${search}%`} OR ${schema.transactions.creditor} LIKE ${`%${search}%`})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(schema.transactions)
      .where(whereClause)
      .orderBy(
        desc(schema.transactions.date),
        desc(schema.transactions.time),
        desc(schema.transactions.id)
      )
      .limit(limit)
      .offset(offset);

    return c.json({ success: true, data });
  })
  .post('/', async (c) => {
    const db = getDb(c.env.DB);
    const body = await c.req.json<{
      name: string;
      amount: number;
      date: string; // YYYY-MM-DD
      time: string; // HH:mm:ss
      category: string;
      debtor?: string;
      creditor?: string;
      debtAmount?: number;
      notes?: string;
    }>();

    if (!body.name || !body.amount || !body.date || !body.category) {
      return c.json({ success: false, error: 'Data transaksi tidak lengkap' }, 400);
    }

    const inserted = await db
      .insert(schema.transactions)
      .values({
        name: body.name.trim(),
        amount: Math.round(body.amount),
        date: body.date,
        time: body.time || '12:00:00',
        category: body.category,
        debtor: body.debtor?.trim() || null,
        creditor: body.creditor?.trim() || null,
        debtAmount: body.debtAmount ? Math.round(body.debtAmount) : 0,
        notes: body.notes?.trim() || null
      })
      .returning();

    // Update debts table if debtor or creditor is specified
    if (body.debtor && body.debtAmount) {
      const contact = body.debtor.trim().toUpperCase();
      const existing = await db
        .select()
        .from(schema.debts)
        .where(eq(schema.debts.contactName, contact))
        .get();
      if (existing) {
        await db
          .update(schema.debts)
          .set({
            totalOwedToUs: existing.totalOwedToUs + body.debtAmount,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(schema.debts.id, existing.id));
      } else {
        await db.insert(schema.debts).values({
          contactName: contact,
          totalOwedToUs: body.debtAmount,
          totalWeOwe: 0
        });
      }
    } else if (body.creditor && body.debtAmount) {
      const contact = body.creditor.trim().toUpperCase();
      const existing = await db
        .select()
        .from(schema.debts)
        .where(eq(schema.debts.contactName, contact))
        .get();
      if (existing) {
        await db
          .update(schema.debts)
          .set({
            totalWeOwe: existing.totalWeOwe + body.debtAmount,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(schema.debts.id, existing.id));
      } else {
        await db.insert(schema.debts).values({
          contactName: contact,
          totalOwedToUs: 0,
          totalWeOwe: body.debtAmount
        });
      }
    }

    return c.json({ success: true, data: inserted[0] });
  })
  .delete('/:id', async (c) => {
    const db = getDb(c.env.DB);
    const id = parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      return c.json({ success: false, error: 'ID tidak valid' }, 400);
    }

    const existing = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();
    if (!existing) {
      return c.json({ success: false, error: 'Transaksi tidak ditemukan' }, 404);
    }

    // Adjust debts if needed
    if (existing.debtor && existing.debtAmount) {
      const contact = existing.debtor.trim().toUpperCase();
      const debt = await db
        .select()
        .from(schema.debts)
        .where(eq(schema.debts.contactName, contact))
        .get();
      if (debt) {
        await db
          .update(schema.debts)
          .set({
            totalOwedToUs: Math.max(0, debt.totalOwedToUs - existing.debtAmount),
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(schema.debts.id, debt.id));
      }
    } else if (existing.creditor && existing.debtAmount) {
      const contact = existing.creditor.trim().toUpperCase();
      const debt = await db
        .select()
        .from(schema.debts)
        .where(eq(schema.debts.contactName, contact))
        .get();
      if (debt) {
        await db
          .update(schema.debts)
          .set({
            totalWeOwe: Math.max(0, debt.totalWeOwe - existing.debtAmount),
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(schema.debts.id, debt.id));
      }
    }

    await db.delete(schema.transactions).where(eq(schema.transactions.id, id));
    return c.json({ success: true, deleted: existing });
  });
