CREATE TABLE `speak_sentence_practice` (
	`user_id` text NOT NULL,
	`sentence_id` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`last_practiced_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `sentence_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
