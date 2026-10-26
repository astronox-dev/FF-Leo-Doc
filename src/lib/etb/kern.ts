/*
 * Einsatztagebuch als Ereignisliste, wie die Atemschutzüberwachung: jede Aktion (Eintrag,
 * Korrektur, Streichung, Kontrolle) ist ein Ereignis. Der angezeigte Stand wird daraus berechnet,
 * im Browser für die Liste, am Server für den Druck.
 *
 * Laufende Nummern richten sich nach der Reihenfolge, in der Einträge beim Server ankommen, damit
 * sie auf allen Geräten gleich sind. Einträge, die noch auf dem Weg sind, stehen vorläufig am Ende.
 */

export const TYPEN = [
	'tagebuch_angelegt', 'tagebuch_geaendert', 'tagebuch_abgeschlossen', 'tagebuch_wiedereroeffnet', 'bericht_zugeordnet',
	'eintrag', 'eintrag_geaendert', 'eintrag_gestrichen', 'kontrolle'
] as const;
export type EreignisTyp = (typeof TYPEN)[number];
export type Ereignis = { id: string; t: number; typ: EreignisTyp; daten: Record<string, unknown>; geraet?: string; seq?: number; von?: string };

export type Kopf = { datum: string; einsatzort: string; feuerwehr: string; bearbeiter: string; beginn: number };

export type Eintrag = {
	eid: string;
	/** laufende Nummer; vorläufig, solange der Eintrag noch nicht beim Server ist */
	nr: number;
	vorlaeufig: boolean;
	uhrzeit: string;
	an: string;
	von: string;
	inhalt: string;
	/** Eintrag ist ein Auftrag, der später erledigt gemeldet wird */
	auftrag: boolean;
	/** Bezug auf einen Auftrag (dessen eid) */
	auftragUnter: string | null;
	/** Nummer des Eintrags, der diesen Auftrag erledigt */
	erledigungUnter: number | null;
	gestrichen: boolean;
	/** Name derer, die den Eintrag kontrolliert haben */
	kontrolle: string;
	geaendert: boolean;
};

export type Zustand = {
	kopf: Kopf | null;
	eintraege: Eintrag[];
	abgeschlossen: boolean;
	bericht: { id: number; titel: string } | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
export const uhrzeitJetzt = (ts = Date.now()) => {
	const d = new Date(ts);
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const kuerzel = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w[0]!.toUpperCase())
		.join('')
		.slice(0, 3);

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const FELDER = ['uhrzeit', 'an', 'von', 'inhalt'] as const;

export function reduziere(ereignisse: Ereignis[]): Zustand {
	const z: Zustand = { kopf: null, eintraege: [], abgeschlossen: false, bericht: null };
	// Reihenfolge des Servers; was noch fehlt, nach Zeit dahinter
	const sortiert = [...ereignisse].sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || a.t - b.t || (a.id < b.id ? -1 : 1));
	const nachId = new Map<string, Eintrag>();

	for (const e of sortiert) {
		const d = e.daten ?? {};
		if (e.typ !== 'tagebuch_angelegt' && !z.kopf) continue;
		switch (e.typ) {
			case 'tagebuch_angelegt':
				if (z.kopf) break;
				z.kopf = { datum: str(d.datum, 10), einsatzort: str(d.einsatzort, 200), feuerwehr: str(d.feuerwehr, 100), bearbeiter: str(d.bearbeiter, 100), beginn: e.t };
				break;
			case 'tagebuch_geaendert':
				if (z.abgeschlossen) break;
				for (const k of ['datum', 'einsatzort', 'feuerwehr', 'bearbeiter'] as const) if (typeof d[k] === 'string') z.kopf![k] = str(d[k], 200);
				break;
			case 'tagebuch_abgeschlossen':
				z.abgeschlossen = true;
				break;
			case 'tagebuch_wiedereroeffnet':
				z.abgeschlossen = false;
				break;
			case 'bericht_zugeordnet':
				z.bericht = typeof d.berichtId === 'number' ? { id: d.berichtId, titel: str(d.titel, 200) } : null;
				break;
			case 'eintrag': {
				const eid = str(d.eid, 40);
				if (!eid || nachId.has(eid) || z.abgeschlossen) break;
				const x: Eintrag = {
					eid,
					nr: z.eintraege.length + 1,
					vorlaeufig: e.seq == null,
					uhrzeit: str(d.uhrzeit, 5),
					an: str(d.an, 100),
					von: str(d.von, 100),
					inhalt: str(d.inhalt),
					auftrag: d.auftrag === true,
					auftragUnter: str(d.auftragUnter, 40) || null,
					erledigungUnter: null,
					gestrichen: false,
					kontrolle: '',
					geaendert: false
				};
				z.eintraege.push(x);
				nachId.set(eid, x);
				break;
			}
			case 'eintrag_geaendert': {
				const x = nachId.get(str(d.eid, 40));
				if (!x || z.abgeschlossen) break;
				for (const k of FELDER) if (typeof d[k] === 'string') x[k] = str(d[k], k === 'inhalt' ? 2000 : k === 'uhrzeit' ? 5 : 100);
				if (typeof d.auftrag === 'boolean') x.auftrag = d.auftrag;
				if ('auftragUnter' in d) x.auftragUnter = str(d.auftragUnter, 40) || null;
				x.geaendert = true;
				break;
			}
			case 'eintrag_gestrichen': {
				const x = nachId.get(str(d.eid, 40));
				if (x && !z.abgeschlossen) x.gestrichen = d.gestrichen !== false;
				break;
			}
			case 'kontrolle': {
				const x = nachId.get(str(d.eid, 40));
				if (x) x.kontrolle = d.an === false ? '' : str(d.name, 100) || e.von || '✓';
				break;
			}
		}
	}

	// Erledigung unter: der erste gültige Eintrag, der sich auf den Auftrag bezieht
	for (const x of z.eintraege) {
		if (x.gestrichen || !x.auftragUnter) continue;
		const auftrag = nachId.get(x.auftragUnter);
		if (auftrag && auftrag.erledigungUnter == null && auftrag.nr < x.nr) auftrag.erledigungUnter = x.nr;
	}
	return z;
}

/** Aufträge, deren Erledigung noch nicht gemeldet ist */
export const offeneAuftraege = (z: Zustand) => z.eintraege.filter((x) => x.auftrag && !x.gestrichen && x.erledigungUnter == null);

/** Nummer eines Eintrags über seine eid (für „Auftrag unter“) */
export function nummerVon(z: Zustand, eid: string | null): number | null {
	if (!eid) return null;
	return z.eintraege.find((x) => x.eid === eid)?.nr ?? null;
}
