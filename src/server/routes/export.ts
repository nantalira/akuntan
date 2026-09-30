import { zValidator } from '@hono/zod-validator';
import { and, asc, eq, like } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, schema } from '../../db/client';
import type { AppEnv } from '../index';

const exportQuerySchema = z.object({
  month: z.string().optional()
});

export const exportRoute = new Hono<AppEnv>().get(
  '/',
  zValidator('query', exportQuerySchema),
  async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const { month } = c.req.valid('query'); // e.g. '2026-09' or undefined

    const conditions = [eq(schema.transactions.userId, userId)];
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      conditions.push(like(schema.transactions.date, `${month}%`));
    }

    const rows = await db
      .select()
      .from(schema.transactions)
      .where(and(...conditions))
      .orderBy(asc(schema.transactions.date), asc(schema.transactions.time))
      .all();

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'ID',
      'Tanggal',
      'Jam',
      'Nama Transaksi',
      'Nominal (IDR)',
      'Kategori',
      'Menalangi (Piutang)',
      'Ditalangi (Hutang)',
      'Nominal Hutang',
      'Catatan',
      'Sumber Input'
    ];

    const csvLines = [headers.join(',')];

    for (const row of rows) {
      const sourceLabel =
        row.source === 'ai' ? 'AI' : row.source === 'local_parser' ? 'Parser Lokal' : 'Manual';

      const line = [
        escapeCsv(row.id),
        escapeCsv(row.date),
        escapeCsv(row.time),
        escapeCsv(row.name),
        escapeCsv(row.amount),
        escapeCsv(row.category),
        escapeCsv(row.debtor || ''),
        escapeCsv(row.creditor || ''),
        escapeCsv(row.debtAmount || 0),
        escapeCsv(row.notes || ''),
        escapeCsv(sourceLabel)
      ];
      csvLines.push(line.join(','));
    }

    // Add UTF-8 BOM so Microsoft Excel recognizes Indonesian UTF-8 characters correctly
    const csvOutput = `\uFEFF${csvLines.join('\r\n')}`;
    const filename = month ? `akuntan-transaksi-${month}.csv` : 'akuntan-transaksi-semua.csv';

    return c.text(csvOutput, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    });
  }
);
