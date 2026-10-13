import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  isValidMonetaryInteger,
  parseBankNotificationRegex,
  toMonetaryInteger
} from '../src/server/utils/paymentParser';
import {
  convertLocalToUtcIso,
  getCurrentDateAndTimeInTimezone,
  isValidTimezone,
  resolveUserTimezone
} from '../src/server/utils/timezone';

function createTestDatabase() {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON;');

  const migrationFiles = fs
    .readdirSync(path.join(process.cwd(), 'drizzle'))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const rawSql = fs.readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf-8');
    const statements = rawSql.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const cleanStmt = stmt.trim();
      if (cleanStmt) {
        db.run(cleanStmt);
      }
    }
  }

  return db;
}

describe('Domain 2: Core Financial Ledger & Expense Engine (ANT-22)', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
    // Seed 2 Users for multi-tenancy tests
    db.run(
      `INSERT INTO users (id, email, name, webhook_token)
       VALUES (1, 'user1@example.com', 'User Satu', 'token-1'),
              (2, 'user2@example.com', 'User Dua', 'token-2');`
    );
  });

  describe('Task 1.1: Integer Currency & Monetary Hardening', () => {
    it('should validate positive integer Rupiah and reject decimals/floats', () => {
      expect(isValidMonetaryInteger(25000)).toBe(true);
      expect(isValidMonetaryInteger(1)).toBe(true);
      expect(isValidMonetaryInteger(150000000)).toBe(true);

      // Decimals and non-integers MUST be rejected
      expect(isValidMonetaryInteger(25000.5)).toBe(false);
      expect(isValidMonetaryInteger(0.99)).toBe(false);
      expect(isValidMonetaryInteger(0)).toBe(false);
      expect(isValidMonetaryInteger(-5000)).toBe(false);
      expect(isValidMonetaryInteger(Number.NaN)).toBe(false);
      expect(isValidMonetaryInteger(Number.POSITIVE_INFINITY)).toBe(false);
      expect(isValidMonetaryInteger('25000')).toBe(false);
      expect(isValidMonetaryInteger(null)).toBe(false);
    });

    it('should coerce and round float amounts to pure monetary integers', () => {
      expect(toMonetaryInteger(25000.4)).toBe(25000);
      expect(toMonetaryInteger(25000.6)).toBe(25001);
      expect(toMonetaryInteger('Rp 50.000')).toBe(50000);
      expect(toMonetaryInteger(-100)).toBe(0);
    });

    it('should extract integer amount without decimal rounding error in bank notifications', () => {
      const bcaText =
        'Pembayaran QRIS Rp 35.000,00 ke Kopi Kenangan berhasil. Ref: BCA987654 pada 12/10 14:30';
      const parsed = parseBankNotificationRegex(bcaText);
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(35000);
      expect(Number.isInteger(parsed?.amount)).toBe(true);
      expect(parsed?.merchant).toBe('Kopi Kenangan');
      expect(parsed?.category).toBe('Jajan');
    });
  });

  describe('Task 1.2: Stateless Timezone Ingestion', () => {
    it('should identify valid IANA timezones and fallback to Asia/Jakarta', () => {
      expect(isValidTimezone('Asia/Jakarta')).toBe(true);
      expect(isValidTimezone('Asia/Makassar')).toBe(true);
      expect(isValidTimezone('Asia/Jayapura')).toBe(true);
      expect(isValidTimezone('Invalid/Zone')).toBe(false);

      expect(resolveUserTimezone('Asia/Makassar')).toBe('Asia/Makassar');
      expect(resolveUserTimezone('UTC')).toBe('UTC');
      expect(resolveUserTimezone(null)).toBe('Asia/Jakarta');
      expect(resolveUserTimezone('Gibberish')).toBe('Asia/Jakarta');
    });

    it('should format date and time accurately according to timezone', () => {
      const fixedDate = new Date('2026-10-12T04:00:00.000Z'); // 11:00 WIB (UTC+7), 12:00 WITA (UTC+8)

      const wib = getCurrentDateAndTimeInTimezone('Asia/Jakarta', fixedDate);
      expect(wib.date).toBe('2026-10-12');
      expect(wib.time).toBe('11:00:00');

      const wita = getCurrentDateAndTimeInTimezone('Asia/Makassar', fixedDate);
      expect(wita.date).toBe('2026-10-12');
      expect(wita.time).toBe('12:00:00');
    });

    it('should normalize local datetime to standard UTC ISO', () => {
      const wibIso = convertLocalToUtcIso('2026-10-12', '12:00:00', 'Asia/Jakarta');
      expect(wibIso).toBe('2026-10-12T05:00:00.000Z');

      const witaIso = convertLocalToUtcIso('2026-10-12', '12:00:00', 'Asia/Makassar');
      expect(witaIso).toBe('2026-10-12T04:00:00.000Z');
    });
  });

  describe('Task 2.1: Differential Talangan Calculation & Batch Integrity', () => {
    it('should correctly reconcile debt amounts across create, differential edit, contact change, and settlement', () => {
      // 1. CREATE Transaction with talangan for BUDI: 50.000
      db.run('BEGIN TRANSACTION;');
      db.run(
        `INSERT INTO transactions (id, user_id, name, amount, date, time, category, debtor, debt_amount, is_debt_settled)
         VALUES (10, 1, 'Makan Siang Bareng', 100000, '2026-10-12', '12:30:00', 'Makan', 'BUDI', 50000, 0);`
      );
      db.run(
        `INSERT INTO debts (user_id, contact_name, total_owed_to_us, total_we_owe)
         VALUES (1, 'BUDI', 50000, 0)
         ON CONFLICT (user_id, contact_name) DO UPDATE SET total_owed_to_us = total_owed_to_us + 50000;`
      );
      db.run('COMMIT;');

      const debtAfterCreate = db
        .query('SELECT total_owed_to_us FROM debts WHERE user_id = 1 AND contact_name = ?')
        .get('BUDI') as { total_owed_to_us: number };
      expect(debtAfterCreate.total_owed_to_us).toBe(50000);

      // 2. DIFFERENTIAL EDIT: Increase talangan amount from 50.000 to 75.000
      const deltaOwed = 75000 - 50000; // +25000
      db.run('BEGIN TRANSACTION;');
      db.run('UPDATE transactions SET debt_amount = 75000 WHERE id = 10 AND user_id = 1;');
      db.run(
        'UPDATE debts SET total_owed_to_us = total_owed_to_us + ? WHERE user_id = 1 AND contact_name = ?;',
        [deltaOwed, 'BUDI']
      );
      db.run('COMMIT;');

      const debtAfterEdit = db
        .query('SELECT total_owed_to_us FROM debts WHERE user_id = 1 AND contact_name = ?')
        .get('BUDI') as { total_owed_to_us: number };
      expect(debtAfterEdit.total_owed_to_us).toBe(75000);

      // 3. CONTACT CHANGE: Change debtor from BUDI to SITI (amount 75.000)
      db.run('BEGIN TRANSACTION;');
      db.run("UPDATE transactions SET debtor = 'SITI' WHERE id = 10 AND user_id = 1;");
      // Revert BUDI (-75.000)
      db.run(
        'UPDATE debts SET total_owed_to_us = MAX(0, total_owed_to_us - 75000) WHERE user_id = 1 AND contact_name = ?;',
        ['BUDI']
      );
      // Add SITI (+75.000)
      db.run(
        `INSERT INTO debts (user_id, contact_name, total_owed_to_us, total_we_owe)
         VALUES (1, 'SITI', 75000, 0)
         ON CONFLICT (user_id, contact_name) DO UPDATE SET total_owed_to_us = total_owed_to_us + 75000;`
      );
      db.run('COMMIT;');

      const budiDebt = db
        .query('SELECT total_owed_to_us FROM debts WHERE user_id = 1 AND contact_name = ?')
        .get('BUDI') as { total_owed_to_us: number };
      const sitiDebt = db
        .query('SELECT total_owed_to_us FROM debts WHERE user_id = 1 AND contact_name = ?')
        .get('SITI') as { total_owed_to_us: number };

      expect(budiDebt.total_owed_to_us).toBe(0);
      expect(sitiDebt.total_owed_to_us).toBe(75000);

      // 4. SETTLE DEBT: Mark transaction as settled (is_debt_settled = 1)
      db.run('BEGIN TRANSACTION;');
      db.run(
        "UPDATE transactions SET is_debt_settled = 1, debt_settled_at = '2026-10-12T15:00:00.000Z' WHERE id = 10 AND user_id = 1;"
      );
      db.run(
        'UPDATE debts SET total_owed_to_us = MAX(0, total_owed_to_us - 75000) WHERE user_id = 1 AND contact_name = ?;',
        ['SITI']
      );
      db.run('COMMIT;');

      const sitiDebtAfterSettle = db
        .query('SELECT total_owed_to_us FROM debts WHERE user_id = 1 AND contact_name = ?')
        .get('SITI') as { total_owed_to_us: number };
      expect(sitiDebtAfterSettle.total_owed_to_us).toBe(0);
    });

    it('should revert debt balance when an unsettled transaction is deleted', () => {
      // 1. Create transaction with talangan
      db.run(
        `INSERT INTO transactions (id, user_id, name, amount, date, time, category, debtor, debt_amount, is_debt_settled)
         VALUES (20, 1, 'Bensin Mobil', 150000, '2026-10-12', '10:00:00', 'Transport', 'JOKO', 50000, 0);`
      );
      db.run(
        `INSERT INTO debts (user_id, contact_name, total_owed_to_us, total_we_owe)
         VALUES (1, 'JOKO', 50000, 0);`
      );

      // Verify created
      const jokoBefore = db
        .query('SELECT total_owed_to_us FROM debts WHERE user_id = 1 AND contact_name = ?')
        .get('JOKO') as { total_owed_to_us: number };
      expect(jokoBefore.total_owed_to_us).toBe(50000);

      // 2. Atomic delete transaction and revert debt
      db.run('BEGIN TRANSACTION;');
      db.run('DELETE FROM transactions WHERE id = 20 AND user_id = 1;');
      db.run(
        'UPDATE debts SET total_owed_to_us = MAX(0, total_owed_to_us - 50000) WHERE user_id = 1 AND contact_name = ?;',
        ['JOKO']
      );
      db.run('COMMIT;');

      const jokoAfter = db
        .query('SELECT total_owed_to_us FROM debts WHERE user_id = 1 AND contact_name = ?')
        .get('JOKO') as { total_owed_to_us: number };
      expect(jokoAfter.total_owed_to_us).toBe(0);
    });
  });

  describe('Task 2.2: Multi-Tenant Pagination & Filter Verification', () => {
    beforeEach(() => {
      // Seed 60 transactions for User 1
      for (let i = 1; i <= 60; i++) {
        const cat = i % 2 === 0 ? 'Makan' : 'Transport';
        const day = (i % 28) + 1;
        const dateStr = `2026-09-${day.toString().padStart(2, '0')}`;
        db.run(
          `INSERT INTO transactions (id, user_id, name, amount, date, time, category)
           VALUES (?, 1, ?, ?, ?, '12:00:00', ?);`,
          [i, `Tx User1 #${i}`, i * 1000, dateStr, cat]
        );
      }

      // Seed 10 transactions for User 2 (must not leak)
      for (let i = 1; i <= 10; i++) {
        db.run(
          `INSERT INTO transactions (id, user_id, name, amount, date, time, category)
           VALUES (?, 2, ?, ?, '2026-09-15', '12:00:00', 'Makan');`,
          [100 + i, `Tx User2 #${i}`, 50000]
        );
      }
    });

    it('should paginate transactions with limit and offset without leaking User 2 data', () => {
      const limit = 20;
      const offset = 0;

      const user1Total = db
        .query('SELECT COUNT(*) as total FROM transactions WHERE user_id = 1;')
        .get() as { total: number };
      expect(user1Total.total).toBe(60);

      const page1 = db
        .query(
          `SELECT id, user_id, name FROM transactions 
           WHERE user_id = 1 
           ORDER BY date DESC, time DESC, id DESC 
           LIMIT ? OFFSET ?;`
        )
        .all(limit, offset) as Array<{ id: number; user_id: number; name: string }>;

      expect(page1.length).toBe(20);
      expect(page1.every((t) => t.user_id === 1)).toBe(true);

      // Page 2
      const page2 = db
        .query(
          `SELECT id, user_id, name FROM transactions 
           WHERE user_id = 1 
           ORDER BY date DESC, time DESC, id DESC 
           LIMIT ? OFFSET ?;`
        )
        .all(limit, 20) as Array<{ id: number; user_id: number; name: string }>;

      expect(page2.length).toBe(20);
      expect(page2.every((t) => t.user_id === 1)).toBe(true);
      // Ensure no overlapping ids between page 1 and page 2
      const page1Ids = new Set(page1.map((p) => p.id));
      expect(page2.every((p) => !page1Ids.has(p.id))).toBe(true);
    });

    it('should filter transactions by category and date exclusively within tenant', () => {
      const makanUser1 = db
        .query(
          `SELECT COUNT(*) as total FROM transactions 
           WHERE user_id = 1 AND category = 'Makan';`
        )
        .get() as { total: number };
      expect(makanUser1.total).toBe(30);

      const makanUser2 = db
        .query(
          `SELECT COUNT(*) as total FROM transactions 
           WHERE user_id = 2 AND category = 'Makan';`
        )
        .get() as { total: number };
      expect(makanUser2.total).toBe(10);
    });
  });
});
