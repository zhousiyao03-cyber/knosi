ALTER TABLE `os_project_notes` ADD `share_token` text;--> statement-breakpoint
ALTER TABLE `os_project_notes` ADD `shared_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `os_project_notes_share_token_unique` ON `os_project_notes` (`share_token`);