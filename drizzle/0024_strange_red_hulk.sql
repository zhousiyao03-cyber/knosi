CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`collapsed` integer DEFAULT false NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `folders_user_idx` ON `folders` (`user_id`);--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`);--> statement-breakpoint
ALTER TABLE `notes` ADD `folder` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `folder_id` text REFERENCES folders(id);--> statement-breakpoint
CREATE INDEX `notes_user_idx` ON `notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `notes_user_folder_idx` ON `notes` (`user_id`,`folder`);--> statement-breakpoint
CREATE INDEX `notes_folder_id_idx` ON `notes` (`folder_id`);--> statement-breakpoint
CREATE INDEX `analysis_messages_task_idx` ON `analysis_messages` (`task_id`,`seq`);--> statement-breakpoint
CREATE INDEX `analysis_tasks_project_idx` ON `analysis_tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `analysis_tasks_status_idx` ON `analysis_tasks` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `bookmarks_user_idx` ON `bookmarks` (`user_id`);--> statement-breakpoint
CREATE INDEX `chat_messages_user_idx` ON `chat_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `knowledge_chunks_source_idx` ON `knowledge_chunks` (`source_id`);--> statement-breakpoint
CREATE INDEX `knowledge_index_jobs_source_idx` ON `knowledge_index_jobs` (`source_id`);--> statement-breakpoint
CREATE INDEX `knowledge_index_jobs_status_idx` ON `knowledge_index_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `learning_lessons_path_idx` ON `learning_lessons` (`path_id`);--> statement-breakpoint
CREATE INDEX `learning_notes_topic_idx` ON `learning_notes` (`topic_id`);--> statement-breakpoint
CREATE INDEX `learning_notes_user_idx` ON `learning_notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `learning_paths_user_idx` ON `learning_paths` (`user_id`);--> statement-breakpoint
CREATE INDEX `learning_reviews_topic_idx` ON `learning_reviews` (`topic_id`);--> statement-breakpoint
CREATE INDEX `learning_topics_user_idx` ON `learning_topics` (`user_id`);--> statement-breakpoint
CREATE INDEX `os_project_notes_project_idx` ON `os_project_notes` (`project_id`);--> statement-breakpoint
CREATE INDEX `os_projects_user_idx` ON `os_projects` (`user_id`);--> statement-breakpoint
CREATE INDEX `portfolio_holdings_user_idx` ON `portfolio_holdings` (`user_id`);--> statement-breakpoint
CREATE INDEX `portfolio_holdings_user_symbol_idx` ON `portfolio_holdings` (`user_id`,`symbol`);--> statement-breakpoint
CREATE INDEX `portfolio_news_user_idx` ON `portfolio_news` (`user_id`);--> statement-breakpoint
CREATE INDEX `portfolio_news_user_symbol_idx` ON `portfolio_news` (`user_id`,`symbol`);--> statement-breakpoint
CREATE INDEX `todos_user_idx` ON `todos` (`user_id`);--> statement-breakpoint
CREATE INDEX `todos_user_duedate_status_idx` ON `todos` (`user_id`,`due_date`,`status`);--> statement-breakpoint
CREATE INDEX `token_usage_entries_user_idx` ON `token_usage_entries` (`user_id`,`usage_at`);--> statement-breakpoint
CREATE INDEX `workflow_runs_workflow_idx` ON `workflow_runs` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `workflows_user_idx` ON `workflows` (`user_id`);