CREATE TABLE `analysis_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analysis_prompts_user_kind_idx` ON `analysis_prompts` (`user_id`,`kind`);--> statement-breakpoint
ALTER TABLE `os_projects` ADD `analysis_commit` text;--> statement-breakpoint
ALTER TABLE `os_projects` ADD `analysis_commit_date` integer;--> statement-breakpoint
ALTER TABLE `os_projects` ADD `analysis_started_at` integer;--> statement-breakpoint
ALTER TABLE `os_projects` ADD `analysis_finished_at` integer;