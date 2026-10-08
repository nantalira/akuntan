ALTER TABLE `transactions` ADD `is_debt_settled` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `debt_settled_at` text;