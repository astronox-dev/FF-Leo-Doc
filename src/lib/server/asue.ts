import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import { db } from './db';
import { asueEinsaetze, asueEreignisse, users } from './db/schema';
import { reduziere, TYPEN, type Ereignis } from '$lib/asue/kern';
import { asueDruck } from '$lib/asue/druck';
import type { SessionUser } from './auth';

export const CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const EREIGNIS_ID = /^[a-z0-9]{8,40}$/;
const TYP_SET = new Set<string>(TYPEN);

export function pruefeEreignis(e: unknown): e is Ereignis {
	if (!e || typeof e !== 'object') return false;
	const x = e as Record<string, unknown>;
	return (
		typeof x.id === 'string' &&
		EREIGNIS_ID.test(x.id) &&
		typeof x.t === 'number' &&
		Number.isFinite(x.t) &&
		x.t > 0 &&
		typeof x.typ === 'string' &&
		TYP_SET.has(x.typ) &&
		!!x.daten &&
		typeof x.daten === 'object' &&
		!Array.isArray(x.daten) &&
		JSON.stringify(x.daten).length <= 8000
	);
}

type Zeile = typeof asueEreignisse.$inferSelect & { von: string | null };
const alsEreignis = (z: Zeile): Ereignis => ({
	seq: z.seq,
	id: z.id,
	t: z.t,
	typ: z.typ as Ereignis['typ'],
	daten: JSON.parse(z.daten),
	geraet: z.geraet,
	von: z.von ?? undefined
});

export async function einsatzVorhanden(code: string) {
	return !!(await db.select({ id: asueEinsaetze.id }).from(asueEinsaetze).where(eq(asueEinsaetze.id, code)).get());
}

export async function ereignisseNach(code: string, nach: number): Promise<Ereignis[]> {
	const rows = await db
		.select({ e: asueEreignisse, von: users.name })
		.from(asueEreignisse)
		.leftJoin(users, eq(users.id, asueEreignisse.userId))
		.where(and(eq(asueEreignisse.einsatz, code), gt(asueEreignisse.seq, nach)))
		.orderBy(asc(asueEreignisse.seq));
	return rows.map(({ e, von }) => alsEreignis({ ...e, von }));
}

/** Liste der Überwachungen für die Startseite */
export async function einsatzListe() {
	return db.select().from(asueEinsaetze).orderBy(desc(asueEinsaetze.erstellt)).limit(200);
}

/* ---------------------------------------------------------------- Live-Verbindungen */

type Zuhoerer = { senden: (text: string) => void };
const zuhoerer = new Map<string, Set<Zuhoerer>>();

export function abonnieren(code: string, z: Zuhoerer) {
	if (!zuhoerer.has(code)) zuhoerer.set(code, new Set());
	zuhoerer.get(code)!.add(z);
	return () => {
		zuhoerer.get(code)?.delete(z);
		if (!zuhoerer.get(code)?.size) zuhoerer.delete(code);
	};
}

function verteilen(code: string, ereignisse: Ereignis[]) {
	for (const z of zuhoerer.get(code) ?? []) {
		for (const e of ereignisse) z.senden(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
	}
}

/* ---------------------------------------------------------------- Speichern */

/** Speichert neue Ereignisse (doppelte werden ignoriert) und verteilt sie live */
export async function ereignisseSpeichern(code: string, liste: Ereignis[], user: SessionUser) {
	if (!(await einsatzVorhanden(code))) {
		const anlage = liste.find((e) => e.typ === 'einsatz_angelegt');
		if (!anlage) return { status: 404 as const };
		await db.insert(asueEinsaetze).values({ id: code, erstellt: Math.round(anlage.t), erstelltVon: user.id }).onConflictDoNothing();
	}

	const jetzt = Date.now();
	const neu: Ereignis[] = [];
	const antwort: { id: string; seq: number }[] = [];
	await db.transaction(async (tx) => {
		for (const e of liste) {
			const eingefuegt = await tx
				.insert(asueEreignisse)
				.values({ id: e.id, einsatz: code, t: Math.round(e.t), typ: e.typ, daten: JSON.stringify(e.daten), geraet: String(e.geraet ?? '').slice(0, 40), userId: user.id, empfangen: jetzt })
				.onConflictDoNothing()
				.returning({ seq: asueEreignisse.seq });
			if (eingefuegt.length) {
				const seq = eingefuegt[0].seq;
				neu.push({ ...e, t: Math.round(e.t), seq, von: user.name });
				antwort.push({ id: e.id, seq });
			} else {
				const vorhanden = await tx.select({ seq: asueEreignisse.seq, einsatz: asueEreignisse.einsatz }).from(asueEreignisse).where(eq(asueEreignisse.id, e.id)).get();
				if (vorhanden?.einsatz === code) antwort.push({ id: e.id, seq: vorhanden.seq });
			}
		}
	});

	if (neu.some((e) => ['einsatz_angelegt', 'einsatz_geaendert', 'einsatz_abgeschlossen', 'einsatz_wiedereroeffnet', 'bericht_zugeordnet'].includes(e.typ))) {
		await kopfAktualisieren(code);
	}
	verteilen(code, neu);
	return { status: 200 as const, ereignisse: antwort };
}

/** Datum, Adresse, Abschluss und Berichtszuordnung für Listen aus den Ereignissen ableiten */
async function kopfAktualisieren(code: string) {
	const z = reduziere(await ereignisseNach(code, 0));
	await db
		.update(asueEinsaetze)
		.set({
			datum: z.einsatz?.datum ?? '',
			adresse: (z.einsatz?.adresse ?? '').slice(0, 200),
			stufe: z.einsatz?.stufe ?? '',
			abgeschlossen: z.abgeschlossen,
			berichtId: z.bericht?.id ?? null
		})
		.where(eq(asueEinsaetze.id, code));
}

/** Atemschutzprotokolle, die einem Einsatzbericht zugeordnet sind, für den Druck */
export async function asueDruckFuerBericht(berichtId: number) {
	const einsaetze = await db.select({ id: asueEinsaetze.id }).from(asueEinsaetze).where(eq(asueEinsaetze.berichtId, berichtId)).orderBy(asc(asueEinsaetze.erstellt));
	if (!einsaetze.length) return [];
	const rows = await db
		.select()
		.from(asueEreignisse)
		.where(inArray(asueEreignisse.einsatz, einsaetze.map((e) => e.id)))
		.orderBy(asc(asueEreignisse.seq));
	return einsaetze.map((e) =>
		asueDruck(
			e.id,
			rows.filter((r) => r.einsatz === e.id).map((r) => alsEreignis({ ...r, von: null }))
		)
	);
}
