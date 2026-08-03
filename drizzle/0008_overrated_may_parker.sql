CREATE TABLE `idempotency_keys` (
	`scope_key` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`response_status` integer,
	`response_body` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_idempotency_keys_expires_at` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_idempotency_keys_status_updated_at` ON `idempotency_keys` (`status`,`updated_at`);