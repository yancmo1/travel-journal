CREATE TABLE `household_members` (
	`household_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_household_members_household_user` ON `household_members` (`household_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_household_members_user_id` ON `household_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `households_slug_unique` ON `households` (`slug`);--> statement-breakpoint
CREATE TABLE `journeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`title` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`date_label` text,
	`journey_type` text DEFAULT 'Other' NOT NULL,
	`summary` text,
	`cover_photo_id` integer,
	`share_token` text,
	`share_expires_at` text,
	`created_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_journeys_household_id` ON `journeys` (`household_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_journeys_share_token` ON `journeys` (`share_token`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`trip_id` integer NOT NULL,
	`r2_key` text NOT NULL,
	`thumbnail_r2_key` text,
	`original_filename` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`date_taken` text,
	`latitude` real,
	`longitude` real,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_cover` integer DEFAULT false NOT NULL,
	`rotation` integer DEFAULT 0 NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_r2_key_unique` ON `photos` (`r2_key`);--> statement-breakpoint
CREATE INDEX `idx_photos_household_id` ON `photos` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_photos_trip_sort_order` ON `photos` (`trip_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `travelers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`name` text NOT NULL,
	`relationship` text DEFAULT 'other' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_travelers_household_id` ON `travelers` (`household_id`);--> statement-breakpoint
CREATE TABLE `trip_travelers` (
	`trip_id` integer NOT NULL,
	`traveler_id` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`traveler_id`) REFERENCES `travelers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_trip_travelers_trip_traveler` ON `trip_travelers` (`trip_id`,`traveler_id`);--> statement-breakpoint
CREATE INDEX `idx_trip_travelers_traveler_id` ON `trip_travelers` (`traveler_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`location_name` text NOT NULL,
	`city` text,
	`latitude` real,
	`longitude` real,
	`country` text,
	`state` text,
	`start_date` text,
	`end_date` text,
	`date_label` text,
	`date_precision` text DEFAULT 'exact' NOT NULL,
	`trip_type` text DEFAULT 'Other' NOT NULL,
	`notes` text,
	`journey_id` integer,
	`journey_order` integer,
	`home_distance_miles` real,
	`created_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`journey_id`) REFERENCES `journeys`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_trips_household_id` ON `trips` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_trips_household_start_date` ON `trips` (`household_id`,`start_date`);--> statement-breakpoint
CREATE INDEX `idx_trips_journey_id` ON `trips` (`journey_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);