CREATE TABLE `user_words` (
	`user_id` text NOT NULL,
	`word_id` text NOT NULL,
	`text` text NOT NULL,
	`text_normalized` text NOT NULL,
	`ipa` text NOT NULL,
	`stress_pattern` text NOT NULL,
	`meaning_zh` text NOT NULL,
	`example_en` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `word_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_words_user_text_idx` ON `user_words` (`user_id`,`text_normalized`);--> statement-breakpoint
CREATE TABLE `word_practice` (
	`user_id` text NOT NULL,
	`word_id` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`last_practiced_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `word_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
