ALTER TABLE `users` ADD `ai_quota_used` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `ai_quota_limit` integer DEFAULT 20 NOT NULL;
