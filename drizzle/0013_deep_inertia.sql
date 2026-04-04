ALTER TABLE `os_project_notes` ADD `note_type` text DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `os_projects` ADD `analysis_status` text;--> statement-breakpoint
ALTER TABLE `os_projects` ADD `analysis_error` text;--> statement-breakpoint
ALTER TABLE `os_projects` ADD `stars_count` integer;--> statement-breakpoint
ALTER TABLE `os_projects` ADD `trending_date` text;