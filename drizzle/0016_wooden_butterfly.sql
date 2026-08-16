ALTER TABLE `users` ADD `home_latitude` real;--> statement-breakpoint
ALTER TABLE `users` ADD `home_longitude` real;--> statement-breakpoint
ALTER TABLE `users` ADD `home_label` text;--> statement-breakpoint
ALTER TABLE `users` ADD `home_icon` text DEFAULT 'h' NOT NULL;