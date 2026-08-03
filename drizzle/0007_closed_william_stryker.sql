CREATE TABLE `provider_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_provider_cache_provider_updated_at` ON `provider_cache` (`provider`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_provider_cache_expires_at` ON `provider_cache` (`expires_at`);