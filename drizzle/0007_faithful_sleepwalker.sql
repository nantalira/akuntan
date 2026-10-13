PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '💰' NOT NULL,
	`color` text DEFAULT '#10b981' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "user_id", "name", "emoji", "color", "sort_order", "is_active", "created_at") SELECT "id", "user_id", "name", "emoji", "color", "sort_order", "is_active", "created_at" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_user_name` ON `categories` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_categories_user_id` ON `categories` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`model_used` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_usage`("id", "user_id", "date", "request_count", "model_used", "updated_at") SELECT "id", "user_id", "date", "request_count", "model_used", "updated_at" FROM `ai_usage`;--> statement-breakpoint
DROP TABLE `ai_usage`;--> statement-breakpoint
ALTER TABLE `__new_ai_usage` RENAME TO `ai_usage`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_usage_user_date` ON `ai_usage` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `__new_budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`monthly_limit` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_budgets`("id", "user_id", "category", "monthly_limit") SELECT "id", "user_id", "category", "monthly_limit" FROM `budgets`;--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budgets_user_category` ON `budgets` (`user_id`,`category`);--> statement-breakpoint
CREATE TABLE `__new_debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`contact_name` text NOT NULL,
	`total_owed_to_us` integer DEFAULT 0 NOT NULL,
	`total_we_owe` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_debts`("id", "user_id", "contact_name", "total_owed_to_us", "total_we_owe", "updated_at") SELECT "id", "user_id", "contact_name", "total_owed_to_us", "total_we_owe", "updated_at" FROM `debts`;--> statement-breakpoint
DROP TABLE `debts`;--> statement-breakpoint
ALTER TABLE `__new_debts` RENAME TO `debts`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_debts_user_contact` ON `debts` (`user_id`,`contact_name`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`category` text NOT NULL,
	`debtor` text,
	`creditor` text,
	`debt_amount` integer DEFAULT 0,
	`is_debt_settled` integer DEFAULT 0 NOT NULL,
	`debt_settled_at` text,
	`notes` text,
	`payment_method` text DEFAULT 'Cash' NOT NULL,
	`reference_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "user_id", "name", "amount", "date", "time", "category", "debtor", "creditor", "debt_amount", "is_debt_settled", "debt_settled_at", "notes", "payment_method", "reference_id", "source", "created_at") SELECT "id", "user_id", "name", "amount", "date", "time", "category", "debtor", "creditor", "debt_amount", "is_debt_settled", "debt_settled_at", "notes", "payment_method", "reference_id", "source", "created_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `idx_transactions_user_id` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_id_composite` ON `transactions` (`user_id`,`id`);