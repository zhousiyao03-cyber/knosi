CREATE TABLE `curriculum_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`track_id` text NOT NULL,
	`summary` text NOT NULL,
	`strengths` text NOT NULL,
	`weak_areas` text NOT NULL,
	`missing_must_knows` text NOT NULL,
	`next_steps` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `curriculum_tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `curriculum_audits_user_idx` ON `curriculum_audits` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `curriculum_audits_track_idx` ON `curriculum_audits` (`track_id`);--> statement-breakpoint
CREATE TABLE `curriculum_mastery_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`mastery` text NOT NULL,
	`changed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `curriculum_topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `curriculum_mastery_log_user_idx` ON `curriculum_mastery_log` (`user_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `curriculum_mastery_log_topic_idx` ON `curriculum_mastery_log` (`topic_id`);