CREATE TABLE `data_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` integer NOT NULL,
	`requested_by` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`phase` text DEFAULT 'preparing' NOT NULL,
	`manifest_key` text,
	`media_total` integer DEFAULT 0 NOT NULL,
	`media_copied` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_data_exports_household_created_at` ON `data_exports` (`household_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_data_exports_status_updated_at` ON `data_exports` (`status`,`updated_at`);