import type { BerichtTyp } from './typen';

/*
 * Taktische Zeichen aus der Legende der Aufnahmeblätter (Auszug aus der ÖBFV RL E-27).
 * Jedes Zeichen ist in ein Feld von 48 × 32 Einheiten gezeichnet, Mittelpunkt (24, 16).
 * Die Markup-Strings sind fest im Code und enthalten keine Benutzereingaben.
 */

const S = '#1a1a1a';
const R = '#e10600';
const B = '#2050c8';

const strich = (farbe = S, breite = 2) => `fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-linecap="round" stroke-linejoin="round"`;
const textStil = (farbe: string, groesse: number) =>
	`fill="${farbe}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${groesse}" text-anchor="middle" dominant-baseline="central"`;

const kasten = (inhalt: string) => `<rect x="12" y="7" width="24" height="18" ${strich()}/><line x1="8" y1="25" x2="40" y2="25" ${strich()}/>${inhalt}`;
const rotesQuadrat = (inhalt: string, gefuellt = false) =>
	`<rect x="14" y="6" width="20" height="20" ${gefuellt ? `fill="${R}" stroke="${R}" stroke-width="2"` : strich(R, 2.2)}/>${inhalt}`;
const raute = (farbe: string, dy = 0) => `<path d="M24 ${4 + dy} L36 ${16 + dy} L24 ${28 + dy} L12 ${16 + dy} Z" ${strich(farbe, 2.2)}/>`;
const dreieck = (inhalt: string) => `<path d="M24 4 L38 28 H10 Z" ${strich(R, 2)}/>${inhalt}`;
const flammen = (n: number) =>
	Array.from({ length: n }, (_, i) => {
		const x = 24 + (i - (n - 1) / 2) * 5;
		return `<line x1="${x - 2}" y1="21" x2="${x + 2}" y2="11" ${strich(R, 1.8)}/>`;
	}).join('');

export type SymbolDef = { id: string; name: string; svg: string; mitText?: string };

export const SYMBOLE: SymbolDef[] = [
	{ id: 'befehlsstelle', name: 'Befehls-, Führungs-, Leitstelle', svg: `<path d="M8 28 V6 H40 V18 H8" ${strich(B, 2.4)}/>` },
	{ id: 'kfz', name: 'Kraftfahrzeug', svg: `<rect x="6" y="8" width="36" height="16" ${strich()}/><line x1="14" y1="8" x2="14" y2="24" ${strich()}/>` },
	{
		id: 'hlf',
		name: 'HLF, LF, TLF, RLF',
		svg: `<rect x="6" y="8" width="36" height="16" ${strich()}/><line x1="14" y1="8" x2="14" y2="24" ${strich()}/><text x="28" y="16.5" ${textStil(S, 8)}>HLF</text>`
	},
	{
		id: 'verteiler',
		name: 'Verteiler',
		svg: `<path d="M5 16 Q11 6 17 16 Q11 26 5 16 Z" ${strich()}/><line x1="17" y1="16" x2="41" y2="16" ${strich()}/><line x1="41" y1="10" x2="41" y2="22" ${strich()}/>`
	},
	{
		id: 'schlauch',
		name: 'Schlauchleitung',
		svg: `<line x1="5" y1="11" x2="5" y2="21" ${strich()}/><path d="M5 16 C11 9 17 23 23 16 S35 9 41 16" ${strich()}/><path d="M37 12 L43 16 L37 20" ${strich()}/>`
	},
	{
		id: 'strahlrohr',
		name: 'Strahlrohr',
		svg: `<path d="M12 10 L5 16 L12 22" ${strich()}/><line x1="5" y1="16" x2="42" y2="16" ${strich()}/><line x1="42" y1="10" x2="42" y2="22" ${strich()}/>`
	},
	{
		id: 'wasserwerfer',
		name: 'Wasserwerfer',
		svg: `<path d="M12 10 L5 16 L12 22" ${strich()}/><line x1="5" y1="16" x2="36" y2="16" ${strich()}/><circle cx="40" cy="16" r="4" ${strich()}/>`
	},
	{ id: 'tragkraftspritze', name: 'Tragkraftspritze, Tauchpumpe', svg: kasten(`<circle cx="24" cy="16" r="2.6" fill="${S}"/>`) },
	{ id: 'luefter', name: 'Lüfter, Ventilator', svg: kasten(`<path d="M28 10 L19 16 L28 22" ${strich()}/>`) },
	{ id: 'stromaggregat', name: 'Stromaggregat', svg: kasten(`<path d="M26 9 L21 17 H27 L22 24" ${strich(S, 1.8)}/>`) },
	{
		id: 'hydraulikaggregat',
		name: 'Hydraulikaggregat',
		svg: kasten(`<line x1="18" y1="11" x2="18" y2="21" ${strich()}/><line x1="30" y1="11" x2="30" y2="21" ${strich()}/><line x1="18" y1="16" x2="30" y2="16" ${strich()}/>`)
	},
	{ id: 'einrichtung', name: 'vorübergehend anlassbezogene Einrichtung (ASSP, EA)', svg: `<circle cx="24" cy="16" r="9" ${strich()}/>` },
	{ id: 'ueberflurhydrant', name: 'Überflurhydrant', svg: `<circle cx="24" cy="16" r="9" fill="${S}"/>` },
	{
		id: 'unterflurhydrant',
		name: 'Unterflurhydrant',
		svg: `<circle cx="24" cy="16" r="9" ${strich()}/><path d="M24 7 A9 9 0 0 0 24 25 Z" fill="${S}"/>`
	},
	{ id: 'wandhydrant', name: 'Wandhydrant', svg: `<circle cx="24" cy="16" r="9" ${strich()}/><circle cx="24" cy="16" r="4.2" fill="${S}"/>` },
	{ id: 'trockenleitung', name: 'Entnahmestelle trockener Löschwasseranlage', svg: `<circle cx="24" cy="16" r="8" ${strich(S, 4)}/>` },
	{
		id: 'loeschwasservorrat',
		name: 'Löschwasservorrat ortsfest',
		svg: `<rect x="13" y="5" width="22" height="22" ${strich()}/><circle cx="24" cy="16" r="8" ${strich(S, 1.6)}/><path d="M19 14 q2.5 -2 5 0 t5 0 M19 18.5 q2.5 -2 5 0 t5 0" ${strich(S, 1.6)}/>`
	},
	{ id: 'person', name: 'Person (Grundzeichen)', svg: raute(S) },
	{ id: 'person-verletzt', name: 'Person verletzt', svg: `${raute(R)}<line x1="24" y1="4" x2="24" y2="28" ${strich(R, 2)}/>` },
	{ id: 'person-tot', name: 'Person tot', svg: `${raute(R)}<line x1="24" y1="4" x2="24" y2="28" ${strich(R, 2)}/><line x1="12" y1="16" x2="36" y2="16" ${strich(R, 2)}/>` },
	{
		id: 'person-zwangslage',
		name: 'Person in Zwangslage',
		svg: `<path d="M24 7 L35 18 L24 29 L13 18 Z" ${strich(R, 2.2)}/><line x1="17" y1="3" x2="31" y2="3" ${strich(R, 2.2)}/><line x1="24" y1="3" x2="24" y2="7" ${strich(R, 2.2)}/>`
	},
	{
		id: 'person-vermisst',
		name: 'Person vermisst',
		svg: `<path d="M22 3 L33 14 L22 25 L11 14 Z" ${strich(R, 2)}/><path d="M26 7 L37 18 L26 29 L15 18 Z" ${strich(R, 2)}/>`
	},
	{ id: 'schaden', name: 'Schaden allgemein', svg: rotesQuadrat(`<text x="24" y="16.5" ${textStil(R, 16)}>!</text>`) },
	{ id: 'brand-entstehung', name: 'Entstehungsbrand', svg: rotesQuadrat(flammen(1)) },
	{ id: 'brand-entwickelt', name: 'entwickelter Brand', svg: rotesQuadrat(flammen(2)) },
	{ id: 'brand-voll', name: 'Vollbrand', svg: rotesQuadrat(flammen(3)) },
	{ id: 'beschaedigt', name: 'beschädigt', svg: rotesQuadrat(`<path d="M19.5 11.5 L28.5 20.5 M28.5 11.5 L19.5 20.5" ${strich(R, 1.4)}/>`) },
	{ id: 'teilzerstoert', name: 'teilzerstört', svg: rotesQuadrat(`<path d="M18.5 10.5 L29.5 21.5 M29.5 10.5 L18.5 21.5" ${strich(R, 3)}/>`) },
	{ id: 'zerstoert', name: 'zerstört', svg: rotesQuadrat(`<path d="M18.5 10.5 L29.5 21.5 M29.5 10.5 L18.5 21.5" ${strich('#ffffff', 3)}/>`, true) },
	{
		id: 'unterbrochen',
		name: 'unterbrochen, gesperrt, blockiert',
		svg: rotesQuadrat(`<line x1="21" y1="10" x2="21" y2="22" ${strich(R, 2.4)}/><line x1="27" y1="10" x2="27" y2="22" ${strich(R, 2.4)}/>`)
	},
	{ id: 'chemie', name: 'Chemieaustritt', svg: rotesQuadrat(`<text x="24" y="16.5" ${textStil(R, 15)}>C</text>`) },
	{ id: 'gas', name: 'Gasaustritt', svg: rotesQuadrat(`<text x="24" y="16.5" ${textStil(R, 15)}>G</text>`) },
	{ id: 'gefahr', name: 'Gefahr allgemein', svg: dreieck(`<text x="24" y="20" ${textStil(R, 12)}>!</text>`) },
	{ id: 'explosion', name: 'Explosionsgefahr', svg: dreieck(`<text x="24" y="21" ${textStil(R, 7.5)}>EX</text>`) },
	{ id: 'ueberflutung', name: 'Überflutungsgefahr', svg: dreieck(`<text x="24" y="21" ${textStil(R, 7)}>Hw</text>`) },
	{
		id: 'wind',
		name: 'Windrichtung',
		mitText: '30 km/h',
		svg: `<path d="M9 12 L3 16 L9 20" ${strich()}/><line x1="3" y1="16" x2="45" y2="16" ${strich(S, 1.8)}/><text x="26" y="11" ${textStil(S, 6.5)}>Wind</text>`
	},
	{
		id: 'nord',
		name: 'Nordrichtung',
		svg: `<line x1="24" y1="4" x2="24" y2="30" ${strich(S, 1.8)}/><path d="M20 9 L24 2 L28 9 Z" fill="${S}"/><path d="M20 30 L24 23 L28 30 Z" fill="${S}"/><text x="31" y="16.5" ${textStil(S, 10)}>N</text>`
	}
];

export const SYMBOL = Object.fromEntries(SYMBOLE.map((s) => [s.id, s])) as Record<string, SymbolDef>;

/** Legende je Berichtsart. Brand, Technik und Schadstoff verwenden laut Vorlage dieselben Zeichen. */
export const LEGENDE: Record<BerichtTyp, string[]> = {
	brand: SYMBOLE.map((s) => s.id),
	technik: SYMBOLE.map((s) => s.id),
	schadstoff: SYMBOLE.map((s) => s.id),
	tus: []
};

/** Zeilen der gedruckten Legende: Brand- und Zerstörungsstufen stehen wie im Original nebeneinander */
export const LEGENDE_ZEILEN: { ids: string[]; text: string }[] = [
	{ ids: ['befehlsstelle'], text: 'Befehls-, Führungs-, Leitstelle' },
	{ ids: ['kfz'], text: 'Kraftfahrzeug' },
	{ ids: ['hlf'], text: 'HLF, LF, TLF, RLF' },
	{ ids: ['verteiler'], text: 'Verteiler' },
	{ ids: ['schlauch'], text: 'Schlauchleitung' },
	{ ids: ['strahlrohr'], text: 'Strahlrohr' },
	{ ids: ['wasserwerfer'], text: 'Wasserwerfer' },
	{ ids: ['tragkraftspritze'], text: 'Tragkraftspritze, Tauchpumpe' },
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

/** Grundgröße eines Zeichens in Skizzen-Einheiten (Skizze ist 1000 breit) */
export const SYMBOL_B = 60;
export const SYMBOL_H = 40;
