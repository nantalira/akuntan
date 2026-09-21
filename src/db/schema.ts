import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = ['Makan', 'Jajan', 'Primer', 'Motor', 'Olga', 'Belanja'] as const;

export type Category = (typeof categories)[number];

export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    time: text('time').notNull(), // HH:mm:ss
    category: text('category').notNull(), // Makan | Jajan | Primer | Motor | Olga | Belanja
    debtor: text('debtor'), // Kontak yang ditalangi pengguna (Terhutangi)
    creditor: text('creditor'), // Kontak yang menalangi pengguna (Menghutangi)
    debtAmount: integer('debt_amount').default(0),
    notes: text('notes'),
    source: text('source').default('manual').notNull(), // 'ai' | 'local_parser' | 'manual'
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
  },
  (table) => ({
    dateIdx: index('idx_transactions_date').on(table.date),
    categoryIdx: index('idx_transactions_category').on(table.category)
  })
);

export const debts = sqliteTable('debts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactName: text('contact_name').notNull().unique(),
  totalOwedToUs: integer('total_owed_to_us').default(0).notNull(), // Piutang (Terhutangi)
  totalWeOwe: integer('total_we_owe').default(0).notNull(), // Hutang (Menghutangi)
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const budgets = sqliteTable('budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull().unique(),
  monthlyLimit: integer('monthly_limit').notNull().default(0)
});

export const aiUsage = sqliteTable('ai_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(), // YYYY-MM-DD
  requestCount: integer('request_count').notNull().default(0),
  modelUsed: text('model_used').notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;
export type NewAiUsage = typeof aiUsage.$inferInsert;
