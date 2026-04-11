CREATE INDEX `bookmarks_user_created_idx` ON `bookmarks` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `knowledge_index_jobs_status_queued_idx` ON `knowledge_index_jobs` (`status`,`queued_at`);--> statement-breakpoint
CREATE INDEX `notes_user_updated_idx` ON `notes` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `todos_user_created_idx` ON `todos` (`user_id`,`created_at`);