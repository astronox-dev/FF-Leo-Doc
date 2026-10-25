/*
 * Atemschutzüberwachung als Ereignisliste: jede Aktion (z. B. „Einsatz beginnt“ für Tank 1)
 * ist ein Ereignis mit Zeitstempel. Der angezeigte Zustand wird daraus berechnet –
 * im Browser für die Tafel, am Server für das Protokoll im Einsatzbericht.
 */

export const MIN = 60000;
export const STATUS_TEXT = { bereit: 'Einsatzbereit', einsatz: 'Im Einsatz', zurueck: 'Zurück', nichtbereit: 'Nicht einsatzbereit' } as const;
export type Status = keyof typeof STATUS_TEXT;

export const TYPEN = [
	'einsatz_angelegt', 'einsatz_geaendert', 'einsatz_abgeschlossen', 'einsatz_wiedereroeffnet', 'einstellungen', 'bericht_zugeordnet',
	'trupp_angelegt', 'trupp_geaendert', 'trupp_geloescht',
	'einsatz_beginnt', 'zurueck', 'nicht_bereit', 'wieder_bereit', 'notfall', 'alarm_aus'
] as const;
export type EreignisTyp = (typeof TYPEN)[number];

export type Ereignis = { id: string; t: number; typ: EreignisTyp; daten: Record<string, unknown>; geraet?: string; seq?: number; von?: string };

export type Trupp = {
	id: string;
	name: string;
	flasche: 200 | 300;
	status: Status;
	start: number | null;
	ende: number | null;
	notfall: boolean;
	zeitQuittiert: boolean;
	nichtbereitAt: number | null;
	verlauf: { start: number; ende: number }[];
};

export type EinsatzKopf = { datum: string; adresse: string; stufe: string; ueberwacher: string; beginn: number };
export type LogEintrag = { t: number; trupp: string; text: string; art: 'info' | 'alarm' };

export type Zustand = {
	einsatz: EinsatzKopf | null;
	einstellungen: { zeitGrenze: number; vorwarnung: number };
	trupps: Trupp[];
	log: LogEintrag[];
	abgeschlossen: boolean;
	bericht: { id: number; titel: string } | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
export function dauer(ms: number): string {
	const s = Math.floor(Math.max(0, ms) / 1000);
	const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
	return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
}
export function uhr(ts: number, sek = false): string {
	const d = new Date(ts);
	return `${pad(d.getHours())}:${pad(d.getMinutes())}` + (sek ? `:${pad(d.getSeconds())}` : '');
}
export const datumAusIso = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '');
export const einsatzText = (e: Pick<EinsatzKopf, 'datum' | 'adresse' | 'stufe'>) => [datumAusIso(e.datum), e.adresse, e.stufe].filter(Boolean).join(', ');
/** Trupps haben immer 3 Atemschutzträger, unterschieden wird nur die Flaschengröße */
export const ausruestung = (t: Pick<Trupp, 'flasche'>) => `3 Atemschutzträger, Flaschen ${t.flasche} bar`;
export const codeAnzeigen = (id: string) => `${id.slice(0, 3)}-${id.slice(3)}`;

const neuerTrupp = (d: { id: string; name: string; flasche?: number }): Trupp => ({
	id: d.id,
	name: d.name,
	flasche: d.flasche === 200 ? 200 : 300,
	status: 'bereit',
	start: null,
	ende: null,
	notfall: false,
	zeitQuittiert: false,
	nichtbereitAt: null,
	verlauf: []
});

export function leererZustand(standard = { zeitGrenze: 30, vorwarnung: 5 }): Zustand {
	return { einsatz: null, einstellungen: { ...standard }, trupps: [], log: [], abgeschlossen: false, bericht: null };
}

export function reduziere(ereignisse: Ereignis[], standard?: { zeitGrenze: number; vorwarnung: number }): Zustand {
	const z = leererZustand(standard);
	const sortiert = [...ereignisse].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
	for (const e of sortiert) anwenden(z, e);
	return z;
}

function zurueckEintragen(t: Trupp, zeit: number) {
	Object.assign(t, { status: 'zurueck', ende: zeit, notfall: false });
	t.verlauf.push({ start: t.start!, ende: zeit });
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function anwenden(z: Zustand, e: Ereignis) {
	const d = e.daten ?? {};
	const id = str(d.id);
	const t = id ? z.trupps.find((x) => x.id === id) : undefined;
	const log = (text: string, art: LogEintrag['art'] = 'info', trupp: Trupp | null | undefined = t) =>
		z.log.push({ t: e.t, trupp: trupp?.name ?? '', text, art });
	if (e.typ !== 'einsatz_angelegt' && !z.einsatz) return;

	switch (e.typ) {
		case 'einsatz_angelegt': {
			if (z.einsatz) return;
			z.einsatz = { datum: str(d.datum), adresse: str(d.adresse), stufe: str(d.stufe), ueberwacher: '', beginn: e.t };
			if (typeof d.zeitGrenze === 'number') z.einstellungen.zeitGrenze = d.zeitGrenze;
			if (typeof d.vorwarnung === 'number') z.einstellungen.vorwarnung = d.vorwarnung;
			for (const tr of (Array.isArray(d.trupps) ? d.trupps : []) as { id: string; name: string; flasche?: number }[]) z.trupps.push(neuerTrupp(tr));
			log(`Einsatz angelegt: ${einsatzText(z.einsatz)}`, 'info', null);
			break;
		}
		case 'einsatz_geaendert': {
			const geaendert: string[] = [];
			for (const [k, name] of [['datum', 'Datum'], ['adresse', 'Adresse'], ['stufe', 'Einsatzstufe'], ['ueberwacher', 'Atemschutzüberwacher']] as const) {
				if (typeof d[k] === 'string') {
					z.einsatz![k] = d[k] as string;
					geaendert.push(`${name}: ${k === 'datum' ? datumAusIso(d[k] as string) : (d[k] as string) || 'keine Angabe'}`);
				}
			}
			log(geaendert.join(', '), 'info', null);
			break;
		}
		case 'einstellungen':
			if (typeof d.zeitGrenze === 'number') z.einstellungen.zeitGrenze = d.zeitGrenze;
			if (typeof d.vorwarnung === 'number') z.einstellungen.vorwarnung = d.vorwarnung;
			log(`Alarm nach ${z.einstellungen.zeitGrenze} min, Vorwarnung ${z.einstellungen.vorwarnung} min vorher`, 'info', null);
			break;
		case 'bericht_zugeordnet':
			z.bericht = typeof d.berichtId === 'number' ? { id: d.berichtId, titel: str(d.titel) } : null;
			log(z.bericht ? `Einsatzbericht zugeordnet: ${z.bericht.titel}` : 'Zuordnung zum Einsatzbericht aufgehoben', 'info', null);
			break;
		case 'einsatz_abgeschlossen':
			for (const tr of z.trupps) {
				if (tr.status === 'einsatz') {
					log(`Zurück nach ${dauer(e.t - tr.start!)} (beim Abschluss)`, 'info', tr);
					zurueckEintragen(tr, e.t);
				}
			}
			z.abgeschlossen = true;
			log('Atemschutzüberwachung abgeschlossen', 'info', null);
			break;
		case 'einsatz_wiedereroeffnet':
			z.abgeschlossen = false;
			log('Atemschutzüberwachung wieder geöffnet', 'info', null);
			break;
		case 'trupp_angelegt': {
			if (t || !id) return;
			const neu = neuerTrupp({ id, name: str(d.name), flasche: d.flasche as number });
			z.trupps.push(neu);
			log(`Angelegt: ${ausruestung(neu)}`, 'info', neu);
			break;
		}
		case 'trupp_geaendert':
			if (!t) return;
			if (str(d.name)) t.name = str(d.name);
			if (d.flasche) t.flasche = d.flasche === 200 ? 200 : 300;
			if (typeof d.start === 'number' && t.status === 'einsatz') {
				t.start = d.start;
				log(`Einsatzbeginn korrigiert auf ${uhr(d.start, true)} Uhr`);
			}
			log(`Daten geändert (${ausruestung(t)})`);
			break;
		case 'trupp_geloescht':
			if (!t) return;
			z.trupps = z.trupps.filter((x) => x !== t);
			log('Trupp gelöscht');
			break;
		case 'einsatz_beginnt':
			if (t?.status !== 'bereit') return;
			Object.assign(t, { status: 'einsatz', start: e.t, ende: null, notfall: false, zeitQuittiert: false });
			log(`Einsatzbeginn (${ausruestung(t)})`);
			break;
		case 'zurueck':
			if (t?.status !== 'einsatz') return;
			log(`Zurück nach ${dauer(e.t - t.start!)} unter Atemschutz`);
			zurueckEintragen(t, e.t);
			break;
		case 'nicht_bereit':
			if (!t || !['bereit', 'zurueck'].includes(t.status)) return;
			Object.assign(t, { status: 'nichtbereit', nichtbereitAt: e.t });
			log('Nicht einsatzbereit');
			break;
		case 'wieder_bereit':
			if (!t || !['zurueck', 'nichtbereit'].includes(t.status)) return;
			Object.assign(t, { status: 'bereit', start: null, ende: null, notfall: false, zeitQuittiert: false, nichtbereitAt: null });
			log(`Wieder einsatzbereit, neue Flaschen ${t.flasche} bar`);
			break;
		case 'notfall':
			if (!t) return;
			t.notfall = !!d.an;
			log(t.notfall ? 'NOTFALL ausgelöst' : 'Notfall aufgehoben', 'alarm');
			break;
		case 'alarm_aus':
			if (!t) return;
			t.zeitQuittiert = true;
			log('Zeitalarm ausgeschaltet');
			break;
	}
}

/** Alle beendeten Atemschutzeinsätze, ein Trupp kann mehrere haben */
export function abgeschlosseneEinsaetze(z: Zustand) {
	return z.trupps.flatMap((t) => t.verlauf.map((v) => ({ ...v, trupp: t }))).sort((a, b) => a.start - b.start);
}

/** Protokoll inklusive „30 min erreicht“, das sich aus den Zeiten ergibt */
export function protokollEintraege(z: Zustand, now = Date.now()): LogEintrag[] {
	const g = z.einstellungen.zeitGrenze;
	const extra: LogEintrag[] = [];
	for (const t of z.trupps) {
		const zeiten = [...t.verlauf, ...(t.status === 'einsatz' && t.start ? [{ start: t.start, ende: null as number | null }] : [])];
		for (const p of zeiten) {
			if ((p.ende ?? now) - p.start >= g * MIN) extra.push({ t: p.start + g * MIN, trupp: t.name, text: `${g} min unter Atemschutz erreicht`, art: 'alarm' });
		}
	}
	return [...z.log, ...extra].sort((a, b) => a.t - b.t);
}

/* ---------------------------------------------------------------- Zeitgrenze je Trupp */

export function analyse(t: Trupp, z: Zustand, now: number, stummBis = 0) {
	const laufend = t.status === 'einsatz';
	const zeit = t.start ? (t.ende ?? now) - t.start : 0;
	const { zeitGrenze: grenze, vorwarnung } = z.einstellungen;
	const bisGrenze = grenze * MIN - zeit;
	let stufe: 'ok' | 'bald' | 'ueber' = 'ok';
	if (laufend && bisGrenze <= 0) stufe = 'ueber';
	else if (laufend && bisGrenze <= vorwarnung * MIN) stufe = 'bald';
	let alarm: 'notfall' | 'zeit' | null = null;
	if (t.notfall) alarm = 'notfall';
	else if (stufe === 'ueber' && !t.zeitQuittiert) alarm = 'zeit';
	if (z.abgeschlossen) alarm = null;
	const klingelt = !!alarm && !(stummBis > now);
	return { laufend, zeit, grenze, bisGrenze, stufe, alarm, klingelt };
}
