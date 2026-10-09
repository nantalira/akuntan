import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const DEFAULT_CATEGORIES = [
  { name: 'Makan', emoji: '🍜', color: '#10b981' },
  { name: 'Jajan', emoji: '☕', color: '#f59e0b' },
  { name: 'Primer', emoji: '🛒', color: '#3b82f6' },
  { name: 'Transport', emoji: '⛽', color: '#6366f1' },
  { name: 'Olga', emoji: '🏸', color: '#ec4899' },
  { name: 'Belanja', emoji: '🛍️', color: '#8b5cf6' }
] as const;

export type Category = string;

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  avatarUrl: text('avatar_url'),
  geminiApiKey: text('gemini_api_key'),
  webhookToken: text('webhook_token').notNull().unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').default(1).notNull(),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    time: text('time').notNull(), // HH:mm:ss
    category: text('category').notNull(), // Makan | Jajan | Primer | Motor | Olga | Belanja
    debtor: text('debtor'), // Kontak yang ditalangi pengguna (Terhutangi)
    creditor: text('creditor'), // Kontak yang menalangi pengguna (Menghutangi)
    debtAmount: integer('debt_amount').default(0),
    isDebtSettled: integer('is_debt_settled').default(0).notNull(), // 0 = Belum Lunas, 1 = Lunas
    debtSettledAt: text('debt_settled_at'), // Timestamp ISO saat dilunasi
    notes: text('notes'),
    paymentMethod: text('payment_method').default('Cash').notNull(), // Cash | QRIS | BCA | Mandiri | BRI | BNI | GoPay | OVO | DANA | ShopeePay | Transfer
    referenceId: text('reference_id'), // Bank/email reference ID for idempotent deduplication
    source: text('source').default('manual').notNull(), // 'ai' | 'local_parser' | 'manual' | 'qris_webhook' | 'share_target'
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
  },
  (table) => ({
    userIdIdx: index('idx_transactions_user_id').on(table.userId),
    dateIdx: index('idx_transactions_date').on(table.date),
    categoryIdx: index('idx_transactions_category').on(table.category)
  })
);

export const debts = sqliteTable(
  'debts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').default(1).notNull(),
    contactName: text('contact_name').notNull(),
    totalOwedToUs: integer('total_owed_to_us').default(0).notNull(), // Piutang (Terhutangi)
    totalWeOwe: integer('total_we_owe').default(0).notNull(), // Hutang (Menghutangi)
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
  },
  (table) => ({
    userContactUnique: uniqueIndex('idx_debts_user_contact').on(table.userId, table.contactName)
  })
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').default(1).notNull(),
    category: text('category').notNull(),
    monthlyLimit: integer('monthly_limit').notNull().default(0)
  },
  (table) => ({
    userCategoryUnique: uniqueIndex('idx_budgets_user_category').on(table.userId, table.category)
  })
);

export const aiUsage = sqliteTable(
  'ai_usage',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').default(1).notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    requestCount: integer('request_count').notNull().default(0),
    modelUsed: text('model_used').notNull(),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
  },
  (table) => ({
    userDateUnique: uniqueIndex('idx_ai_usage_user_date').on(table.userId, table.date)
  })
);

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    emoji: text('emoji').notNull().default('💰'),
    color: text('color').notNull().default('#10b981'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active').notNull().default(1),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
  },
  (table) => ({
    userCategoryUnique: uniqueIndex('idx_categories_user_name').on(table.userId, table.name),
    userIdIdx: index('idx_categories_user_id').on(table.userId)
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;
export type NewAiUsage = typeof aiUsage.$inferInsert;
export type CategoryItem = typeof categories.$inferSelect;
export type NewCategoryItem = typeof categories.$inferInsert;
