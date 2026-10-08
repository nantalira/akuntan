import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';
import { adjustDebt } from '../utils/debtHelper';

const settleDebtSchema = z.object({
  contactName: z.string().min(1, 'Nama kontak harus diisi'),
  amount: z.number().nonnegative().optional(),
  target: z.enum(['we_owe', 'owed_to_us'])
});

const transactionIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid')
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
  .get('/all-unsettled', async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');

    const rows = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.isDebtSettled, 0),
          sql`(${schema.transactions.debtor} IS NOT NULL OR ${schema.transactions.creditor} IS NOT NULL)`
        )
      )
      .orderBy(
        desc(schema.transactions.date),
        desc(schema.transactions.time),
        desc(schema.transactions.id)
      )
      .all();

    const piutang = rows.filter((r) => Boolean(r.debtor));
    const hutang = rows.filter((r) => Boolean(r.creditor));

    return c.json({
      success: true,
      data: {
        total: rows.length,
        piutang,
        hutang
      }
    });
  })
  .get('/:contactName/transactions', async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const contactRaw = c.req.param('contactName');
    const contact = decodeURIComponent(contactRaw).trim().toUpperCase();

    const rows = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`(UPPER(TRIM(${schema.transactions.debtor})) = ${contact} OR UPPER(TRIM(${schema.transactions.creditor})) = ${contact})`
        )
      )
      .orderBy(
        desc(schema.transactions.date),
        desc(schema.transactions.time),
        desc(schema.transactions.id)
      )
      .all();

    const active = rows.filter((r) => r.isDebtSettled === 0);
    const settled = rows.filter((r) => r.isDebtSettled === 1);

    return c.json({
      success: true,
      data: {
        contactName: contact,
        totalItems: rows.length,
        active,
        settled
      }
    });
  })
  .post('/transactions/:id/settle', zValidator('param', transactionIdParamSchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const id = parseInt(c.req.valid('param').id, 10);

    const tx = await db
      .select()
      .from(schema.transactions)
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
      .get();

    if (!tx) {
      return c.json({ success: false, error: 'Transaksi tidak ditemukan' }, 404);
    }

    if (tx.isDebtSettled === 1) {
      return c.json({ success: true, data: tx, message: 'Item sudah berstatus lunas' });
    }

    const debtAmt = tx.debtAmount && tx.debtAmount > 0 ? tx.debtAmount : tx.amount;

    // Kurangi saldo hutang/piutang kontak di tabel debts
    if (tx.debtor) {
      await adjustDebt(db, userId, tx.debtor, -debtAmt, 0);
    } else if (tx.creditor) {
      await adjustDebt(db, userId, tx.creditor, 0, -debtAmt);
    }

    const updated = await db
      .update(schema.transactions)
      .set({
        isDebtSettled: 1,
        debtSettledAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(schema.transactions.id, id))
      .returning();

    return c.json({ success: true, data: updated[0] });
  })
  .post('/transactions/:id/unsettle', zValidator('param', transactionIdParamSchema), async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const id = parseInt(c.req.valid('param').id, 10);

    const tx = await db
      .select()
      .from(schema.transactions)
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
      .get();

    if (!tx) {
      return c.json({ success: false, error: 'Transaksi tidak ditemukan' }, 404);
    }

    if (tx.isDebtSettled === 0) {
      return c.json({ success: true, data: tx, message: 'Item sudah berstatus belum lunas' });
    }

    const debtAmt = tx.debtAmount && tx.debtAmount > 0 ? tx.debtAmount : tx.amount;

    // Kembalikan saldo hutang/piutang kontak di tabel debts
    if (tx.debtor) {
      await adjustDebt(db, userId, tx.debtor, debtAmt, 0);
    } else if (tx.creditor) {
      await adjustDebt(db, userId, tx.creditor, 0, debtAmt);
    }

    const updated = await db
      .update(schema.transactions)
      .set({
        isDebtSettled: 0,
        debtSettledAt: null
      })
      .where(eq(schema.transactions.id, id))
      .returning();

    return c.json({ success: true, data: updated[0] });
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
      const settleAmount = body.amount ?? existing.totalWeOwe;
      updatedWeOwe = Math.max(0, existing.totalWeOwe - settleAmount);
    } else {
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
