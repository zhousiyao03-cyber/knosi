CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`ls_subscription_id` text NOT NULL,
	`ls_customer_id` text NOT NULL,
	`ls_variant_id` text NOT NULL,
	`plan` text DEFAULT 'pro' NOT NULL,
	`status` text NOT NULL,
	`current_period_end` integer,
	`trial_ends_at` integer,
	`cancelled_at` integer,
	`renews_at` integer,
	`update_url` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_user_id_unique` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_ls_subscription_id_unique` ON `subscriptions` (`ls_subscription_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`payload` text NOT NULL,
	`signature` text,
	`received_at` integer,
	`processed_at` integer,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `webhook_events_received_idx` ON `webhook_events` (`received_at`);