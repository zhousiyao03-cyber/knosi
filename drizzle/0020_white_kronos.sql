DROP INDEX `chat_tasks_status_created_idx`;--> statement-breakpoint
CREATE INDEX `chat_tasks_status_created_idx` ON `chat_tasks` (`status`,`created_at`,`id`);