ALTER TABLE `photos` ADD `client_upload_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `photos_client_upload_id_unique` ON `photos` (`client_upload_id`);