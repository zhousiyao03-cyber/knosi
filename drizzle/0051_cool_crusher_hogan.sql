CREATE TABLE `curriculum_topic_general_notes` (
	`topic_id` text NOT NULL,
	`note_id` text NOT NULL,
	`source` text DEFAULT 'auto_substring' NOT NULL,
	`created_at` integer,
	PRIMARY KEY(`topic_id`, `note_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `curriculum_topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `curriculum_topic_general_notes_note_idx` ON `curriculum_topic_general_notes` (`note_id`);--> statement-breakpoint
ALTER TABLE `curriculum_topic_notes` ADD `source` text DEFAULT 'auto_substring' NOT NULL;