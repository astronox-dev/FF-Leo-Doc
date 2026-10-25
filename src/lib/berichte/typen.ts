/*
 * Die vier Aufnahmeblätter der FF Leopoldsdorf (Stand April 2026) als Daten.
 * Formular, Druckansicht und Server lesen alle aus dieser Datei.
 * Ankreuzfelder sind immer Mehrfachauswahl (Wunsch der Feuerwehr).
 */

export type BerichtTyp = 'brand' | 'technik' | 'schadstoff' | 'tus';

export const TYPEN: Record<BerichtTyp, { titel: string; kurz: string; farbe: string; text: string; skizze: boolean }> = {
	brand: { titel: 'Brandeinsätze', kurz: 'Brandeinsatz', farbe: '#ff5d5d', text: '#1d2b3a', skizze: true },
	technik: { titel: 'technische Einsätze', kurz: 'Technischer Einsatz', farbe: '#8ea9db', text: '#1d2b3a', skizze: true },
	schadstoff: { titel: 'Schadstoffeinsätze', kurz: 'Schadstoffeinsatz', farbe: '#a9d08e', text: '#1d2b3a', skizze: true },
	tus: { titel: 'TUS-Brandeinsätze', kurz: 'TUS-Einsatz', farbe: '#ffffff', text: '#1d2b3a', skizze: false }
};
export const TYP_REIHENFOLGE: BerichtTyp[] = ['brand', 'technik', 'schadstoff', 'tus'];

/** Eine Zelle im Druckraster: Wert und wie viele der 6 Spalten sie belegt */
export type Zelle = [string, number] | null;

/* ---------------------------------------------------------------- Kopfteil (alle Typen) */

export const ALARMIERUNG_DURCH = (typ: BerichtTyp): Zelle[][] => [
	[['Blaulicht SMS', 2], ['Handy', 1], ['Sirene', 1], ['Telefon', 1], ['Funkmeldeempfänger', 1]],
	[['Persönlich', 2], ['Sirenenfernsteuerung', 2], typ === 'brand' ? ['TUS', 2] : null]
];
export const MELDUNG_DURCH: Zelle[][] = [[['BAZ', 1], ['Feuerwehr', 1], ['Gemeinde', 1], ['Polizei', 1], ['BMA', 1], ['Privatperson', 1]]];
export const ANWESEND: Zelle[][] = [
	[['BH', 1], ['Polizei', 1], ['Rettung', 1], ['Gemeinde', 1], ['BFKDT', 1], ['AFKDT', 1]],
	[['EVU', 1], ['Straßenverwaltung', 2], ['Bezirkshauptmannschaft', 2], ['Wasserwerk', 1]]
];
export const WETTER: Zelle[][] = [
	[['Sonne', 1], ['Regen', 1], ['Hagel', 1], ['Wind/Sturm', 1], ['Bedeckt', 1], ['Nebel', 1]],
	[['Schnee', 1], ['Glätte', 1], ['Glatteis', 1]]
];
export const EIGENES_GEBIET = ['Ja', 'Nein'];

/** Geschädigte beim TUS-Blatt: Objekte mit Brandmeldeanlage im Einsatzgebiet */
export const TUS_OBJEKTE: Zelle[][] = [
	[['Billa Plus', 1], ['ZVG', 1], ['SWK', 1], ['B+M Newtec', 1], ['Hilti BMA', 1], ['Hilti Sprinklanl.', 1]],
	[['MAN', 1], ['DPD Arbeiterg. 46', 1], ['Gebr.Weiss Arbeiterg. 50', 1], ['Englmayer', 1], ['Nemetz BMA', 1], ['Nemetz Löschanlage', 1]],
	[['Lutz', 1], ['Aura Achauerstr.', 1], ['Aura M.Lanzend.str.', 1], ['Ousko Oberhoffer', 1], ['Kwizda BMA', 1], ['Kwizda Sprinklanl.', 1]],
	[['TIP Trailer', 1], ['Röhsler', 1], ['Schule', 1], ['Schloss', 1], ['GW-Cosmetics', 2]]
];

/* ---------------------------------------------------------------- Geräte */

export const SONDERGERAETE: Record<BerichtTyp, Zelle[][]> = {
	brand: [
		[['Wärmebildkamera', 1], ['Tragbare Leiter', 1], ['Hebekissen', 1], ['Rettungsplattform', 1]],
		[['Stromerzeuger', 1], ['Trennschleifer', 1]]
	],
	technik: [
		[['Hyd. Rettungssatz', 1], ['Motorboot', 1], ['Hebekissen', 1], ['Rettungsplattform', 1]],
		[['Stromerzeuger', 1], ['Motorkettensäge', 1], ['Tragbare Leiter', 1], ['Trennschleifer', 1]],
		[['UWP', 1], ['Seilwinde', 1]]
	],
	schadstoff: [
		[['Wärmebildkamera', 1], ['Mehrgasmessgerät', 1], ['Chem. Schutzhandschuhe', 2]],
		[['Auffangwannen', 1], ['Kanalabdeckung', 1], ['Chem. Schutzanzug', 2]],
		[['Abdichtmaterialien', 1], ['Ölsperre', 1]]
	],
	tus: []
};
/** Nur beim Brandeinsatz, steht in der Zeile der Sondergeräte */
export const SCHUTZSTUFE = ['1', '2', '3'];

export const LOESCHWASSER = ['Hydrant', 'TLF / HLF', 'Wasserbeh.', 'nat. Gewässer'];

/* ---------------------------------------------------------------- Tätigkeit */

export const TAETIGKEIT: Record<BerichtTyp, string[]> = {
	brand: ['Erkunden der Einsatzstelle durch den EL', 'Absichern der Einsatzstelle', 'Beleuchten der Einsatzstelle'],
	technik: [
		'Erkunden der Einsatzstelle durch den EL',
		'Absichern der Einsatzstelle',
		'Binden / Auffangen von ausgelaufenen Betriebsflüssigkeiten',
		'Strom erzeugen',
		'Beleuchten der Einsatzstelle',
		'Batterie abklemmen',
		'Freimachen von Verkehrswegen',
		'Autoschlüssel an Polizei übergeben',
		'Fahrzeug auf der von Polizei def. Stelle abgestellt'
	],
	schadstoff: ['Erkunden der Einsatzstelle durch den EL', 'Absichern der Einsatzstelle'],
	tus: ['Keine Gefahr feststellbar', 'Brandalarm', 'Fehlalarm', 'Täuschungsalarm', 'BSB verständigt', 'BSB vor Ort']
};
/** Technischer Einsatz: Brandschutz */
export const BRANDSCHUTZ = ['1x', '2x', '3x', 'keiner'];
/** Technischer Einsatz: Tätigkeiten WLF-K */
export const WLFK = ['Kran', 'Mulde', 'Winde', 'Greifer', 'Korb'];
/** Schadstoffeinsatz */
export const GEFAHRENKLASSE: Zelle[][] = [
	[['Sprengstoff', 1], ['Gase', 1], ['brennbare Flüssigkeiten', 2], ['ätzende Stoffe', 2]],
	[['brennbare feste Stoffe', 2], ['brandfördernde Stoffe', 2], ['Gifte', 2]],
	[['radioaktives Material', 2], ['sonstige gefährliche Stoffe', 4]]
];
export const STRAHLROHRE = ['1 Rohr / klein', '2 Rohre / mittel', '3 Rohre / groß'];

/* ---------------------------------------------------------------- Fahrzeuge */

/** Gefahrene Kilometer je Fahrzeug */
export const KM_FAHRZEUGE = [
	{ key: 'hlf3', name: 'HLF-3', funk: 'Tank 1' },
	{ key: 'hlf2', name: 'HLF-2', funk: 'Tank 2' },
	{ key: 'hlf1', name: 'HLF-1', funk: 'Pumpe' },
	{ key: 'vf', name: 'VF', funk: 'Last' },
	{ key: 'kdo1', name: 'Kommando 1', funk: 'KDO 1' },
	{ key: 'kdo2', name: 'Kommando 2', funk: 'KDO 2' },
	{ key: 'mtf', name: 'MTF', funk: 'BUS' },
	{ key: 'wlfk', name: 'WLF-K', funk: 'Kran' },
	{ key: 'boot', name: 'Boot', funk: '' }
] as const;
export const KM_ZUSATZ = ['WLA-Bergung', 'WLA-Mulde (leer)', 'Abschleppachse'];

/** Fahrzeuge für die Teilnahmeliste (Fußnote 1 des Aufnahmeblatts) */
export const TEILNAHME_FAHRZEUGE = [
	{ wert: 'Tank1', text: 'HLF-3 / Tank 1' },
	{ wert: 'Tank2', text: 'HLF-2 / TLF2000 / Tank 2' },
	{ wert: 'Pumpe', text: 'HLF-1 / Pumpe' },
	{ wert: 'Last', text: 'VF / Last' },
	{ wert: 'KDO', text: 'KDO' },
	{ wert: 'Bus', text: 'MTF / Bus' },
	{ wert: 'Kran', text: 'WLF-K / Kran' },
	{ wert: 'Achse', text: 'Abschleppachse' }
];

/* ---------------------------------------------------------------- Datenmodell */

export type MitgliedKurz = { stbnr: number; nachname: string; vorname: string; gruppe: 'aktiv' | 'reserve' };
export type Zeitpunkt = { datum: string; zeit: string };
export type Geschaedigter = {
	name: string;
	anschrift: string;
	kennzeichen: string;
	marke: string;
	fahrer: string;
	gebDatum: string;
	fahrerAnschrift: string;
};
export type FremdeFF = { an: boolean; ms: string; d: string };
export type Teilnahme = { anw: boolean; fahrzeug: string; ma: boolean; ats: boolean };
export type Unterschrift = { stbnr: number | null; name: string; bild: string; zeit: number | null };

export type BerichtDaten = {
	alarmierung: Zeitpunkt;
	ausfahrt: Zeitpunkt;
	alarmierungDurch: string[];
	tusText: string;
	meldungDurch: string[];
	anwesend: string[];
	wetter: string[];
	einsatzort: string;
	eigenesGebiet: string[];
	anzGeschaedigte: string;
	geschaedigte: Geschaedigter[];
	tusObjekte: string[];
	geraete: string;
	wbk: boolean;
	sondergeraete: string[];
	schutzstufe: string[];
	auffangwannenLiter: string;
	fremdeFF: { mariaLanzendorf: FremdeFF; lanzendorf: FremdeFF; text: string };
	verletzte: string;
	verbrauch: { schaummittel: boolean; schaummittelMenge: string; oelbindemittel: boolean; oelbindemittelMenge: string; text: string };
	loeschwasser: string[];
	situation: string;
	melder: [string, string];
	taetigkeitChecks: string[];
	brandschutz: string[];
	taetigkeit: string;
	wlfk: string[];
	wlfkText: string;
	gefahrenklasse: string[];
	brandwache: { datum: string; von: string; bis: string };
	strahlrohre: string[];
	brandAus: Zeitpunkt;
	rueckkehr: Zeitpunkt;
	km: Record<string, string>;
	kmZusatz: string[];
	maengel: string;
	teilnahme: Record<string, Teilnahme>;
	skizze: Skizze | null;
	unterschriften: { ausfuellender: Unterschrift; einsatzleiter: Unterschrift };
};

/* ---------------------------------------------------------------- Skizze */

/** Koordinaten der Skizze in Einheiten von 0 bis SKIZZE_B × 0 bis SKIZZE_H */
export const SKIZZE_B = 1000;
export const SKIZZE_H = 1380;

export type SkizzenKarte = {
	/** Ausschnitt in WGS84 */
	bbox: [number, number, number, number];
	/** Nachgezeichnete Linien: Gebäude, Straßen, Gewässer, Bahn */
	linien: { art: 'gebaeude' | 'strasse' | 'weg' | 'wasser' | 'bahn'; punkte: number[]; zu: boolean; breite?: number; name?: string }[];
	/** Straßennamen mit Position und Winkel */
	namen: { text: string; x: number; y: number; winkel: number }[];
	/** Drehung des Rahmens im Uhrzeigersinn in Grad (0 = Norden oben) */
	drehung?: number;
	/** Kartenansicht beim Übernehmen, um den Dialog wieder dort zu öffnen */
	ansicht?: { lat: number; lon: number; zoom: number; drehung: number };
};
export type SkizzenElement =
	| {
			id: string;
			art: 'symbol';
			symbol: string;
			x: number;
			y: number;
			winkel: number;
			groesse: number;
			/** Beschriftungen je Feld des Zeichens (Funkrufname, Wasser, Strahlrohrgröße …) */
			felder?: Record<string, string>;
			/** Stellung des Auslegers (Kran, Leiter) in Grad, relativ zum Fahrzeug */
			ausleger?: number;
			/** älterer Stand: Beschriftung der Windrichtung */
			text?: string;
			auto?: boolean;
	  }
	| { id: string; art: 'text'; x: number; y: number; winkel: number; groesse: number; text: string; farbe: string }
	| { id: string; art: 'linie'; punkte: number[]; farbe: string; breite: number }
	/** Schlauchleitung zwischen zwei Punkten, dazwischen beliebig viele Knickpunkte */
	| { id: string; art: 'schlauch'; punkte: number[]; groesse?: string };
export type Skizze = { karte: SkizzenKarte | null; elemente: SkizzenElement[] };

const zp = (): Zeitpunkt => ({ datum: '', zeit: '' });
export const leererGeschaedigter = (): Geschaedigter => ({ name: '', anschrift: '', kennzeichen: '', marke: '', fahrer: '', gebDatum: '', fahrerAnschrift: '' });
const leereUnterschrift = (): Unterschrift => ({ stbnr: null, name: '', bild: '', zeit: null });

export function leereDaten(): BerichtDaten {
	return {
		alarmierung: zp(),
		ausfahrt: zp(),
		alarmierungDurch: [],
		tusText: '',
		meldungDurch: [],
		anwesend: [],
		wetter: [],
		einsatzort: '',
		eigenesGebiet: [],
		anzGeschaedigte: '',
		geschaedigte: [leererGeschaedigter()],
		tusObjekte: [],
		geraete: '',
		wbk: false,
		sondergeraete: [],
		schutzstufe: [],
		auffangwannenLiter: '',
		fremdeFF: { mariaLanzendorf: { an: false, ms: '', d: '' }, lanzendorf: { an: false, ms: '', d: '' }, text: '' },
		verletzte: '',
		verbrauch: { schaummittel: false, schaummittelMenge: '', oelbindemittel: false, oelbindemittelMenge: '', text: '' },
		loeschwasser: [],
		situation: '',
		melder: ['', ''],
		taetigkeitChecks: [],
		brandschutz: [],
		taetigkeit: '',
		wlfk: [],
		wlfkText: '',
		gefahrenklasse: [],
		brandwache: { datum: '', von: '', bis: '' },
		strahlrohre: [],
		brandAus: zp(),
		rueckkehr: zp(),
		km: {},
		kmZusatz: [],
		maengel: '',
		teilnahme: {},
		skizze: null,
		unterschriften: { ausfuellender: leereUnterschrift(), einsatzleiter: leereUnterschrift() }
	};
}

/** Gespeicherte Daten mit allen Feldern auffüllen (ältere Stände, Teildaten) */
export function vollstaendig(roh: unknown): BerichtDaten {
	const basis = leereDaten();
	if (!roh || typeof roh !== 'object') return basis;
	const r = roh as Partial<BerichtDaten>;
	const out = { ...basis, ...r } as BerichtDaten;
	for (const key of ['alarmierung', 'ausfahrt', 'brandwache', 'brandAus', 'rueckkehr', 'verbrauch'] as const) {
		// @ts-expect-error gleiche Form wie die Vorgabe
		out[key] = { ...basis[key], ...(r[key] ?? {}) };
	}
	out.fremdeFF = {
		mariaLanzendorf: { ...basis.fremdeFF.mariaLanzendorf, ...(r.fremdeFF?.mariaLanzendorf ?? {}) },
		lanzendorf: { ...basis.fremdeFF.lanzendorf, ...(r.fremdeFF?.lanzendorf ?? {}) },
		text: r.fremdeFF?.text ?? ''
	};
	out.unterschriften = {
		ausfuellender: { ...basis.unterschriften.ausfuellender, ...(r.unterschriften?.ausfuellender ?? {}) },
		einsatzleiter: { ...basis.unterschriften.einsatzleiter, ...(r.unterschriften?.einsatzleiter ?? {}) }
	};
	// Ältere Stände hatten den Namen zusätzlich in einem eigenen Feld
	const alt = roh as Record<string, unknown>;
	for (const key of ['ausfuellender', 'einsatzleiter'] as const) {
		const name = alt[key];
		if (typeof name === 'string' && name && !out.unterschriften[key].name) out.unterschriften[key].name = name;
		delete (out as Record<string, unknown>)[key];
	}
	if (!Array.isArray(out.geschaedigte) || out.geschaedigte.length === 0) out.geschaedigte = [leererGeschaedigter()];
	if (!Array.isArray(out.melder)) out.melder = ['', ''];
	return out;
}

/** Kurzer Titel für Listen: Einsatzort und Datum */
export function berichtTitel(typ: BerichtTyp, d: Pick<BerichtDaten, 'einsatzort' | 'alarmierung'>): string {
	return d.einsatzort.trim() || `${TYPEN[typ].kurz} ohne Einsatzort`;
}
