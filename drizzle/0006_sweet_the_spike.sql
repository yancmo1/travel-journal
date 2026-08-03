ALTER TABLE `jobs` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
CREATE INDEX `idx_jobs_household_status` ON `jobs` (`household_id`,`status`);