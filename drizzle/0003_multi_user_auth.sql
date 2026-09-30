CREATE TABLE IF NOT EXISTS `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text,
	`google_id` text,
	`avatar_url` text,
	`gemini_api_key` text,
	`webhook_token` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_google_id_unique` ON `users` (`google_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_webhook_token_unique` ON `users` (`webhook_token`);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `user_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_transactions_user_id` ON `transactions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `__new_debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer DEFAULT 1 NOT NULL,
	`contact_name` text NOT NULL,
	`total_owed_to_us` integer DEFAULT 0 NOT NULL,
	`total_we_owe` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_debts` (`id`, `user_id`, `contact_name`, `total_owed_to_us`, `total_we_owe`, `updated_at`)
SELECT `id`, 1, `contact_name`, `total_owed_to_us`, `total_we_owe`, `updated_at` FROM `debts`;
--> statement-breakpoint
DROP TABLE `debts`;
--> statement-breakpoint
ALTER TABLE `__new_debts` RENAME TO `debts`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_debts_user_contact` ON `debts` (`user_id`, `contact_name`);
--> statement-breakpoint
CREATE TABLE `__new_budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer DEFAULT 1 NOT NULL,
	`category` text NOT NULL,
	`monthly_limit` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_budgets` (`id`, `user_id`, `category`, `monthly_limit`)
SELECT `id`, 1, `category`, `monthly_limit` FROM `budgets`;
--> statement-breakpoint
DROP TABLE `budgets`;
--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budgets_user_category` ON `budgets` (`user_id`, `category`);
--> statement-breakpoint
CREATE TABLE `__new_ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer DEFAULT 1 NOT NULL,
	`date` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`model_used` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_ai_usage` (`id`, `user_id`, `date`, `request_count`, `model_used`, `updated_at`)
SELECT `id`, 1, `date`, `request_count`, `model_used`, `updated_at` FROM `ai_usage`;
--> statement-breakpoint
DROP TABLE `ai_usage`;
--> statement-breakpoint
ALTER TABLE `__new_ai_usage` RENAME TO `ai_usage`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_usage_user_date` ON `ai_usage` (`user_id`, `date`);
