CREATE TABLE `photo_upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` integer NOT NULL,
	`trip_id` integer NOT NULL,
	`client_upload_id` text NOT NULL,
	`reservation_token` text NOT NULL,
	`original_key` text NOT NULL,
	`display_key` text,
	`thumbnail_key` text,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`original_bytes` integer NOT NULL,
	`display_bytes` integer,
	`thumbnail_bytes` integer,
	`original_checksum` text,
	`display_checksum` text,
	`thumbnail_checksum` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`original_uploaded_at` text,
	`display_uploaded_at` text,
	`thumbnail_uploaded_at` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_upload_sessions_original_key_unique` ON `photo_upload_sessions` (`original_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `photo_upload_sessions_display_key_unique` ON `photo_upload_sessions` (`display_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `photo_upload_sessions_thumbnail_key_unique` ON `photo_upload_sessions` (`thumbnail_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_photo_upload_sessions_household_client` ON `photo_upload_sessions` (`household_id`,`client_upload_id`);--> statement-breakpoint
CREATE INDEX `idx_photo_upload_sessions_household_expires_at` ON `photo_upload_sessions` (`household_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_photo_upload_sessions_status_expires_at` ON `photo_upload_sessions` (`status`,`expires_at`);