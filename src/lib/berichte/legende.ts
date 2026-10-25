import type { BerichtTyp } from './typen';

/*
 * Taktische Zeichen nach ÖBFV RL E-27 (Auszug Steiermark). Was in der Richtlinie blau ist,
 * zeichnet die FF Leopoldsdorf schwarz.
 *
 * Jedes Zeichen hat ein eigenes Feld von b × h Zeichen-Einheiten und wird mit dem Mittelpunkt gesetzt.
 * In der Skizze ist eine Zeichen-Einheit MASS Skizzen-Einheiten groß.
 * Die Markup-Strings sind fest im Code. Beschriftungen von Benutzern maskiert zeichnen() beim Einsetzen.
 */

const S = '#1a1a1a';
const R = '#e10600';

/** Skizzen-Einheiten je Zeichen-Einheit */
export const MASS = 1.25;

const st = (farbe = S, breite = 1.8) =>
	`fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-linecap="round" stroke-linejoin="round"`;
const pfad = (d: string, farbe = S, breite = 1.8) => `<path d="${d}" ${st(farbe, breite)}/>`;
const linie = (x1: number, y1: number, x2: number, y2: number, farbe = S, breite = 1.8) =>
	`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${st(farbe, breite)}/>`;
const kreis = (cx: number, cy: number, r: number, farbe = S, breite = 1.8) => `<circle cx="${cx}" cy="${cy}" r="${r}" ${st(farbe, breite)}/>`;
const punkt = (cx: number, cy: number, r: number, farbe = S) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${farbe}"/>`;
const schrift = (x: number, y: number, text: string, farbe: string, groesse: number) =>
	`<text x="${x}" y="${y}" fill="${farbe}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${groesse}" text-anchor="middle" dominant-baseline="central">${text}</text>`;

export type Gruppe = 'personen' | 'kraefte' | 'fahrzeuge' | 'gefahren' | 'schaeden' | 'geraete' | 'loeschgeraete' | 'loescheinrichtungen' | 'sonstige';

export const GRUPPEN: { id: Gruppe; name: string }[] = [
	{ id: 'personen', name: 'Personen' },
	{ id: 'kraefte', name: 'Kräfte, Führung, Einrichtungen' },
	{ id: 'fahrzeuge', name: 'Fahrzeuge' },
	{ id: 'gefahren', name: 'Gefahren' },
	{ id: 'schaeden', name: 'Schäden' },
	{ id: 'geraete', name: 'Leitern und Geräte' },
	{ id: 'loeschgeraete', name: 'Löschgeräte' },
	{ id: 'loescheinrichtungen', name: 'Löscheinrichtungen' },
	{ id: 'sonstige', name: 'Sonstiges' }
];

/** Beschriftungsfeld eines Zeichens, Lage in Zeichen-Einheiten */
export type Feld = {
	key: string;
	name: string;
	x: number;
	y: number;
	anker?: 'start' | 'middle' | 'end';
	groesse: number;
	/** größte Zeilenbreite; längere Texte werden auf `zeilen` Zeilen umbrochen */
	breite?: number;
	zeilen?: number;
	vorgabe?: string;
	vorschlaege?: string[];
	/** kurze Auswahl als Knöpfe statt Eingabefeld */
	knoepfe?: string[];
	/** Vorschläge sind die Funkrufnamen der eigenen Fahrzeuge */
	funk?: boolean;
	zahl?: boolean;
};

/** Getrennt drehbarer Ausleger (Kran, Leiter), gezeichnet entlang der x-Achse ab dem Drehpunkt */
export type Ausleger = { x: number; y: number; winkel: number; laenge: number; svg: string };

export type SymbolDef = {
	id: string;
	name: string;
	gruppe: Gruppe;
	b: number;
	h: number;
	svg: string;
	felder?: Feld[];
	ausleger?: Ausleger;
	/** Ausschnitt für Vorschaubilder inklusive Ausleger: x, y, Breite, Höhe */
	vb: [number, number, number, number];
};

function zeichen(d: Omit<SymbolDef, 'vb'>): SymbolDef {
	let x0 = 0, y0 = 0, x1 = d.b, y1 = d.h;
	if (d.ausleger) {
		const a = d.ausleger, w = (a.winkel * Math.PI) / 180;
		const tx = a.x + (a.laenge + 8) * Math.cos(w), ty = a.y + (a.laenge + 8) * Math.sin(w);
		x0 = Math.min(x0, tx - 4); x1 = Math.max(x1, tx + 4);
		y0 = Math.min(y0, ty - 4); y1 = Math.max(y1, ty + 4);
	}
	return { ...d, vb: [x0, y0, x1 - x0, y1 - y0] };
}

/* ---------------------------------------------------------------- Personen */

const RAUTE = 'M16 6 L27 17 L16 28 L5 17 Z';
const raute = (farbe: string) => pfad(RAUTE, farbe);
const person = (id: string, name: string, svg: string) => zeichen({ id, name, gruppe: 'personen', b: 32, h: 34, svg });

/* ---------------------------------------------------------------- Fahrzeuge */

const TAKTISCH = ['KDOF', 'HLF 1', 'HLF 2', 'HLF 3', 'HLF 4', 'TLF', 'RLF', 'LFA', 'SRF', 'MTF', 'DLK', 'WLF', 'KRF', 'VF'];
const WASSER = ['1000', '2000', '3000', '4000', '5000', '10000'];

/** Funkrufname links davor, Wasser darüber, taktische Bezeichnung innen (oder darunter) */
function fahrzeugFelder(o: { links: number; mitte: number; oben: number; y: number; innen?: { x: number; breite: number }; unten?: number }, vorgabe?: string): Feld[] {
	const felder: Feld[] = [
		{ key: 'funk', name: 'Funkrufname', x: o.links - 2.5, y: o.y, anker: 'end', groesse: 6.5, breite: 44, zeilen: 2, funk: true },
		{ key: 'wasser', name: 'Wasser in Liter', x: o.mitte, y: o.oben - 4.5, groesse: 6.5, zahl: true, vorschlaege: WASSER }
	];
	if (o.innen) felder.push({ key: 'taktisch', name: 'Taktische Bezeichnung', x: o.innen.x, y: o.y, groesse: 8, breite: o.innen.breite, zeilen: 2, vorgabe, vorschlaege: TAKTISCH });
	else if (o.unten !== undefined) felder.push({ key: 'taktisch', name: 'Taktische Bezeichnung', x: o.mitte, y: o.unten + 5.5, groesse: 7, vorschlaege: TAKTISCH });
	return felder;
}

const FZ = `<rect x="2" y="3" width="56" height="24" ${st()}/>${linie(16, 3, 16, 27)}`;
const FZ_FELDER = (innenX = 37, breite = 38, vorgabe?: string) => fahrzeugFelder({ links: 2, mitte: 30, oben: 3, y: 15, innen: { x: innenX, breite } }, vorgabe);
const fahrzeug = (d: Omit<SymbolDef, 'vb' | 'gruppe' | 'b' | 'h'> & { b?: number; h?: number }) => zeichen({ gruppe: 'fahrzeuge', b: 60, h: 30, ...d });

const keil = (l: number) => `<path d="M0 -2.2 L${l} 0 L0 2.2 Z" ${st(S, 1.4)}/>`;
const leiter = (l: number) => {
	let s = pfad(`M-1 -2.2 H${l} M-1 2.2 H${l}`, S, 1.4);
	for (let x = 3.5; x < l - 1; x += 5) s += linie(x, -2.2, x, 2.2, S, 1.2);
	return s;
};
const korb = (l: number) => `<rect x="${l}" y="-3.2" width="6" height="6.4" ${st(S, 1.4)}/>`;
const werferSpitze = (l: number) => kreis(l + 3, 0, 1.5, S, 1.1) + pfad(`M${l + 4.5} 0 H${l + 11} M${l + 8.6} -2.2 L${l + 11} 0 L${l + 8.6} 2.2`, S, 1.2);

/* ---------------------------------------------------------------- Gefahren und Schäden */

const DREIECK = pfad('M20 2 L38 33 H2 Z', R);
const gefahr = (id: string, name: string, inhalt: string) => zeichen({ id, name, gruppe: 'gefahren', b: 40, h: 36, svg: DREIECK + inhalt });
const QUADRAT = `<rect x="3" y="3" width="26" height="26" ${st(R)}/>`;
const schaden = (id: string, name: string, inhalt: string) => zeichen({ id, name, gruppe: 'schaeden', b: 32, h: 32, svg: QUADRAT + inhalt });
const flammen = (n: number) =>
	Array.from({ length: n }, (_, i) => {
		const x = 16 + (i - (n - 1) / 2) * 6;
		return pfad(`M${x - 2.2} 25 L${x + 2.2} 8 V25 Z`, R, 1.4);
	}).join('');
const kreuze = (n: number) =>
	Array.from({ length: n }, (_, i) => {
		const x = 16 + (i - (n - 1) / 2) * 4.6;
		return pfad(`M${x - 7} 9 L${x + 7} 23 M${x + 7} 9 L${x - 7} 23`, R, 1.4);
	}).join('');
const wellen = (x: number, y: number, b: number, farbe: string) =>
	[0, 5].map((dy) => pfad(`M${x} ${y + dy} C${x + b * 0.17} ${y + dy - 3} ${x + b * 0.33} ${y + dy - 3} ${x + b * 0.5} ${y + dy - 0.5} S${x + b * 0.83} ${y + dy + 2} ${x + b} ${y + dy - 1.5}`, farbe, 1.4)).join('');

/* ---------------------------------------------------------------- Geräte und Löschgeräte */

const RAHMEN = pfad('M2 4 H46 M2 24 H46 M9 4 V24 M39 4 V24');
const geraet = (id: string, name: string, inhalt: string) => zeichen({ id, name, gruppe: 'geraete', b: 48, h: 28, svg: RAHMEN + inhalt });
const loeschgeraet = (id: string, name: string, b: number, h: number, svg: string, felder?: Feld[]) => zeichen({ id, name, gruppe: 'loeschgeraete', b, h, svg, felder });
const PFEIL_LINKS = 'M10 3.5 L3 10 L10 16.5 M3 10';
const einrichtung = (id: string, name: string, b: number, svg: string) => zeichen({ id, name, gruppe: 'loescheinrichtungen', b, h: 32, svg });
const einspeisPfeil = linie(37, 16, 58, 16) + `<path d="M28.5 16 L38 11.5 V20.5 Z" fill="${S}"/>`;

export const SYMBOLE: SymbolDef[] = [
	/* Personen */
	person('person', 'Person (Grundzeichen)', raute(S)),
	person('person-atemschutz', 'Person unter Atem- oder Körperschutz', raute(S) + pfad('M2.5 15.3 L16 1.8 L29.5 15.3')),
	person('person-kommandant', 'Person in Kommandantenfunktion', raute(S) + `<path d="M16 6 L21.5 11.5 H10.5 Z" fill="${S}"/>`),
	person('person-verletzt', 'Person verletzt', raute(R) + linie(16, 6, 16, 28, R)),
	person('person-tot', 'Person tot', raute(R) + linie(16, 6, 16, 28, R) + linie(10, 12, 22, 12, R)),
	person('person-zwangslage', 'Person in Zwangslage (verschüttet, eingeklemmt)', raute(R) + linie(10, 4.8, 22, 4.8, R)),
	person('person-zwangslage-verletzt', 'Person in Zwangslage und verletzt', raute(R) + linie(10, 4.8, 22, 4.8, R) + linie(16, 6, 16, 28, R)),
	person('person-vermisst', 'Person vermisst', raute(R) + pfad('M2 15.8 L14.6 3.2', R) + pfad('M30 18.2 L17.4 30.8', R)),

	/* Kräfte, Führung, Einrichtungen */
	zeichen({ id: 'formation', name: 'Formation von Kräften (Einheit, Verband)', gruppe: 'kraefte', b: 48, h: 28, svg: `<rect x="4" y="4" width="40" height="20" ${st()}/>` }),
	zeichen({ id: 'befehlsstelle', name: 'Befehls-, Führungs- oder Leitstelle', gruppe: 'kraefte', b: 44, h: 36, svg: pfad('M5 34 V3 H39 V18 H5') }),
	zeichen({ id: 'einrichtung-staendig', name: 'Ständige ortsfeste Einrichtung (Dienststelle, Gebäude, Anlage)', gruppe: 'kraefte', b: 48, h: 32, svg: pfad('M4 11 L24 3 L44 11 V29 H4 Z M4 11 H44') }),
	zeichen({ id: 'einrichtung', name: 'vorübergehend anlassbezogene Einrichtung (ASSP, EA)', gruppe: 'kraefte', b: 32, h: 32, svg: kreis(16, 16, 12) }),

	/* Fahrzeuge */
	fahrzeug({ id: 'kfz', name: 'Kraftfahrzeug', svg: FZ, felder: FZ_FELDER() }),
	fahrzeug({ id: 'hlf', name: 'HLF, LF, TLF, RLF', svg: FZ, felder: FZ_FELDER(37, 38, 'HLF') }),
	fahrzeug({
		id: 'fz-ladekran',
		name: 'Fahrzeug mit Ladekran hinter dem Fahrerhaus',
		svg: FZ + pfad('M19.5 3 V27 M16 8.5 H19.5 M16 21.5 H19.5'),
		felder: FZ_FELDER(38.8, 35)
	}),
	fahrzeug({
		id: 'fz-ladekran-aus',
		name: 'Fahrzeug mit ausgefahrenem Ladekran hinter dem Fahrerhaus',
		svg: FZ + linie(19.5, 3, 19.5, 27),
		felder: FZ_FELDER(38.8, 35),
		ausleger: { x: 17.75, y: 8, winkel: -32, laenge: 40, svg: keil(40) }
	}),
	fahrzeug({
		id: 'fz-heckkran-aus',
		name: 'Fahrzeug mit ausgefahrenem Heckkran (z. B. SRF)',
		svg: FZ + linie(53, 3, 53, 27),
		felder: FZ_FELDER(34.5, 33),
		ausleger: { x: 55.5, y: 24, winkel: -82, laenge: 34, svg: keil(34) }
	}),
	fahrzeug({
		id: 'kranfahrzeug',
		name: 'Kranfahrzeug',
		svg: FZ,
		felder: FZ_FELDER(31, 26),
		ausleger: { x: 48, y: 9, winkel: -45, laenge: 46, svg: keil(46) }
	}),
	fahrzeug({
		id: 'drehleiter',
		name: 'Drehleiter in Arbeitsstellung',
		svg: FZ,
		felder: FZ_FELDER(37, 38, 'DL'),
		ausleger: { x: 40, y: 4, winkel: -140, laenge: 32, svg: leiter(32) }
	}),
	fahrzeug({
		id: 'drehleiter-korb',
		name: 'Drehleiter mit Arbeitskorb oder Leiterbühne in Arbeitsstellung',
		svg: FZ,
		felder: FZ_FELDER(37, 38, 'DLK'),
		ausleger: { x: 31, y: 4, winkel: -30, laenge: 34, svg: leiter(34) + korb(34) }
	}),
	fahrzeug({
		id: 'drehleiter-werfer',
		name: 'Drehleiter mit Arbeitskorb und Werfer',
		svg: FZ,
		felder: FZ_FELDER(37, 38, 'DLK'),
		ausleger: { x: 31, y: 4, winkel: -30, laenge: 34, svg: leiter(34) + korb(34) + werferSpitze(34) }
	}),
	fahrzeug({
		id: 'anhaenger',
		name: 'Anhänger ein- oder mehrachsig',
		svg: `<rect x="10" y="4" width="48" height="22" ${st()}/>${linie(2, 15, 10, 15)}`,
		felder: fahrzeugFelder({ links: 2, mitte: 34, oben: 4, y: 15, innen: { x: 34, breite: 42 } })
	}),
	fahrzeug({
		id: 'aufbau',
		name: 'Abgesetzter Fahrzeugaufbau (Wechselaufbau, Abroll- oder Absetzbehälter)',
		svg: `<rect x="8" y="3" width="50" height="24" ${st()}/><rect x="3" y="7.5" width="5" height="15" ${st()}/>`,
		felder: fahrzeugFelder({ links: 3, mitte: 33, oben: 3, y: 15, innen: { x: 33, breite: 44 } })
	}),
	fahrzeug({
		id: 'tsa',
		name: 'Tragkraftspritzenanhänger mit aufgepackter TS',
		svg: `<rect x="10" y="4" width="48" height="22" ${st()}/>${linie(2, 15, 10, 15)}${pfad('M20 8.5 H48 M20 21.5 H48 M24 8.5 V21.5 M44 8.5 V21.5', S, 1.4)}${punkt(34, 15, 3.2)}`,
		felder: fahrzeugFelder({ links: 2, mitte: 34, oben: 4, y: 15 }).slice(0, 1)
	}),
	fahrzeug({
		id: 'schienenfahrzeug',
		name: 'Schienenfahrzeug',
		svg: `<rect x="10" y="4" width="40" height="22" ${st()}/>${pfad('M2 9 H10 M2 21 H10 M50 9 H58 M50 21 H58')}`,
		felder: fahrzeugFelder({ links: 2, mitte: 30, oben: 4, y: 15, innen: { x: 30, breite: 36 } })
	}),
	fahrzeug({
		id: 'wasserfahrzeug',
		name: 'Wasserfahrzeug',
		svg: pfad('M16 3 H58 V27 H16 C9 27 4 21 2 15 C4 9 9 3 16 3 Z'),
		felder: fahrzeugFelder({ links: 2, mitte: 34, oben: 3, y: 15, innen: { x: 37, breite: 36 } })
	}),
	fahrzeug({
		id: 'hubschrauber',
		name: 'Hubschrauber',
		h: 28,
		svg: pfad('M30 11 C24 3 4 2 4 11 C4 20 24 19 30 11 C36 3 56 2 56 11 C56 20 36 19 30 11 Z M30 11 V24 M25 24 H35', S, 1.6),
		felder: fahrzeugFelder({ links: 4, mitte: 30, oben: 2.5, y: 11, unten: 24 })
	}),
	fahrzeug({
		id: 'flugzeug',
		name: 'Flächenflugzeug',
		h: 28,
		svg: pfad('M30 14 C24 6 4 5 4 14 C4 23 24 22 30 14 C36 6 56 5 56 14 C56 23 36 22 30 14 Z M30 1 V27', S, 1.6),
		felder: fahrzeugFelder({ links: 4, mitte: 30, oben: 1, y: 14, unten: 27 })
	}),

	/* Gefahren */
	gefahr('gefahr', 'Gefahr allgemein', schrift(20, 22.5, '!', R, 15)),
	gefahr('ansteckungsgefahr', 'Ansteckungsgefahr', kreis(17.7, 21.7, 4, R, 1.4) + kreis(22.3, 21.7, 4, R, 1.4) + kreis(20, 25.7, 4, R, 1.4)),
	gefahr('brandgefahr', 'Brandgefahr', pfad('M17.8 30 L22.2 14 V30 Z', R, 1.4)),
	gefahr('chemiegefahr', 'Chemiegefahr', schrift(20, 23.5, 'C', R, 13)),
	gefahr('gasgefahr', 'Gasgefahr', schrift(20, 23.5, 'G', R, 13)),
	gefahr('lawinengefahr', 'Lawinen-, Muren- oder Felssturzgefahr', pfad('M13 31 L17 15 H23 L27 31 M10.5 26 H29.5 M9 29 H31', R, 1.4)),
	gefahr('strahlengefahr', 'Strahlengefahr oder Gefahr durch radioaktive Stoffe', punkt(20, 23, 1.6, R) + pfad('M20 23 L14.5 17.5 M20 23 L25.5 17.5 M20 23 V30', R, 1.4)),
	gefahr('ueberflutung', 'Überflutungsgefahr', wellen(10, 21, 20, R)),
	gefahr('explosion', 'Explosions- oder Zerknallgefahr', schrift(20, 24, 'EX', R, 10)),
	gefahr('elektrizitaet', 'Gefahr durch Elektrizität', pfad('M23 13 L18.5 21.5 H23 L18.5 30 M17.8 26.5 L18.5 30 L21.6 28.2', R, 1.4)),
	gefahr('verrauchung', 'Gefahr durch Verrauchung, Verqualmung', pfad('M13 24 H27 M10 27 H30 M8 30 H32', R, 1.4)),

	/* Schäden */
	schaden('schaden', 'Schaden allgemein', schrift(16, 16.5, '!', R, 18)),
	schaden('verseuchung', 'Verseuchung', kreis(13.2, 13.8, 5.2, R, 1.4) + kreis(18.8, 13.8, 5.2, R, 1.4) + kreis(16, 18.8, 5.2, R, 1.4)),
	schaden('brand-entstehung', 'Entstehungsbrand, Schwelbrand', flammen(1)),
	schaden('brand-entwickelt', 'entwickelter Brand', flammen(2)),
	schaden('brand-voll', 'Vollbrand', flammen(3)),
	schaden('chemie', 'Chemieaustritt', schrift(16, 16.5, 'C', R, 17)),
	schaden('gas', 'Gasaustritt', schrift(16, 16.5, 'G', R, 17)),
	schaden('lawine', 'Lawine, Mure, Felssturz', pfad('M8.5 25 L13 8 H19 L23.5 25 M5.5 19.5 H26.5 M5 23 H27', R, 1.4)),
	schaden('strahlung', 'Strahlung oder radioaktive Kontamination', punkt(16, 17, 1.9, R) + pfad('M16 17 L9.5 10.5 M16 17 L22.5 10.5 M16 17 V25.5', R, 1.4)),
	schaden('ueberflutung-schaden', 'Überflutung', wellen(7, 13.5, 18, R)),
	schaden('beschaedigt', 'beschädigt, angeschlagen, in der Funktion beeinträchtigt', kreuze(1)),
	schaden('teilzerstoert', 'teilzerstört, teilweise zusammengebrochen', kreuze(2)),
	schaden('zerstoert', 'zerstört, völlig zusammengebrochen', kreuze(3)),
	schaden('unterbrochen', 'unterbrochen, blockiert, gesperrt', pfad('M12.5 8 V24 M19.5 8 V24', R)),

	/* Leitern und Geräte */
	zeichen({ id: 'leiter', name: 'Leiter', gruppe: 'geraete', b: 16, h: 56, svg: pfad('M4 2 V54 M12 2 V54 M4 8 H12 M4 16 H12 M4 24 H12 M4 32 H12 M4 40 H12 M4 48 H12') }),
	geraet('grossgeraet', 'Großgerät (tragbar oder verhebbar)', ''),
	zeichen({
		id: 'tragkraftspritze',
		name: 'Tragkraftspritze',
		gruppe: 'geraete',
		b: 48,
		h: 36,
		svg: pfad('M9 8 H46 M9 28 H46 M9 8 V28 M39 8 V28 M9 18 H3 M3 14.5 V21.5 M15.5 8 V2.5 M12 2.5 H19 M15.5 28 V33.5 M12 33.5 H19') + punkt(24, 18, 4.5)
	}),
	geraet('tauchpumpe', 'Tauchpumpe, Umfüllpumpe', punkt(24, 14, 4.5)),
	geraet('luefter', 'Lüfter, Ventilator, Gerät zum Einblasen von Löschmittel', pfad('M31 8.5 L18 14 L31 19.5')),
	geraet('stromaggregat', 'Stromaggregat', pfad('M26 6.5 L21.5 14 H26.5 L22 21.5 M21.2 18.2 L22 21.5 L25 19.8', S, 1.6)),
	geraet('hydraulikaggregat', 'Hydraulikaggregat', pfad('M17 9 V19 M31 9 V19 M17 14 H31')),
	geraet('sprungretter', 'Sprungrettungsgerät (Sprungpolster, Sprungkissen)', pfad('M18 8 L30 20 M30 8 L18 20')),
	geraet('behaelter', 'Behälter (Auffangbehälter, Faltbehälter)', `<ellipse cx="24" cy="14" rx="8" ry="4.5" ${st()}/>`),

	/* Löschgeräte */
	loeschgeraet('schlauch', 'Schlauchleitung (Druck- oder Saugleitung)', 60, 24, pfad('M3 5 C14 5 18 7 22 13 C26 19 33 21 40 18 C46 15 51 12 57 12 M3 2 V8 M57 9 V15', S, 1.3)),
	loeschgeraet('strahlrohr', 'Strahl-, Schaum- oder Pulverrohr', 48, 20, pfad(`${PFEIL_LINKS} H44 M44 4 V16`), [
		{ key: 'groesse', name: 'Größe', x: 24, y: 3.5, groesse: 7.5, knoepfe: ['B', 'C'] }
	]),
	loeschgeraet('hydroschild', 'Hydroschild', 44, 32, pfad('M4 2 V30 M11 9 L4 16 L11 23 M4 16 H40 M40 10 V22')),
	loeschgeraet('wasserwerfer', 'Werfer mobil (Wasser-, Schaum- oder Pulverwerfer)', 52, 20, pfad(`${PFEIL_LINKS} H42`) + kreis(46, 10, 4)),
	loeschgeraet('verteiler', 'Verteiler', 40, 40, pfad('M5 20 H36 M5 14.5 V25.5 M36 14.5 V25.5 M26 20 L12 6 M26 20 L12 34 M8.5 9.5 L15.5 2.5 M8.5 30.5 L15.5 37.5')),
	loeschgeraet('sammelstueck', 'Sammelstück', 40, 40, pfad('M4 14.5 V25.5 M4 20 H20 L32 8 M20 20 L32 32 M28.5 4.5 L35.5 11.5 M28.5 35.5 L35.5 28.5')),
	loeschgeraet('zumischer', 'Zumischer', 48, 30, pfad('M4 8 H44 M4 2.5 V13.5 M44 2.5 V13.5 M24 8 L20 27 H28 Z')),
	loeschgeraet('saugkorb', 'Saugkorb', 40, 32, pfad('M3 10 V22 M4 16 L37 2 V30 Z')),
	loeschgeraet('druckminderer', 'Druckminderer, Druckbegrenzungsventil', 52, 24, kreis(26, 12, 8) + pfad('M20.3 6.3 L31.7 17.7 M31.7 6.3 L20.3 17.7 M4 12 H18 M34 12 H48 M4 6 V18 M48 6 V18')),
	loeschgeraet('kupplung', 'Kupplung', 20, 24, pfad('M3 12 H14 M14 3 V21')),

	/* Löscheinrichtungen */
	einrichtung('ueberflurhydrant', 'Überflurhydrant', 32, punkt(16, 16, 11)),
	einrichtung('unterflurhydrant', 'Unterflurhydrant', 32, kreis(16, 16, 11) + `<path d="M16 5 A11 11 0 0 0 16 27 Z" fill="${S}"/>`),
	einrichtung('wandhydrant', 'Wandhydrant', 32, kreis(16, 16, 11.2, S, 1.4) + punkt(16, 16, 8.5)),
	einrichtung('noteinspeisung', 'Noteinspeisung in nasse Löschwasseranlage', 60, kreis(16, 16, 11.2, S, 1.4) + punkt(16, 16, 8.5) + einspeisPfeil),
	einrichtung('trockenleitung', 'Entnahmestelle einer trockenen Löschwasseranlage', 32, kreis(16, 16, 9.5, S, 4)),
	einrichtung('einspeisung-trocken', 'Einspeisestelle einer trockenen Löschwasseranlage', 60, kreis(16, 16, 9.5, S, 4) + einspeisPfeil),
	einrichtung(
		'loeschwasservorrat',
		'Löschwasservorrat in ortsfester Einrichtung (Behälter, Becken, Zisterne, Brunnen)',
		32,
		`<rect x="3" y="3" width="26" height="26" ${st()}/>` + kreis(16, 16, 10, S, 1.4) + wellen(9.5, 14, 13, S)
	),
	zeichen({ id: 'werfer-ortsfest', name: 'Werfer ortsfest', gruppe: 'loescheinrichtungen', b: 56, h: 20, svg: pfad(`${PFEIL_LINKS} H43`) + punkt(48, 10, 5) }),
	zeichen({ id: 'leitung-ortsfest', name: 'Leitung ortsfest verlegt', gruppe: 'loescheinrichtungen', b: 60, h: 16, svg: pfad('M2 4 H26 L34 12 H58', S, 1.3) }),

	/* Sonstiges */
	zeichen({
		id: 'nord',
		name: 'Nordpfeil',
		gruppe: 'sonstige',
		b: 32,
		h: 64,
		svg: pfad('M16 3 V62 M8 15 L16 3 L24 15', S, 2) + `<path d="M9.5 57 V35 L22.5 57 V35" fill="none" stroke="${S}" stroke-width="4.2" stroke-linejoin="miter"/>`
	}),
	zeichen({
		id: 'wind',
		name: 'Windrichtung',
		gruppe: 'sonstige',
		b: 56,
		h: 30,
		svg: schrift(28, 6.5, 'WIND', S, 7) + pfad('M4 15 H52 M45 10 L52 15 L45 20'),
		felder: [{ key: 'tempo', name: 'Windgeschwindigkeit', x: 28, y: 23.5, groesse: 6.5, vorschlaege: ['10 km/h', '20 km/h', '30 km/h', '50 km/h'] }]
	})
];

export const SYMBOL = Object.fromEntries(SYMBOLE.map((s) => [s.id, s])) as Record<string, SymbolDef>;

/** Zeilen der gedruckten Legende wie auf dem Aufnahmeblatt; mehrere Zeichen stehen nebeneinander */
export const LEGENDE_ZEILEN: { ids: string[]; text: string }[] = [
	{ ids: ['befehlsstelle'], text: 'Befehls-, Führungs-, Leitstelle' },
	{ ids: ['kfz'], text: 'Kraftfahrzeug' },
	{ ids: ['hlf'], text: 'HLF, LF, TLF, RLF' },
	{ ids: ['verteiler'], text: 'Verteiler' },
	{ ids: ['schlauch'], text: 'Schlauchleitung' },
	{ ids: ['strahlrohr'], text: 'Strahlrohr' },
	{ ids: ['wasserwerfer'], text: 'Wasserwerfer' },
	{ ids: ['tragkraftspritze', 'tauchpumpe'], text: 'Tragkraftspritze, Tauchpumpe' },
	{ ids: ['luefter'], text: 'Lüfter, Ventilator' },
	{ ids: ['stromaggregat'], text: 'Stromaggregat' },
	{ ids: ['hydraulikaggregat'], text: 'Hydraulikaggregat' },
	{ ids: ['einrichtung'], text: 'vorübergehend anlassbezogene Einrichtung (ASSP, EA)' },
	{ ids: ['ueberflurhydrant'], text: 'Überflurhydrant' },
	{ ids: ['unterflurhydrant'], text: 'Unterflurhydrant' },
	{ ids: ['wandhydrant'], text: 'Wandhydrant' },
	{ ids: ['trockenleitung'], text: 'Entnahmestelle trockener Löschwasseranlage' },
	{ ids: ['loeschwasservorrat'], text: 'Löschwasservorrat ortsfest' },
	{ ids: ['person'], text: 'Person (Grundzeichen)' },
	{ ids: ['person-verletzt'], text: 'Person verletzt' },
	{ ids: ['person-tot'], text: 'Person tot' },
	{ ids: ['person-zwangslage'], text: 'Person in Zwangslage' },
	{ ids: ['person-vermisst'], text: 'Person vermisst' },
	{ ids: ['schaden'], text: 'Schaden allgemein' },
	{ ids: ['brand-entstehung', 'brand-entwickelt', 'brand-voll'], text: 'Entstehungs-, entwickelter, Vollbrand' },
	{ ids: ['beschaedigt', 'teilzerstoert', 'zerstoert'], text: 'beschädigt, teilzerstört, zerstört' },
	{ ids: ['unterbrochen'], text: 'unterbrochen, gesperrt, blockiert' },
	{ ids: ['chemie'], text: 'Chemieaustritt' },
	{ ids: ['gas'], text: 'Gasaustritt' },
	{ ids: ['gefahr'], text: 'Gefahr allgemein' },
	{ ids: ['explosion'], text: 'Explosionsgefahr' },
	{ ids: ['ueberflutung'], text: 'Überflutungsgefahr' },
	{ ids: ['wind'], text: 'Windrichtung' },
	{ ids: ['nord'], text: 'Nordrichtung' }
];

const BLATT = LEGENDE_ZEILEN.flatMap((z) => z.ids);

/** Zeichen der Legende am Aufnahmeblatt je Berichtsart (erste Gruppe der Palette) */
export const LEGENDE: Record<BerichtTyp, string[]> = { brand: BLATT, technik: BLATT, schadstoff: BLATT, tus: [] };

/* ---------------------------------------------------------------- Zeichnen */

const maskieren = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Text auf höchstens `zeilen` Zeilen umbrechen, möglichst gleich lang */
export function umbrechen(text: string, groesse: number, breite = Infinity, zeilen = 1): string[] {
	const t = text.trim().replace(/\s+/g, ' ');
	if (!t) return [];
	if (zeilen < 2 || t.length * groesse * 0.6 <= breite || !t.includes(' ')) return [t];
	let best = [t], laengste = Infinity;
	for (let i = t.indexOf(' '); i > 0; i = t.indexOf(' ', i + 1)) {
		const a = t.slice(0, i), b = t.slice(i + 1);
		if (Math.max(a.length, b.length) < laengste) {
			laengste = Math.max(a.length, b.length);
			best = [a, b];
		}
	}
	return best;
}

/** Steht das Zeichen so gedreht, dass Beschriftungen auf dem Kopf stünden? */
export const kopfueber = (winkel: number) => {
	const w = ((winkel % 360) + 360) % 360;
	return w > 90 && w < 270;
};

/**
 * Markup eines Zeichens in Zeichen-Einheiten: Grundzeichen, Ausleger in seiner Stellung und Beschriftungen.
 * `kopf` dreht die Beschriftungen um 180°, damit sie bei gedrehtem Zeichen lesbar bleiben.
 */
export function zeichnen(def: SymbolDef, o: { felder?: Record<string, string>; ausleger?: number; kopf?: boolean } = {}): string {
	let s = def.svg;
	if (def.ausleger) {
		const a = def.ausleger;
		s += `<g transform="translate(${a.x} ${a.y}) rotate(${o.ausleger ?? a.winkel})">${a.svg}</g>`;
	}
	for (const f of def.felder ?? []) {
		const zeilen = umbrechen(o.felder?.[f.key] ?? f.vorgabe ?? '', f.groesse, f.breite, f.zeilen);
		if (!zeilen.length) continue;
		let anker = f.anker ?? 'middle';
		if (o.kopf && anker !== 'middle') anker = anker === 'start' ? 'end' : 'start';
		const lh = f.groesse * 1.15;
		const y0 = f.y - ((zeilen.length - 1) * lh) / 2;
		s +=
			`<text text-anchor="${anker}"${o.kopf ? ` transform="rotate(180 ${f.x} ${f.y})"` : ''} fill="${S}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${f.groesse}" paint-order="stroke" stroke="#fff" stroke-width="1.6" stroke-linejoin="round">` +
			zeilen.map((z, i) => `<tspan x="${f.x}" y="${y0 + i * lh}" dominant-baseline="central">${maskieren(z)}</tspan>`).join('') +
			'</text>';
	}
	return s;
}
