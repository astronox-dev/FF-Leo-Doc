CREATE TABLE `asue_einsaetze` (
	`id` text PRIMARY KEY NOT NULL,
	`erstellt` integer NOT NULL,
	`datum` text DEFAULT '' NOT NULL,
	`adresse` text DEFAULT '' NOT NULL,
	`stufe` text DEFAULT '' NOT NULL,
	`abgeschlossen` integer DEFAULT false NOT NULL,
	`bericht_id` integer,
	`erstellt_von` integer,
	FOREIGN KEY (`bericht_id`) REFERENCES `berichte`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`erstellt_von`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `asue_ereignisse` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`einsatz` text NOT NULL,
	`t` integer NOT NULL,
	`typ` text NOT NULL,
	`daten` text NOT NULL,
	`geraet` text DEFAULT '' NOT NULL,
	`user_id` integer,
	`empfangen` integer NOT NULL,
	FOREIGN KEY (`einsatz`) REFERENCES `asue_einsaetze`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asue_ereignisse_id_unique` ON `asue_ereignisse` (`id`);--> statement-breakpoint
CREATE INDEX `asue_ereignisse_einsatz` ON `asue_ereignisse` (`einsatz`,`seq`);--> statement-breakpoint
CREATE TABLE `berichte` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`typ` text NOT NULL,
	`status` text DEFAULT 'offen' NOT NULL,
	`daten` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`erstellt_von` integer,
	`erstellt_am` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`geaendert_von` integer,
	`geaendert_am` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`eingereicht_von` integer,
	`eingereicht_am` integer,
	`mannschaft_stand` text,
	FOREIGN KEY (`erstellt_von`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`geaendert_von`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`eingereicht_von`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `berichte_status` ON `berichte` (`status`);--> statement-breakpoint
CREATE TABLE `einstellungen` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mannschaft` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stbnr` integer NOT NULL,
	`nachname` text NOT NULL,
	`vorname` text NOT NULL,
	`gruppe` text DEFAULT 'aktiv' NOT NULL,
	`sichtbar` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mannschaft_stbnr_unique` ON `mannschaft` (`stbnr`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'nutzer' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);