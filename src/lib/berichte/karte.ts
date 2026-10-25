import { SKIZZE_B, SKIZZE_H, type SkizzenKarte } from './typen';

/*
 * Kartenausschnitt nachzeichnen: Gebäude, Straßen, Gewässer und Bahn aus OpenStreetMap
 * (Overpass-API) werden in die Koordinaten der Skizze umgerechnet und als Strichzeichnung gespeichert.
 * Kartendaten © OpenStreetMap-Mitwirkende, ODbL.
 */

type Bbox = [number, number, number, number]; // Süd, West, Nord, Ost

/** Der gewählte (eventuell gedrehte) Rahmen auf der Karte */
export type Ausschnitt = {
	/** Abfragebereich: achsparalleles Rechteck, das den gedrehten Rahmen umschließt */
	bbox: Bbox;
	/** Rechnet einen Kartenpunkt in Skizzen-Einheiten um (0 bis SKIZZE_B × 0 bis SKIZZE_H) */
	projektion: (lat: number, lon: number) => [number, number];
	einheitenJeMeter: number;
	/** Damit der Dialog beim nächsten Öffnen wieder genau hier steht */
	ansicht: { lat: number; lon: number; zoom: number; drehung: number };
};

/** Linienvereinfachung (Douglas-Peucker) auf flachen [x, y, x, y …]-Listen */
function vereinfachen(p: number[], toleranz: number): number[] {
	const n = p.length / 2;
	if (n <= 2) return p;
	const behalten = new Uint8Array(n);
	behalten[0] = behalten[n - 1] = 1;
	const stapel: [number, number][] = [[0, n - 1]];
	while (stapel.length) {
		const [a, b] = stapel.pop()!;
		const ax = p[a * 2], ay = p[a * 2 + 1], bx = p[b * 2], by = p[b * 2 + 1];
		const dx = bx - ax, dy = by - ay;
		const len = Math.hypot(dx, dy);
		let max = 0, idx = -1;
		for (let i = a + 1; i < b; i++) {
			// Bei geschlossenen Umrissen sind Anfang und Ende gleich: dann Abstand zum Punkt
			const d = len < 1e-9
				? Math.hypot(p[i * 2] - ax, p[i * 2 + 1] - ay)
				: Math.abs(dy * p[i * 2] - dx * p[i * 2 + 1] + bx * ay - by * ax) / len;
			if (d > max) { max = d; idx = i; }
		}
		if (max > toleranz && idx > 0) {
			behalten[idx] = 1;
			stapel.push([a, idx], [idx, b]);
		}
	}
	const out: number[] = [];
	for (let i = 0; i < n; i++) if (behalten[i]) out.push(p[i * 2], p[i * 2 + 1]);
	return out;
}

/** Straßenbreite in Metern je Straßenklasse; Wege werden dünn gestrichelt */
const STRASSE: Record<string, number> = {
	motorway: 14, trunk: 12, primary: 10, secondary: 9, tertiary: 8, motorway_link: 7, trunk_link: 7, primary_link: 7,
	secondary_link: 7, tertiary_link: 7, residential: 6.5, unclassified: 6, living_street: 5.5, road: 6, service: 4, pedestrian: 5
};
const WEG = new Set(['footway', 'path', 'cycleway', 'track', 'steps', 'bridleway']);

type OsmElement = {
	type: 'way' | 'relation';
	tags?: Record<string, string>;
	geometry?: { lat: number; lon: number }[];
	members?: { role: string; geometry?: { lat: number; lon: number }[] }[];
};

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export async function karteNachzeichnen(ausschnitt: Ausschnitt, signal?: AbortSignal): Promise<SkizzenKarte> {
	const { bbox, projektion, einheitenJeMeter, ansicht } = ausschnitt;
	const [s, w, n, o] = bbox;
	const b = `${s},${w},${n},${o}`;
	const abfrage = `[out:json][timeout:25];(
		way["building"](${b});relation["building"](${b});
		way["highway"](${b});
		way["railway"~"^(rail|tram|light_rail|narrow_gauge)$"](${b});
		way["waterway"~"^(river|stream|canal|ditch|drain)$"](${b});
		way["natural"="water"](${b});relation["natural"="water"](${b});
	);out geom;`;

	let daten: { elements: OsmElement[] } | null = null;
	let letzterFehler: unknown = null;
	for (const url of OVERPASS) {
		try {
			const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: abfrage }), signal });
			if (!r.ok) throw new Error(`Overpass ${r.status}`);
			daten = await r.json();
			break;
		} catch (e) {
			if (signal?.aborted) throw e;
			letzterFehler = e;
		}
	}
	if (!daten) throw letzterFehler ?? new Error('Kartendaten nicht erreichbar');

	const runden = (v: number) => Math.round(v * 10) / 10;

	const karte: SkizzenKarte = { bbox, linien: [], namen: [], drehung: ansicht.drehung, ansicht };
	const projizieren = (geo: { lat: number; lon: number }[]) =>
		vereinfachen(
			geo.flatMap((g) => {
				const [x, y] = projektion(g.lat, g.lon);
				return [runden(x), runden(y)];
			}),
			0.8
		);
	/** Bei gedrehtem Rahmen liefert die Abfrage mehr als nötig: alles außerhalb der Skizze weglassen */
	const RAND = 40;
	const imBild = (p: number[]) => {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (let i = 0; i < p.length; i += 2) {
			minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
			minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]);
		}
		return maxX >= -RAND && minX <= SKIZZE_B + RAND && maxY >= -RAND && minY <= SKIZZE_H + RAND;
	};
	const namenGesehen = new Map<string, number>();

	for (const el of daten.elements) {
		const t = el.tags ?? {};
		const teile =
			el.type === 'way' && el.geometry
				? [el.geometry]
				: (el.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry!);
		for (const geo of teile) {
			if (geo.length < 2) continue;
			const punkte = projizieren(geo);
			if (!imBild(punkte)) continue;
			const zu = geo.length > 2 && geo[0].lat === geo[geo.length - 1].lat && geo[0].lon === geo[geo.length - 1].lon;

			if (t.building) karte.linien.push({ art: 'gebaeude', punkte, zu: true });
			else if (t.natural === 'water') karte.linien.push({ art: 'wasser', punkte, zu: true });
			else if (t.waterway) karte.linien.push({ art: 'wasser', punkte, zu: false, breite: t.waterway === 'river' ? 10 * einheitenJeMeter : 2.5 });
			else if (t.railway) karte.linien.push({ art: 'bahn', punkte, zu: false });
			else if (t.highway && WEG.has(t.highway)) karte.linien.push({ art: 'weg', punkte, zu: false });
			else if (t.highway && STRASSE[t.highway]) {
				const breite = Math.max(6, STRASSE[t.highway] * einheitenJeMeter);
				karte.linien.push({ art: 'strasse', punkte, zu, breite, name: t.name });
				if (t.name) namenSetzen(t.name, punkte);
			}
		}
	}

	// Straßennamen: einmal je Straße am längsten Abschnitt, entlang der Straße ausgerichtet
	function namenSetzen(name: string, p: number[]) {
		let best = -1, bestLen = 0;
		for (let i = 0; i < p.length / 2 - 1; i++) {
			const len = Math.hypot(p[i * 2 + 2] - p[i * 2], p[i * 2 + 3] - p[i * 2 + 1]);
			if (len > bestLen) { bestLen = len; best = i; }
		}
		if (best < 0 || bestLen < name.length * 7) return;
		const vorher = namenGesehen.get(name) ?? 0;
		if (vorher >= bestLen) return;
		namenGesehen.set(name, bestLen);
		const x1 = p[best * 2], y1 = p[best * 2 + 1], x2 = p[best * 2 + 2], y2 = p[best * 2 + 3];
		let winkel = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
		if (winkel > 90) winkel -= 180;
		if (winkel < -90) winkel += 180;
		const x = (x1 + x2) / 2, y = (y1 + y2) / 2;
		if (x < 0 || x > SKIZZE_B || y < 0 || y > SKIZZE_H) return;
		const i = karte.namen.findIndex((n) => n.text === name);
		const eintrag = { text: name, x: runden(x), y: runden(y), winkel: Math.round(winkel) };
		if (i >= 0) karte.namen[i] = eintrag;
		else karte.namen.push(eintrag);
	}

	// Kleine Flächen zuerst zeichnen, damit Gewässer nicht Gebäude überdecken
	const reihenfolge = { wasser: 0, gebaeude: 1, weg: 2, strasse: 3, bahn: 4 } as const;
	karte.linien.sort((a, b) => reihenfolge[a.art] - reihenfolge[b.art]);
	return karte;
}

/** Adresse suchen (Nominatim, OpenStreetMap) */
export async function adresseSuchen(text: string, signal?: AbortSignal): Promise<{ lat: number; lon: number; name: string }[]> {
	const url = new URL('https://nominatim.openstreetmap.org/search');
	url.searchParams.set('format', 'jsonv2');
	url.searchParams.set('q', text);
	url.searchParams.set('countrycodes', 'at');
	url.searchParams.set('limit', '5');
	// Bevorzugt Treffer um Leopoldsdorf
	url.searchParams.set('viewbox', '16.30,48.15,16.55,48.05');
	const r = await fetch(url, { signal, headers: { 'Accept-Language': 'de' } });
	if (!r.ok) throw new Error('Adresssuche nicht erreichbar');
	const liste: { lat: string; lon: string; display_name: string }[] = await r.json();
	return liste.map((x) => ({ lat: Number(x.lat), lon: Number(x.lon), name: x.display_name }));
}

/** Ortsmitte Leopoldsdorf als Startpunkt der Karte */
export const START = { lat: 48.1167, lon: 16.3933, zoom: 17 };
