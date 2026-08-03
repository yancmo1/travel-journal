CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lease_expires_at` text,
	`idempotency_key` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_key_unique` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status_available_at` ON `jobs` (`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `idx_jobs_lease_expires_at` ON `jobs` (`lease_expires_at`);--> statement-breakpoint
ALTER TABLE `photos` ADD `display_r2_key` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `height` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `checksum` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `processing_status` text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `processing_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `processing_error` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `metadata_source` text DEFAULT 'client' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_photos_processing_status` ON `photos` (`processing_status`,`uploaded_at`);