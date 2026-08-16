CREATE TABLE `onboarding_progress` (
	`household_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`home_skipped` integer DEFAULT false NOT NULL,
	`memory_id` integer,
	`journey_id` integer,
	`welcome_seen` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_onboarding_progress_household_user` ON `onboarding_progress` (`household_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_onboarding_progress_user_id` ON `onboarding_progress` (`user_id`);--> statement-breakpoint
ALTER TABLE `travelers` ADD `family_branch` text;--> statement-breakpoint
ALTER TABLE `travelers` ADD `display_order` integer;