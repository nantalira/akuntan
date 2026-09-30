import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';

const listTransactionsQuerySchema = z.object({
  month: z.string().optional(),
  date: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional()
});

const frequentTransactionsQuerySchema = z.object({
  limit: z.string().optional()
});

const createTransactionSchema = z.object({
  name: z.string().min(1, 'Nama transaksi wajib diisi'),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  date: z.string().min(1, 'Tanggal wajib diisi'),
  time: z.string().optional(),
  category: z.string().min(1, 'Kategori wajib diisi'),
  debtor: z.string().optional(),
  creditor: z.string().optional(),
  debtAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceId: z.string().optional(),
  source: z.string().optional()
});

const transactionIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid')
});

export const transactionsRoute = new Hono<AppEnv>()
  .get('/', zValidator('query', listTransactionsQuerySchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const query = c.req.valid('query');
    const month = query.month; // e.g. '2026-09'
    const date = query.date; // e.g. '2026-09-21' or 'all'
    const category = query.category;
    const search = query.search;
    const limit = parseInt(query.limit || '50', 10);
    const offset = parseInt(query.offset || '0', 10);

    const conditions = [eq(schema.transactions.userId, userId)];

    if (date && date !== 'all') {
      conditions.push(eq(schema.transactions.date, date));
    } else if (month) {
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

    const whereClause = and(...conditions);

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
  .get('/frequent', zValidator('query', frequentTransactionsQuerySchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const { limit: limitParam } = c.req.valid('query');
    const limit = parseInt(limitParam || '15', 10);

    const rows = await db
      .select({
        name: schema.transactions.name,
        amount: schema.transactions.amount,
        category: schema.transactions.category,
        frequency: sql<number>`COUNT(*)`
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`LENGTH(TRIM(${schema.transactions.name})) >= 2 
              AND LENGTH(TRIM(${schema.transactions.name})) <= 30
              AND LOWER(${schema.transactions.name}) NOT LIKE 'saya%'
              AND LOWER(${schema.transactions.name}) NOT LIKE 'kemarin%'
              AND LOWER(${schema.transactions.name}) NOT LIKE 'tadi%'`
        )
      )
      .groupBy(sql`LOWER(TRIM(${schema.transactions.name}))`)
      .orderBy(sql`COUNT(*) DESC`, desc(schema.transactions.id))
      .limit(limit);

    return c.json({ success: true, data: rows });
  })
  .post('/', zValidator('json', createTransactionSchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const body = c.req.valid('json');

    const source = body.source?.trim() || 'manual';
    const paymentMethod = body.paymentMethod?.trim() || 'Cash';

    const inserted = await db
      .insert(schema.transactions)
      .values({
        userId,
        name: body.name.trim(),
        amount: Math.round(body.amount),
        date: body.date,
        time: body.time || '12:00:00',
        category: body.category,
        debtor: body.debtor?.trim() || null,
        creditor: body.creditor?.trim() || null,
        debtAmount: body.debtAmount ? Math.round(body.debtAmount) : 0,
        notes: body.notes?.trim() || null,
        paymentMethod,
        referenceId: body.referenceId?.trim() || null,
        source
      })
      .returning();

    console.log(
      `[TRANSACTION_LOGGER] User:${userId} | ID: ${inserted[0].id} | Nama: "${inserted[0].name}" | Rp${inserted[0].amount} | Kategori: ${inserted[0].category} | Sumber: ${inserted[0].source.toUpperCase()}`
    );

    // Update debts table if debtor or creditor is specified (scoped per userId)
    if (body.debtor && body.debtAmount) {
      const contact = body.debtor.trim().toUpperCase();
      const existing = await db
        .select()
        .from(schema.debts)
        .where(and(eq(schema.debts.userId, userId), eq(schema.debts.contactName, contact)))
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
          userId,
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
        .where(and(eq(schema.debts.userId, userId), eq(schema.debts.contactName, contact)))
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
          userId,
          contactName: contact,
          totalOwedToUs: 0,
          totalWeOwe: body.debtAmount
        });
      }
    }

    return c.json({ success: true, data: inserted[0] });
  })
  .delete('/:id', zValidator('param', transactionIdParamSchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const { id: idStr } = c.req.valid('param');
    const id = parseInt(idStr, 10);

    const existing = await db
      .select()
      .from(schema.transactions)
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
      .get();
    if (!existing) {
      return c.json({ success: false, error: 'Transaksi tidak ditemukan' }, 404);
    }

    // Adjust debts if needed (scoped per userId)
    if (existing.debtor && existing.debtAmount) {
      const contact = existing.debtor.trim().toUpperCase();
      const debt = await db
        .select()
        .from(schema.debts)
        .where(and(eq(schema.debts.userId, userId), eq(schema.debts.contactName, contact)))
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
        .where(and(eq(schema.debts.userId, userId), eq(schema.debts.contactName, contact)))
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

    await db
      .delete(schema.transactions)
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)));
    return c.json({ success: true, deleted: existing });
  });
