ALTER TABLE `transactions` ADD `payment_method` text DEFAULT 'Cash' NOT NULL;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `reference_id` text;
