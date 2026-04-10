CREATE TABLE `note_links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_note_id` text NOT NULL,
	`target_note_id` text NOT NULL,
	`target_title` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`source_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_links_source_idx` ON `note_links` (`source_note_id`);--> statement-breakpoint
CREATE INDEX `note_links_target_idx` ON `note_links` (`target_note_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `note_links_pair_idx` ON `note_links` (`source_note_id`,`target_note_id`);