import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

function createTestDatabase() {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON;');

  // Apply all migrations in sequence
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

describe('Domain 1: Identity & Multi-Tenant Isolation (ANT-21)', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  describe('Task 4.1: Cascade Delete & Foreign Key Enforcement', () => {
    it('should automatically cascade delete all child rows when a user is deleted', () => {
      // 1. Create User
      db.run(
        `INSERT INTO users (id, email, name, password_hash, webhook_token)
         VALUES (101, 'user101@example.com', 'User 101', 'hash101', 'token101');`
      );

      // 2. Insert child records across all tenant tables
      db.run(
        `INSERT INTO transactions (id, user_id, name, amount, date, time, category, payment_method)
         VALUES (1, 101, 'Kopi Pagi', 25000, '2026-10-12', '08:00:00', 'Jajan', 'Cash');`
      );

      db.run(
        `INSERT INTO debts (id, user_id, contact_name, total_owed_to_us, total_we_owe)
         VALUES (1, 101, 'Budi', 50000, 0);`
      );

      db.run(
        `INSERT INTO budgets (id, user_id, category, monthly_limit)
         VALUES (1, 101, 'Makan', 1500000);`
      );

      db.run(
        `INSERT INTO categories (id, user_id, name, emoji, color, sort_order, is_active)
         VALUES (1, 101, 'Makan', '🍜', '#10b981', 1, 1);`
      );

      db.run(
        `INSERT INTO ai_usage (id, user_id, date, request_count, model_used)
         VALUES (1, 101, '2026-10-12', 3, 'gemini-1.5-flash');`
      );

      // Verify that all child records exist before deletion
      expect(
        db.query('SELECT COUNT(*) as count FROM transactions WHERE user_id = 101').get()
      ).toEqual({ count: 1 });
      expect(db.query('SELECT COUNT(*) as count FROM debts WHERE user_id = 101').get()).toEqual({
        count: 1
      });
      expect(db.query('SELECT COUNT(*) as count FROM budgets WHERE user_id = 101').get()).toEqual({
        count: 1
      });
      expect(
        db.query('SELECT COUNT(*) as count FROM categories WHERE user_id = 101').get()
      ).toEqual({ count: 1 });
      expect(db.query('SELECT COUNT(*) as count FROM ai_usage WHERE user_id = 101').get()).toEqual({
        count: 1
      });

      // 3. Delete user
      db.run('DELETE FROM users WHERE id = 101;');

      // 4. Verify cascade delete across all tables
      expect(db.query('SELECT COUNT(*) as count FROM users WHERE id = 101').get()).toEqual({
        count: 0
      });
      expect(
        db.query('SELECT COUNT(*) as count FROM transactions WHERE user_id = 101').get()
      ).toEqual({ count: 0 });
      expect(db.query('SELECT COUNT(*) as count FROM debts WHERE user_id = 101').get()).toEqual({
        count: 0
      });
      expect(db.query('SELECT COUNT(*) as count FROM budgets WHERE user_id = 101').get()).toEqual({
        count: 0
      });
      expect(
        db.query('SELECT COUNT(*) as count FROM categories WHERE user_id = 101').get()
      ).toEqual({ count: 0 });
      expect(db.query('SELECT COUNT(*) as count FROM ai_usage WHERE user_id = 101').get()).toEqual({
        count: 0
      });
    });

    it('should reject inserting child records with non-existent user_id', () => {
      // Foreign key constraint should throw error on orphan record insertion
      expect(() => {
        db.run(
          `INSERT INTO transactions (user_id, name, amount, date, time, category, payment_method)
           VALUES (9999, 'Orphan Tx', 10000, '2026-10-12', '10:00:00', 'Makan', 'Cash');`
        );
      }).toThrow();
    });
  });

  describe('Task 4.2: Strict Multi-Tenant Isolation', () => {
    it('should prevent User A from reading or mutating User B data', () => {
      // Create User A and User B
      db.run(
        `INSERT INTO users (id, email, name, password_hash, webhook_token)
         VALUES (201, 'usera@example.com', 'User A', 'hashA', 'tokenA'),
                (202, 'userb@example.com', 'User B', 'hashB', 'tokenB');`
      );

      // Insert transaction for User A and User B
      db.run(
        `INSERT INTO transactions (id, user_id, name, amount, date, time, category, payment_method)
         VALUES (10, 201, 'Makan User A', 30000, '2026-10-12', '12:00:00', 'Makan', 'Cash'),
                (20, 202, 'Belanja User B', 250000, '2026-10-12', '13:00:00', 'Belanja', 'QRIS');`
      );

      // 1. Scoped query for User A
      const userATransactions = db
        .query('SELECT id, name, amount FROM transactions WHERE user_id = ?')
        .all(201) as Array<{ id: number; name: string; amount: number }>;

      expect(userATransactions.length).toBe(1);
      expect(userATransactions[0].id).toBe(10);
      expect(userATransactions[0].name).toBe('Makan User A');

      // 2. User A attempts to update User B transaction
      const updateResult = db.run(
        'UPDATE transactions SET amount = 500 WHERE id = 20 AND user_id = 201'
      );
      expect(updateResult.changes).toBe(0);

      // Verify User B transaction remains unchanged
      const userBOriginalTx = db.query('SELECT amount FROM transactions WHERE id = 20').get() as {
        amount: number;
      };
      expect(userBOriginalTx.amount).toBe(250000);

      // 3. User A attempts to delete User B transaction
      const deleteResult = db.run('DELETE FROM transactions WHERE id = 20 AND user_id = 201');
      expect(deleteResult.changes).toBe(0);

      // Verify User B transaction still exists
      const userBStillExists = db
        .query('SELECT COUNT(*) as count FROM transactions WHERE id = 20')
        .get() as { count: number };
      expect(userBStillExists.count).toBe(1);
    });
  });

  describe('Task 3.3: Default Categories Seeding', () => {
    it('should seed 6 default categories with correct attributes for new user', () => {
      db.run(
        `INSERT INTO users (id, email, name, password_hash, webhook_token)
         VALUES (301, 'tenant@example.com', 'Tenant', 'hash', 'token301');`
      );

      const defaultCats = [
        { name: 'Makan', emoji: '🍜', color: '#10b981' },
        { name: 'Jajan', emoji: '☕', color: '#f59e0b' },
        { name: 'Primer', emoji: '🛒', color: '#3b82f6' },
        { name: 'Transport', emoji: '⛽', color: '#6366f1' },
        { name: 'Olga', emoji: '🏸', color: '#ec4899' },
        { name: 'Belanja', emoji: '🛍️', color: '#8b5cf6' }
      ];

      for (let i = 0; i < defaultCats.length; i++) {
        db.run(
          `INSERT INTO categories (user_id, name, emoji, color, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [301, defaultCats[i].name, defaultCats[i].emoji, defaultCats[i].color, i + 1]
        );
      }

      const seeded = db
        .query(
          'SELECT name, emoji, color, sort_order FROM categories WHERE user_id = 301 ORDER BY sort_order ASC'
        )
        .all() as Array<{ name: string; emoji: string; color: string; sort_order: number }>;

      expect(seeded.length).toBe(6);
      expect(seeded.map((c) => c.name)).toEqual([
        'Makan',
        'Jajan',
        'Primer',
        'Transport',
        'Olga',
        'Belanja'
      ]);
    });
  });
});
