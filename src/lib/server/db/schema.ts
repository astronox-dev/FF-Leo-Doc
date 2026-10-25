import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const jetzt = sql`(unixepoch() * 1000)`;

/* ---------------------------------------------------------------- Benutzer */

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	/** 'admin' oder 'nutzer' */
	role: text('role', { enum: ['admin', 'nutzer'] }).notNull().default('nutzer'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(jetzt),
	lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' })
});

/** Sitzungen laufen nie ab; sie enden nur durch Abmelden oder Deaktivieren */
export const sessions = sqliteTable(
	'sessions',
	{
		/** SHA-256 des Tokens, das Token selbst steht nur im Cookie */
		id: text('id').primaryKey(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(jetzt),
		lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull().default(jetzt),
		userAgent: text('user_agent')
	},
	(t) => [index('sessions_user').on(t.userId)]
);

/* ---------------------------------------------------------------- Stammdaten */

/** Mannschaft für die Teilnahmeliste der Einsatzberichte */
export const mannschaft = sqliteTable('mannschaft', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	stbnr: integer('stbnr').notNull().unique(),
	nachname: text('nachname').notNull(),
	vorname: text('vorname').notNull(),
	/** 'aktiv' oder 'reserve' */
	gruppe: text('gruppe', { enum: ['aktiv', 'reserve'] }).notNull().default('aktiv'),
	/** Ausgeblendete Mitglieder stehen nicht mehr auf neuen Teilnahmelisten */
	sichtbar: integer('sichtbar', { mode: 'boolean' }).notNull().default(true)
});

export const einstellungen = sqliteTable('einstellungen', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

/* ---------------------------------------------------------------- Einsatzberichte */

export const berichte = sqliteTable(
	'berichte',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** 'brand' | 'technik' | 'schadstoff' | 'tus' */
		typ: text('typ', { enum: ['brand', 'technik', 'schadstoff', 'tus'] }).notNull(),
		status: text('status', { enum: ['offen', 'eingereicht'] }).notNull().default('offen'),
		/** Alle Felder des Aufnahmeblatts als JSON */
		daten: text('daten').notNull().default('{}'),
		/** Steigt bei jedem Speichern, erkennt gleichzeitige Änderungen */
		version: integer('version').notNull().default(1),
		erstelltVon: integer('erstellt_von').references(() => users.id, { onDelete: 'set null' }),
		erstelltAm: integer('erstellt_am', { mode: 'timestamp_ms' }).notNull().default(jetzt),
		geaendertVon: integer('geaendert_von').references(() => users.id, { onDelete: 'set null' }),
		geaendertAm: integer('geaendert_am', { mode: 'timestamp_ms' }).notNull().default(jetzt),
		eingereichtVon: integer('eingereicht_von').references(() => users.id, { onDelete: 'set null' }),
		eingereichtAm: integer('eingereicht_am', { mode: 'timestamp_ms' }),
		/** Mannschaftsliste zum Zeitpunkt des Einreichens, damit spätere Änderungen den Bericht nicht verändern */
		mannschaftStand: text('mannschaft_stand')
	},
	(t) => [index('berichte_status').on(t.status)]
);

/* ---------------------------------------------------------------- Atemschutzüberwachung */

export const asueEinsaetze = sqliteTable('asue_einsaetze', {
	/** 6-stelliger Code, z. B. T4HFK9 */
	id: text('id').primaryKey(),
	erstellt: integer('erstellt').notNull(),
	datum: text('datum').notNull().default(''),
	adresse: text('adresse').notNull().default(''),
	stufe: text('stufe').notNull().default(''),
	abgeschlossen: integer('abgeschlossen', { mode: 'boolean' }).notNull().default(false),
	berichtId: integer('bericht_id').references(() => berichte.id, { onDelete: 'set null' }),
	erstelltVon: integer('erstellt_von').references(() => users.id, { onDelete: 'set null' })
});

export const asueEreignisse = sqliteTable(
	'asue_ereignisse',
	{
		seq: integer('seq').primaryKey({ autoIncrement: true }),
		id: text('id').notNull().unique(),
		einsatz: text('einsatz')
			.notNull()
			.references(() => asueEinsaetze.id, { onDelete: 'cascade' }),
		t: integer('t').notNull(),
		typ: text('typ').notNull(),
		daten: text('daten').notNull(),
		geraet: text('geraet').notNull().default(''),
		userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
		empfangen: integer('empfangen').notNull()
	},
	(t) => [index('asue_ereignisse_einsatz').on(t.einsatz, t.seq)]
);

export type User = typeof users.$inferSelect;
export type Bericht = typeof berichte.$inferSelect;
export type Mitglied = typeof mannschaft.$inferSelect;
