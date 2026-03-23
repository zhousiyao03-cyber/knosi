CREATE TABLE `knowledge_chunk_embeddings` (
	`chunk_id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`dims` integer NOT NULL,
	`vector` blob NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`chunk_id`) REFERENCES `knowledge_chunks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `knowledge_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`source_title` text NOT NULL,
	`source_updated_at` integer,
	`chunk_index` integer NOT NULL,
	`section_path` text,
	`block_type` text,
	`text` text NOT NULL,
	`text_hash` text NOT NULL,
	`token_count` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `knowledge_index_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 1 NOT NULL,
	`queued_at` integer,
	`finished_at` integer
);
