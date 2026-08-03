CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer,
	`household_id` integer,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_household_created_at` ON `audit_events` (`household_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_user_created_at` ON `audit_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_action_created_at` ON `audit_events` (`action`,`created_at`);