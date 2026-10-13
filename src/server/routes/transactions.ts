import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';
import { getDebtAdjustmentStatement } from '../utils/debtHelper';
import { getCurrentDateAndTimeInTimezone, resolveUserTimezone } from '../utils/timezone';

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
  amount: z
    .number()
    .int('Nominal transaksi harus berupa integer Rupiah tanpa desimal')
    .positive('Nominal harus lebih dari 0'),
  date: z.string().min(1, 'Tanggal tidak valid').optional(),
  time: z.string().optional(),
  category: z.string().min(1, 'Kategori wajib diisi'),
  debtor: z.string().optional(),
  creditor: z.string().optional(),
  debtAmount: z.number().int('Nominal hutang harus berupa integer Rupiah').nonnegative().optional(),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceId: z.string().optional(),
  source: z.string().optional()
});

const updateTransactionSchema = z.object({
  name: z.string().min(1, 'Nama transaksi wajib diisi').optional(),
  amount: z
    .number()
    .int('Nominal transaksi harus berupa integer Rupiah tanpa desimal')
    .positive('Nominal harus lebih dari 0')
    .optional(),
  date: z.string().min(1, 'Tanggal tidak valid').optional(),
  time: z.string().optional(),
  category: z.string().min(1, 'Kategori wajib diisi').optional(),
  debtor: z.string().nullable().optional(),
  creditor: z.string().nullable().optional(),
  debtAmount: z
    .number()
    .int('Nominal hutang harus berupa integer Rupiah')
    .nonnegative()
    .nullable()
    .optional(),
  isDebtSettled: z.number().int().min(0).max(1).optional(),
  notes: z.string().nullable().optional(),
  paymentMethod: z.string().optional(),
  referenceId: z.string().nullable().optional(),
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

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(schema.transactions)
        .where(whereClause)
        .orderBy(
          desc(schema.transactions.date),
          desc(schema.transactions.time),
          desc(schema.transactions.id)
        )
        .limit(limit)
        .offset(offset),
      db.select({ total: sql<number>`count(*)` }).from(schema.transactions).where(whereClause).get()
    ]);

    const total = countResult?.total ?? 0;
    const hasMore = offset + data.length < total;

    return c.json({
      success: true,
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore
      }
    });
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

    // Stateless timezone ingestion (fallback: Asia/Jakarta)
    const userTimezone = resolveUserTimezone(c.req.header('X-User-Timezone'));
    const currentDateTime = getCurrentDateAndTimeInTimezone(userTimezone);

    const source = body.source?.trim() || 'manual';
    const paymentMethod = body.paymentMethod?.trim() || 'Cash';
    const txDate = body.date || currentDateTime.date;
    const txTime = body.time || currentDateTime.time;
    const debtAmount = body.debtAmount ? body.debtAmount : 0;

    const insertTxStmt = db
      .insert(schema.transactions)
      .values({
        userId,
        name: body.name.trim(),
        amount: body.amount,
        date: txDate,
        time: txTime,
        category: body.category,
        debtor: body.debtor?.trim() || null,
        creditor: body.creditor?.trim() || null,
        debtAmount,
        notes: body.notes?.trim() || null,
        paymentMethod,
        referenceId: body.referenceId?.trim() || null,
        source
      })
      .returning();

    // Prepare atomic debt adjustment if debtor or creditor is specified
    let debtStmt = null;
    if (body.debtor && debtAmount > 0) {
      debtStmt = await getDebtAdjustmentStatement(db, userId, body.debtor, debtAmount, 0);
    } else if (body.creditor && debtAmount > 0) {
      debtStmt = await getDebtAdjustmentStatement(db, userId, body.creditor, 0, debtAmount);
    }

    let insertedRow: schema.Transaction;
    if (debtStmt) {
      const batchResults = (await db.batch([insertTxStmt, debtStmt])) as [
        schema.Transaction[],
        unknown
      ];
      insertedRow = batchResults[0][0];
    } else {
      const rows = await insertTxStmt;
      insertedRow = rows[0];
    }

    console.log(
      `[TRANSACTION_LOGGER] User:${userId} | ID: ${insertedRow.id} | Nama: "${insertedRow.name}" | Rp${insertedRow.amount} | Kategori: ${insertedRow.category} | Sumber: ${insertedRow.source.toUpperCase()}`
    );

    return c.json({ success: true, data: insertedRow });
  })
  .put(
    '/:id',
    zValidator('param', transactionIdParamSchema),
    zValidator('json', updateTransactionSchema),
    async (c) => {
      const db = getDb(c.env.DB);
      const userId = c.get('userId');
      const { id: idStr } = c.req.valid('param');
      const id = parseInt(idStr, 10);
      const body = c.req.valid('json');

      const existing = await db
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
        .get();

      if (!existing) {
        return c.json({ success: false, error: 'Transaksi tidak ditemukan' }, 404);
      }

      const newName = body.name !== undefined ? body.name.trim() : existing.name;
      const newAmount = body.amount !== undefined ? body.amount : existing.amount;
      const newDate = body.date !== undefined ? body.date : existing.date;
      const newTime = body.time !== undefined ? body.time : existing.time;
      const newCategory = body.category !== undefined ? body.category : existing.category;
      const newDebtor = body.debtor !== undefined ? body.debtor?.trim() || null : existing.debtor;
      const newCreditor =
        body.creditor !== undefined ? body.creditor?.trim() || null : existing.creditor;
      const newDebtAmount =
        body.debtAmount !== undefined ? (body.debtAmount ?? 0) : (existing.debtAmount ?? 0);
      const newIsDebtSettled =
        body.isDebtSettled !== undefined ? body.isDebtSettled : existing.isDebtSettled;
      const newNotes = body.notes !== undefined ? body.notes?.trim() || null : existing.notes;
      const newPaymentMethod =
        body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod;
      const newSource = body.source !== undefined ? body.source : existing.source;

      // Net debt delta calculation per contact for atomic reconciliation
      const contactDeltas = new Map<string, { deltaOwedToUs: number; deltaWeOwe: number }>();
      const addDelta = (name: string, owedToUs: number, weOwe: number) => {
        const key = name.trim().toUpperCase();
        if (!key) return;
        const current = contactDeltas.get(key) || { deltaOwedToUs: 0, deltaWeOwe: 0 };
        current.deltaOwedToUs += owedToUs;
        current.deltaWeOwe += weOwe;
        contactDeltas.set(key, current);
      };

      // 1. Revert previous debt impact if it was unsettled
      if (existing.isDebtSettled === 0 && (existing.debtAmount ?? 0) > 0) {
        if (existing.debtor) addDelta(existing.debtor, -(existing.debtAmount ?? 0), 0);
        if (existing.creditor) addDelta(existing.creditor, 0, -(existing.debtAmount ?? 0));
      }

      // 2. Apply new debt impact if active (unsettled)
      if (newIsDebtSettled === 0 && newDebtAmount > 0) {
        if (newDebtor) addDelta(newDebtor, newDebtAmount, 0);
        if (newCreditor) addDelta(newCreditor, 0, newDebtAmount);
      }

      const debtStmts = [];
      for (const [contact, deltas] of contactDeltas.entries()) {
        if (deltas.deltaOwedToUs !== 0 || deltas.deltaWeOwe !== 0) {
          const stmt = await getDebtAdjustmentStatement(
            db,
            userId,
            contact,
            deltas.deltaOwedToUs,
            deltas.deltaWeOwe
          );
          if (stmt) debtStmts.push(stmt);
        }
      }

      const updateTxStmt = db
        .update(schema.transactions)
        .set({
          name: newName,
          amount: newAmount,
          date: newDate,
          time: newTime,
          category: newCategory,
          debtor: newDebtor,
          creditor: newCreditor,
          debtAmount: newDebtAmount,
          isDebtSettled: newIsDebtSettled,
          debtSettledAt:
            newIsDebtSettled === 1 ? existing.debtSettledAt || new Date().toISOString() : null,
          notes: newNotes,
          paymentMethod: newPaymentMethod,
          source: newSource
        })
        .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
        .returning();

      let updatedRow: schema.Transaction;
      if (debtStmts.length > 0) {
        const batchResults = (await db.batch([updateTxStmt, ...debtStmts])) as [
          schema.Transaction[],
          ...unknown[]
        ];
        updatedRow = batchResults[0][0];
      } else {
        const rows = await updateTxStmt;
        updatedRow = rows[0];
      }

      return c.json({ success: true, data: updatedRow });
    }
  )
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

    // Revert unsettled debt atomically
    const debtStmts = [];
    if (existing.isDebtSettled === 0 && (existing.debtAmount ?? 0) > 0) {
      if (existing.debtor) {
        const stmt = await getDebtAdjustmentStatement(
          db,
          userId,
          existing.debtor,
          -(existing.debtAmount ?? 0),
          0
        );
        if (stmt) debtStmts.push(stmt);
      } else if (existing.creditor) {
        const stmt = await getDebtAdjustmentStatement(
          db,
          userId,
          existing.creditor,
          0,
          -(existing.debtAmount ?? 0)
        );
        if (stmt) debtStmts.push(stmt);
      }
    }

    const deleteTxStmt = db
      .delete(schema.transactions)
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)));

    if (debtStmts.length > 0) {
      await db.batch([deleteTxStmt, ...debtStmts]);
    } else {
      await deleteTxStmt;
    }

    return c.json({ success: true, deleted: existing });
  });
