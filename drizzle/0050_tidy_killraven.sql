CREATE TABLE `curriculum_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`track_id`) REFERENCES `curriculum_tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `curriculum_areas_track_idx` ON `curriculum_areas` (`track_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `curriculum_topic_notes` (
	`topic_id` text NOT NULL,
	`note_id` text NOT NULL,
	`created_at` integer,
	PRIMARY KEY(`topic_id`, `note_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `curriculum_topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `learning_notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `curriculum_topic_notes_note_idx` ON `curriculum_topic_notes` (`note_id`);--> statement-breakpoint
CREATE TABLE `curriculum_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`area_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`description` text,
	`mastery` text DEFAULT 'blank' NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`area_id`) REFERENCES `curriculum_areas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `curriculum_topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `curriculum_topics_area_idx` ON `curriculum_topics` (`area_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `curriculum_topics_parent_idx` ON `curriculum_topics` (`area_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `curriculum_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `curriculum_tracks_user_idx` ON `curriculum_tracks` (`user_id`,`order_index`);