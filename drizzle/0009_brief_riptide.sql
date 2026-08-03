CREATE TABLE `upload_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` integer NOT NULL,
	`trip_id` integer NOT NULL,
	`client_upload_id` text NOT NULL,
	`reservation_token` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_upload_reservations_household_client` ON `upload_reservations` (`household_id`,`client_upload_id`);--> statement-breakpoint
CREATE INDEX `idx_upload_reservations_household_expires_at` ON `upload_reservations` (`household_id`,`expires_at`);