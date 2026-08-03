CREATE INDEX `idx_journeys_household_start_date_id` ON `journeys` (`household_id`,`start_date`,`id`);--> statement-breakpoint
CREATE INDEX `idx_photos_household_trip_cover_sort` ON `photos` (`household_id`,`trip_id`,`is_cover`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `idx_trips_household_start_date_id` ON `trips` (`household_id`,`start_date`,`id`);