import { error } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { asueEinsaetze, berichte, mannschaft, users, type Bericht } from './db/schema';
import type { SessionUser } from './auth';
import { teilnahmeStand } from './einstellungen';
import { leereDaten, vollstaendig, type BerichtDaten, type BerichtTyp, type MitgliedKurz } from '$lib/berichte/typen';

/** Sichtbare Mannschaft, alphabetisch wie auf dem Papierblatt */
export async function mannschaftListe(): Promise<MitgliedKurz[]> {
	return db
		.select({ stbnr: mannschaft.stbnr, nachname: mannschaft.nachname, vorname: mannschaft.vorname, gruppe: mannschaft.gruppe })
		.from(mannschaft)
		.where(eq(mannschaft.sichtbar, true))
		.orderBy(asc(mannschaft.nachname), asc(mannschaft.vorname));
}

type Stand = { stand: string; liste: MitgliedKurz[] };

function gespeicherterStand(b: Pick<Bericht, 'mannschaftStand'>): Stand | null {
	if (!b.mannschaftStand) return null;
	try {
		const s = JSON.parse(b.mannschaftStand);
		return Array.isArray(s) ? { stand: '', liste: s } : s;
	} catch {
		return null;
	}
}

/** Mannschaft für einen Bericht: eingereichte Berichte behalten den Stand vom Einreichen */
export async function mannschaftFuer(b: Pick<Bericht, 'mannschaftStand'>): Promise<MitgliedKurz[]> {
	return gespeicherterStand(b)?.liste ?? mannschaftListe();
}

/** „Stand“-Angabe der Teilnahmeliste für den Druck */
export async function teilnahmeStandFuer(b: Pick<Bericht, 'mannschaftStand'>): Promise<string> {
	return gespeicherterStand(b)?.stand || teilnahmeStand();
}

/** Findet das Mitglied zum Benutzerkonto über Standesbuchnummer oder Namen (in beliebiger Reihenfolge) */
async function mitgliedZuBenutzer(user: SessionUser): Promise<MitgliedKurz | null> {
	const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
	const gesucht = new Set([norm(user.name), norm(user.username)]);
	const treffer = (await mannschaftListe()).filter(
		(m) =>
			gesucht.has(String(m.stbnr)) ||
			gesucht.has(norm(`${m.vorname} ${m.nachname}`)) ||
			gesucht.has(norm(`${m.nachname} ${m.vorname}`))
	);
	return treffer.length === 1 ? treffer[0] : null;
}

export async function berichtAnlegen(typ: BerichtTyp, user: SessionUser): Promise<number> {
	const daten = leereDaten();
	const heute = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	daten.alarmierung.datum = `${heute.getFullYear()}-${pad(heute.getMonth() + 1)}-${pad(heute.getDate())}`;
	const ich = await mitgliedZuBenutzer(user);
	if (ich) daten.unterschriften.ausfuellender = { ...daten.unterschriften.ausfuellender, stbnr: ich.stbnr, name: `${ich.vorname} ${ich.nachname}` };
	const [row] = await db
		.insert(berichte)
		.values({ typ, daten: JSON.stringify(daten), erstelltVon: user.id, geaendertVon: user.id })
		.returning({ id: berichte.id });
	return row.id;
}

/** Lädt einen Bericht. Eingereichte Berichte sieht nur ein Admin. */
export async function berichtLaden(id: number, user: SessionUser | null, { druck = false } = {}) {
	const b = await db.select().from(berichte).where(eq(berichte.id, id)).get();
	if (!b) error(404, 'Bericht nicht gefunden');
	if (b.status === 'eingereicht' && !druck && user?.role !== 'admin') error(404, 'Bericht nicht gefunden');
	return { ...b, daten: vollstaendig(JSON.parse(b.daten)) };
}

export type BerichtListenEintrag = {
	id: number;
	typ: BerichtTyp;
	status: 'offen' | 'eingereicht';
	einsatzort: string;
	datum: string;
	erstelltVon: string | null;
	geaendertAm: Date;
	eingereichtAm: Date | null;
	unterschrieben: number;
};

export async function berichtListe(status: 'offen' | 'eingereicht'): Promise<BerichtListenEintrag[]> {
	const rows = await db
		.select({ b: berichte, name: users.name })
		.from(berichte)
		.leftJoin(users, eq(users.id, berichte.erstelltVon))
		.where(eq(berichte.status, status))
		.orderBy(desc(status === 'offen' ? berichte.geaendertAm : berichte.eingereichtAm));
	return rows.map(({ b, name }) => {
		const d = vollstaendig(JSON.parse(b.daten));
		return {
			id: b.id,
			typ: b.typ,
			status: b.status,
			einsatzort: d.einsatzort,
			datum: d.alarmierung.datum,
			erstelltVon: name,
			geaendertAm: b.geaendertAm,
			eingereichtAm: b.eingereichtAm,
			unterschrieben: Number(!!d.unterschriften.ausfuellender.bild) + Number(!!d.unterschriften.einsatzleiter.bild)
		};
	});
}

/** Speichert die Felder, wenn niemand anderer inzwischen gespeichert hat */
export async function berichtSpeichern(id: number, version: number, daten: BerichtDaten, user: SessionUser) {
	const b = await db.select({ status: berichte.status, version: berichte.version }).from(berichte).where(eq(berichte.id, id)).get();
	if (!b) return { status: 404 as const };
	if (b.status !== 'offen') return { status: 423 as const };
	if (b.version !== version) return { status: 409 as const };
	const neu = version + 1;
	const res = await db
		.update(berichte)
		.set({ daten: JSON.stringify(daten), version: neu, geaendertAm: new Date(), geaendertVon: user.id })
		.where(and(eq(berichte.id, id), eq(berichte.version, version)));
	if (res.rowsAffected === 0) return { status: 409 as const };
	return { status: 200 as const, version: neu };
}

/** Prüft, was zum Einreichen fehlt */
export function fehlendZumEinreichen(d: BerichtDaten): string[] {
	const fehlt: string[] = [];
	if (!d.einsatzort.trim()) fehlt.push('Einsatzort');
	if (!d.alarmierung.datum) fehlt.push('Datum der Alarmierung');
	for (const [key, name] of [['ausfuellender', 'Ausfüllender'], ['einsatzleiter', 'Einsatzleiter']] as const) {
		const u = d.unterschriften[key];
		if (!u.stbnr) fehlt.push(`Standesbuchnummer ${name}`);
		if (!u.bild) fehlt.push(`Unterschrift ${name}`);
	}
	return fehlt;
}

export async function berichtEinreichen(id: number, user: SessionUser) {
	const b = await db.select().from(berichte).where(eq(berichte.id, id)).get();
	if (!b) return { status: 404 as const, fehlt: [] };
	if (b.status !== 'offen') return { status: 423 as const, fehlt: [] };
	const fehlt = fehlendZumEinreichen(vollstaendig(JSON.parse(b.daten)));
	if (fehlt.length) return { status: 400 as const, fehlt };
	await db
		.update(berichte)
		.set({
			status: 'eingereicht',
			eingereichtAm: new Date(),
			eingereichtVon: user.id,
			mannschaftStand: JSON.stringify({ stand: await teilnahmeStand(), liste: await mannschaftListe() }),
			version: b.version + 1
		})
		.where(eq(berichte.id, id));
	return { status: 200 as const, fehlt: [] };
}

/** Atemschutzüberwachungen, die diesem Bericht zugeordnet sind */
export async function asueFuerBericht(id: number) {
	return db.select().from(asueEinsaetze).where(eq(asueEinsaetze.berichtId, id)).orderBy(asc(asueEinsaetze.erstellt));
}
