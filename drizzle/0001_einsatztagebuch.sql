CREATE TABLE `etb_ereignisse` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`tagebuch` text NOT NULL,
	`t` integer NOT NULL,
	`typ` text NOT NULL,
	`daten` text NOT NULL,
	`geraet` text DEFAULT '' NOT NULL,
	`user_id` integer,
	`empfangen` integer NOT NULL,
	FOREIGN KEY (`tagebuch`) REFERENCES `etb_tagebuecher`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `etb_ereignisse_id_unique` ON `etb_ereignisse` (`id`);--> statement-breakpoint
CREATE INDEX `etb_ereignisse_tagebuch` ON `etb_ereignisse` (`tagebuch`,`seq`);--> statement-breakpoint
CREATE TABLE `etb_tagebuecher` (
	`id` text PRIMARY KEY NOT NULL,
	`erstellt` integer NOT NULL,
	`datum` text DEFAULT '' NOT NULL,
	`einsatzort` text DEFAULT '' NOT NULL,
	`eintraege` integer DEFAULT 0 NOT NULL,
	`abgeschlossen` integer DEFAULT false NOT NULL,
	`bericht_id` integer,
	`erstellt_von` integer,
	FOREIGN KEY (`bericht_id`) REFERENCES `berichte`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`erstellt_von`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
