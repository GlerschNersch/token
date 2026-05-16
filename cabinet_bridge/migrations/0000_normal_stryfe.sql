CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`label` text NOT NULL,
	`endpoint` text NOT NULL,
	`status` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cheat_file_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`cheats_json` text NOT NULL,
	`cached_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cheat_file_cache_path_unique` ON `cheat_file_cache` (`path`);--> statement-breakpoint
CREATE TABLE `cheat_index_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`folder` text NOT NULL,
	`files_json` text NOT NULL,
	`cached_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cheat_index_cache_folder_unique` ON `cheat_index_cache` (`folder`);--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_id` integer NOT NULL,
	`rom_id` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_cheat_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rom_id` integer NOT NULL,
	`profile_id` integer DEFAULT 1 NOT NULL,
	`description` text NOT NULL,
	`code` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`smart_filter` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_collections_slug_unique` ON `game_collections` (`slug`);--> statement-breakpoint
CREATE TABLE `gamepad_bindings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer DEFAULT 1 NOT NULL,
	`gamepad_id` text DEFAULT 'default' NOT NULL,
	`bindings` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hltb_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rom_id` integer NOT NULL,
	`hltb_title` text,
	`main_story` integer,
	`main_extra` integer,
	`completionist` integer,
	`cached_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hltb_cache_rom_id_unique` ON `hltb_cache` (`rom_id`);--> statement-breakpoint
CREATE TABLE `profile_control_bindings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`core` text NOT NULL,
	`bindings` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile_game_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`rom_id` integer NOT NULL,
	`favorite` integer,
	`rating` integer,
	`play_status` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rom_save_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rom_id` integer NOT NULL,
	`user_id` text DEFAULT 'default' NOT NULL,
	`slot` integer NOT NULL,
	`label` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploaded_roms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`system` text NOT NULL,
	`slug` text NOT NULL,
	`original_name` text NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`art_url` text,
	`scrape_status` text DEFAULT 'not_scraped' NOT NULL,
	`scrape_message` text,
	`favorite` integer DEFAULT true NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`last_played` integer DEFAULT 0 NOT NULL,
	`play_count` integer DEFAULT 0 NOT NULL,
	`disc_number` integer,
	`disc_group` text,
	`description` text,
	`release_year` integer,
	`developer` text,
	`publisher` text,
	`genre` text,
	`players` text,
	`rom_hash` text,
	`community_score` integer,
	`wheel_art_url` text,
	`video_url` text,
	`ra_game_id` integer,
	`minutes_played` integer DEFAULT 0 NOT NULL,
	`play_status` text DEFAULT 'unset' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploaded_roms_slug_unique` ON `uploaded_roms` (`slug`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#8b5cf6' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);