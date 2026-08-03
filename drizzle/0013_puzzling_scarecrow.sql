CREATE TABLE `data_deletions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` integer,
	`target_household_id` integer NOT NULL,
	`requested_by` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`phase` text DEFAULT 'preparing' NOT NULL,
	`media_prefix_index` integer DEFAULT 0 NOT NULL,
	`media_cursor` text,
	`media_deleted` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_data_deletions_target_status` ON `data_deletions` (`target_household_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_data_deletions_status_updated_at` ON `data_deletions` (`status`,`updated_at`);