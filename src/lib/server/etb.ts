import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import { db } from './db';
import { etbEreignisse, etbTagebuecher, users } from './db/schema';
import { reduziere, TYPEN, type Ereignis, type Zustand } from '$lib/etb/kern';
import { istEreignis, verteilen } from './live';
import type { SessionUser } from './auth';

/* Einsatztagebuch am Server: Ereignisse speichern, live verteilen, Stand für Listen und Druck */

export { CODE } from './live';
const TYP_SET = new Set<string>(TYPEN);
export const etbKanal = (code: string) => `etb:${code}`;
export const pruefeEreignis = (e: unknown): e is Ereignis => istEreignis(e, TYP_SET);

type Zeile = typeof etbEreignisse.$inferSelect & { von: string | null };
const alsEreignis = (z: Zeile): Ereignis => ({
	seq: z.seq,
	id: z.id,
	t: z.t,
	typ: z.typ as Ereignis['typ'],
	daten: JSON.parse(z.daten),
	geraet: z.geraet,
	von: z.von ?? undefined
});

export async function tagebuchVorhanden(code: string) {
	return !!(await db.select({ id: etbTagebuecher.id }).from(etbTagebuecher).where(eq(etbTagebuecher.id, code)).get());
}

export async function ereignisseNach(code: string, nach: number): Promise<Ereignis[]> {
	const rows = await db
		.select({ e: etbEreignisse, von: users.name })
		.from(etbEreignisse)
		.leftJoin(users, eq(users.id, etbEreignisse.userId))
		.where(and(eq(etbEreignisse.tagebuch, code), gt(etbEreignisse.seq, nach)))
		.orderBy(asc(etbEreignisse.seq));
	return rows.map(({ e, von }) => alsEreignis({ ...e, von }));
}

export async function tagebuchListe() {
	return db.select().from(etbTagebuecher).orderBy(desc(etbTagebuecher.erstellt)).limit(200);
}

/** Speichert neue Ereignisse (doppelte werden ignoriert) und verteilt sie live */
export async function ereignisseSpeichern(code: string, liste: Ereignis[], user: SessionUser) {
	if (!(await tagebuchVorhanden(code))) {
		const anlage = liste.find((e) => e.typ === 'tagebuch_angelegt');
		if (!anlage) return { status: 404 as const };
		await db.insert(etbTagebuecher).values({ id: code, erstellt: Math.round(anlage.t), erstelltVon: user.id }).onConflictDoNothing();
	}

	const jetzt = Date.now();
	const neu: Ereignis[] = [];
	const antwort: { id: string; seq: number }[] = [];
	await db.transaction(async (tx) => {
		for (const e of liste) {
			const eingefuegt = await tx
				.insert(etbEreignisse)
				.values({ id: e.id, tagebuch: code, t: Math.round(e.t), typ: e.typ, daten: JSON.stringify(e.daten), geraet: String(e.geraet ?? '').slice(0, 40), userId: user.id, empfangen: jetzt })
				.onConflictDoNothing()
				.returning({ seq: etbEreignisse.seq });
			if (eingefuegt.length) {
				const seq = eingefuegt[0].seq;
				neu.push({ ...e, t: Math.round(e.t), seq, von: user.name });
				antwort.push({ id: e.id, seq });
			} else {
				const vorhanden = await tx.select({ seq: etbEreignisse.seq, tagebuch: etbEreignisse.tagebuch }).from(etbEreignisse).where(eq(etbEreignisse.id, e.id)).get();
				if (vorhanden?.tagebuch === code) antwort.push({ id: e.id, seq: vorhanden.seq });
			}
		}
	});

	if (neu.length) await kopfAktualisieren(code);
	verteilen(etbKanal(code), neu);
	return { status: 200 as const, ereignisse: antwort };
}

/** Datum, Ort, Anzahl Einträge, Abschluss und Berichtszuordnung für Listen ableiten */
async function kopfAktualisieren(code: string) {
	const z = reduziere(await ereignisseNach(code, 0));
	await db
		.update(etbTagebuecher)
		.set({
			datum: z.kopf?.datum ?? '',
			einsatzort: (z.kopf?.einsatzort ?? '').slice(0, 200),
			eintraege: z.eintraege.length,
			abgeschlossen: z.abgeschlossen,
			berichtId: z.bericht?.id ?? null
		})
		.where(eq(etbTagebuecher.id, code));
}

export type EtbDruck = { code: string; zustand: Zustand };

/** Stand eines Tagebuchs für den Druck */
export async function etbDruck(code: string): Promise<EtbDruck | null> {
	if (!(await tagebuchVorhanden(code))) return null;
	return { code, zustand: reduziere(await ereignisseNach(code, 0)) };
}

/** Tagebücher, die einem Einsatzbericht zugeordnet sind, für den Druck */
export async function etbDruckFuerBericht(berichtId: number): Promise<EtbDruck[]> {
	const liste = await db.select({ id: etbTagebuecher.id }).from(etbTagebuecher).where(eq(etbTagebuecher.berichtId, berichtId)).orderBy(asc(etbTagebuecher.erstellt));
	if (!liste.length) return [];
	const rows = await db
		.select()
		.from(etbEreignisse)
		.where(inArray(etbEreignisse.tagebuch, liste.map((t) => t.id)))
		.orderBy(asc(etbEreignisse.seq));
	return liste.map((t) => ({
		code: t.id,
		zustand: reduziere(rows.filter((r) => r.tagebuch === t.id).map((r) => alsEreignis({ ...r, von: null })))
	}));
}

/** Für die Abschnitt-Liste im Berichtsformular */
export async function etbFuerBericht(berichtId: number) {
	return db.select().from(etbTagebuecher).where(eq(etbTagebuecher.berichtId, berichtId)).orderBy(asc(etbTagebuecher.erstellt));
}
