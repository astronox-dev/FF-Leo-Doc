<script lang="ts">
	import MapPinned from '@lucide/svelte/icons/map-pinned';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Type from '@lucide/svelte/icons/type';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import MapOff from '@lucide/svelte/icons/map-pin-off';
	import Search from '@lucide/svelte/icons/search';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Minimize2 from '@lucide/svelte/icons/minimize-2';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import SkizzeSvg from './SkizzeSvg.svelte';
	import KarteWaehlen from './KarteWaehlen.svelte';
	import { GRUPPEN, LEGENDE, MASS, SYMBOL, SYMBOLE, zeichnen, type Feld } from '$lib/berichte/legende';
	import { SKIZZE_B, SKIZZE_H, type BerichtTyp, type Skizze, type SkizzenElement, type SkizzenKarte } from '$lib/berichte/typen';
	import { naechsterAbschnitt, schlauchMitte } from '$lib/berichte/schlauch';
	import Spline from '@lucide/svelte/icons/spline';

	let {
		wert = $bindable(),
		typ,
		einsatzort,
		funknamen = []
	}: { wert: Skizze | null; typ: BerichtTyp; einsatzort: string; funknamen?: string[] } = $props();

	const uid = $props.id();

	type Werkzeug = 'auswahl' | 'stift' | 'text' | 'schlauch';
	const FARBEN = [
		{ wert: '#1a1a1a', name: 'Schwarz' },
		{ wert: '#e10600', name: 'Rot' },
		{ wert: '#2050c8', name: 'Blau' }
	];

	let svg = $state<SVGSVGElement>();
	let werkzeug = $state<Werkzeug>('auswahl');
	let farbe = $state('#1a1a1a');
	let auswahl = $state<string | null>(null);
	let platzieren = $state<string | null>(null);
	let karteOffen = $state(false);
	let verlauf: string[] = [];
	let textFeld = $state<HTMLInputElement>();

	/* Palette: zuerst die Zeichen des Aufnahmeblatts, dann alle Gruppen der E-27; die Suche geht über alle */
	let gruppe = $state('blatt');
	let suche = $state('');
	const normal = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
	const palette = $derived.by(() => {
		const q = normal(suche.trim());
		if (q) return SYMBOLE.filter((s) => normal(s.name).includes(q));
		if (gruppe === 'blatt') return LEGENDE[typ].map((id) => SYMBOL[id]);
		return SYMBOLE.filter((s) => s.gruppe === gruppe);
	});
	const gewaehlt = $derived(wert?.elemente.find((e) => e.id === auswahl) ?? null);
	const gewaehltDef = $derived(gewaehlt?.art === 'symbol' ? SYMBOL[gewaehlt.symbol] : null);

	const neueId = () => Math.random().toString(36).slice(2, 10);

	function sicherstellen(): Skizze {
		if (!wert) wert = { karte: null, elemente: [] };
		return wert;
	}
	function merken() {
		verlauf.push(JSON.stringify(wert));
		if (verlauf.length > 40) verlauf.shift();
	}
	function rueckgaengig() {
		const letzter = verlauf.pop();
		if (letzter === undefined) return;
		wert = JSON.parse(letzter);
		auswahl = null;
	}

	/* ------------------------------------------------ Zoom, Verschieben und Vollbild */

	type Ansicht = { x: number; y: number; w: number; h: number };
	const GANZ: Ansicht = { x: 0, y: 0, w: SKIZZE_B, h: SKIZZE_H };
	const MAX_ZOOM = 6;
	let ansicht = $state<Ansicht>({ ...GANZ });
	const zoom = $derived(SKIZZE_B / ansicht.w);
	let vollbild = $state(false);
	let editorEl = $state<HTMLDivElement>();
	let flaeche = $state<HTMLDivElement>();

	/** Ausschnitt setzen, auf 1- bis 6-fach begrenzt und innerhalb der Skizze gehalten */
	function ansichtSetzen(x: number, y: number, w: number) {
		w = Math.min(SKIZZE_B, Math.max(SKIZZE_B / MAX_ZOOM, w));
		const h = (w * SKIZZE_H) / SKIZZE_B;
		ansicht = { x: Math.min(SKIZZE_B - w, Math.max(0, x)), y: Math.min(SKIZZE_H - h, Math.max(0, y)), w, h };
	}
	/** Um einen Punkt der Skizze zoomen; dieser Punkt bleibt am Bildschirm an seiner Stelle */
	function zoomen(faktor: number, px = ansicht.x + ansicht.w / 2, py = ansicht.y + ansicht.h / 2) {
		const w = Math.min(SKIZZE_B, Math.max(SKIZZE_B / MAX_ZOOM, ansicht.w / faktor));
		const k = w / ansicht.w;
		ansichtSetzen(px - (px - ansicht.x) * k, py - (py - ansicht.y) * k, w);
	}
	/** Lage eines Ausschnitts am Bildschirm; die Skizze wird mittig eingepasst */
	function abbildung(v: Ansicht) {
		const r = svg!.getBoundingClientRect();
		const s = Math.min(r.width / v.w, r.height / v.h);
		return { s, ox: r.left + (r.width - v.w * s) / 2, oy: r.top + (r.height - v.h * s) / 2 };
	}

	// Mausrad zoomt im Vollbild, sonst mit Strg (auch Zwei-Finger-Zoom am Touchpad)
	$effect(() => {
		const el = flaeche;
		if (!el) return;
		const rad = (e: WheelEvent) => {
			if (!vollbild && !e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			const p = inSkizze(e.clientX, e.clientY);
			zoomen(Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.002), p.x, p.y);
		};
		el.addEventListener('wheel', rad, { passive: false });
		return () => el.removeEventListener('wheel', rad);
	});

	async function vollbildAn() {
		vollbild = true;
		// Wo der Browser es kann, verschwinden auch Adressleiste und Taskleiste
		try {
			await editorEl?.requestFullscreen?.();
		} catch {
			/* Nicht möglich (z. B. iPhone): die Ansicht über die ganze Seite reicht */
		}
	}
	/** Zurück ins Formular, dort wieder mit der ganzen Skizze im Blick */
	function vollbildAus() {
		vollbild = false;
		ansicht = { ...GANZ };
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
	}
	$effect(() => {
		if (!vollbild) return;
		const vorher = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		// Esc im Vollbild des Browsers beendet auch unseren Vollbildmodus
		const beendet = () => {
			if (!document.fullscreenElement) vollbildAus();
		};
		document.addEventListener('fullscreenchange', beendet);
		return () => {
			document.body.style.overflow = vorher;
			document.removeEventListener('fullscreenchange', beendet);
		};
	});

	function inSkizze(clientX: number, clientY: number) {
		const pt = svg!.createSVGPoint();
		pt.x = clientX;
		pt.y = clientY;
		const p = pt.matrixTransform(svg!.getScreenCTM()!.inverse());
		return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
	}

	function symbolSetzen(symbol: string, x: number, y: number) {
		const s = sicherstellen();
		merken();
		const el: SkizzenElement = { id: neueId(), art: 'symbol', symbol, x, y, winkel: 0, groesse: 1 };
		s.elemente.push(el);
		auswahl = el.id;
		werkzeug = 'auswahl';
	}

	/* ------------------------------------------------ Ziehen aus der Palette */

	let ziehen = $state<{ symbol: string; x: number; y: number; sx: number; sy: number; bewegt: boolean } | null>(null);

	function paletteDown(e: PointerEvent, symbol: string) {
		// Verhindert, dass der Browser beim Ziehen Text markiert
		e.preventDefault();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		ziehen = { symbol, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, bewegt: false };
	}
	function paletteMove(e: PointerEvent) {
		if (!ziehen) return;
		ziehen.x = e.clientX;
		ziehen.y = e.clientY;
		if (Math.hypot(e.clientX - ziehen.sx, e.clientY - ziehen.sy) > 6) ziehen.bewegt = true;
	}
	function paletteUp(e: PointerEvent) {
		if (!ziehen) return;
		const { symbol, bewegt } = ziehen;
		ziehen = null;
		// Schlauchleitung ist kein festes Zeichen: sie wird zwischen zwei Punkten gelegt
		if (symbol === 'schlauch') {
			werkzeugWaehlen('schlauch');
			const r = svg!.getBoundingClientRect();
			if (bewegt && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
				schlauchStart = schlauchZeiger = inSkizze(e.clientX, e.clientY);
			}
			return;
		}
		if (!bewegt) {
			// Antippen: Zeichen merken, nächster Tipp in die Skizze setzt es
			platzieren = platzieren === symbol ? null : symbol;
			auswahl = null;
			return;
		}
		const r = svg!.getBoundingClientRect();
		if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
			const p = inSkizze(e.clientX, e.clientY);
			symbolSetzen(symbol, p.x, p.y);
			platzieren = null;
		}
	}

	/* ------------------------------------------------ Zeichenfläche */

	type Aktion =
		| { art: 'verschieben'; id: string; dx: number; dy: number; start: { x: number; y: number }; punkte?: number[] }
		| { art: 'drehen'; id: string }
		| { art: 'ausleger'; id: string; px: number; py: number }
		| { art: 'groesse'; id: string; abstand: number; groesse: number }
		| { art: 'stift'; id: string }
		| { art: 'schwenken'; cx: number; cy: number; v0: Ansicht }
		| { art: 'schlauch-legen'; cx: number; cy: number }
		| { art: 'biegen'; id: string; start: { x: number; y: number }; index: number | null }
		| { art: 'punkt'; id: string; index: number };
	let aktion: Aktion | null = null;

	/* ------------------------------------------------ Schlauchleitungen */

	let schlauchStart = $state<{ x: number; y: number } | null>(null);
	let schlauchZeiger = $state<{ x: number; y: number } | null>(null);
	let letzterTipp = { id: '', index: -1, zeit: 0 };

	function werkzeugWaehlen(w: Werkzeug) {
		werkzeug = w;
		platzieren = null;
		schlauchStart = schlauchZeiger = null;
		if (w === 'schlauch') auswahl = null;
	}
	/** Leitung vom gemerkten Anfang bis hierher legen; zu kurze Leitungen werden nicht angelegt */
	function schlauchLegen(ende: { x: number; y: number }) {
		if (!schlauchStart || Math.hypot(ende.x - schlauchStart.x, ende.y - schlauchStart.y) < 8 / zoom) return false;
		const s = sicherstellen();
		merken();
		const el: SkizzenElement = { id: neueId(), art: 'schlauch', punkte: [schlauchStart.x, schlauchStart.y, ende.x, ende.y] };
		s.elemente.push(el);
		werkzeugWaehlen('auswahl');
		auswahl = el.id;
		return true;
	}
	function schlauchGerade() {
		if (gewaehlt?.art !== 'schlauch' || gewaehlt.punkte.length <= 4) return;
		merken();
		const p = gewaehlt.punkte;
		gewaehlt.punkte = [p[0], p[1], p[p.length - 2], p[p.length - 1]];
	}

	/* Zwei Finger: zoomen und verschieben; was der erste Finger begonnen hat, wird zurückgenommen */
	const zeiger = new Map<number, { x: number; y: number }>();
	let zwick: { d0: number; mx: number; my: number; v0: Ansicht } | null = null;
	function zwickStart() {
		const [a, b] = [...zeiger.values()];
		// Nur zurücknehmen, was schon im Verlauf gemerkt wurde
		const gemerkt = aktion && !(aktion.art === 'schwenken' || aktion.art === 'schlauch-legen' || (aktion.art === 'biegen' && aktion.index === null));
		if (gemerkt) rueckgaengig();
		if (aktion?.art === 'schlauch-legen') schlauchStart = schlauchZeiger = null;
		aktion = null;
		zwick = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v0: { ...ansicht } };
	}
	function zwickBewegen() {
		if (!zwick) return;
		const [a, b] = [...zeiger.values()];
		const { d0, mx, my, v0 } = zwick;
		const w = Math.min(SKIZZE_B, Math.max(SKIZZE_B / MAX_ZOOM, v0.w / (Math.hypot(a.x - b.x, a.y - b.y) / d0)));
		const { s, ox, oy } = abbildung(v0);
		// Punkt der Skizze unter der Mitte der Finger beim Start, er folgt der Fingermitte
		const px = v0.x + (mx - ox) / s, py = v0.y + (my - oy) / s;
		const s1 = (s * v0.w) / w;
		ansichtSetzen(px - ((a.x + b.x) / 2 - ox) / s1, py - ((a.y + b.y) / 2 - oy) / s1, w);
	}

	function svgDown(e: PointerEvent) {
		if (!svg || e.button === 2) return;
		// Jeder Zeiger wird festgehalten, damit sein Loslassen sicher ankommt
		zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
		try {
			svg.setPointerCapture(e.pointerId);
		} catch {
			/* Zeiger schon wieder weg */
		}
		if (zeiger.size === 2) {
			zwickStart();
			return;
		}
		if (zeiger.size > 2 || zwick) return;
		// Mittlere Maustaste verschiebt immer
		if (e.button === 1) {
			e.preventDefault();
			aktion = { art: 'schwenken', cx: e.clientX, cy: e.clientY, v0: { ...ansicht } };
			return;
		}
		const p = inSkizze(e.clientX, e.clientY);
		const ziel = e.target as Element;

		if (platzieren) {
			symbolSetzen(platzieren, p.x, p.y);
			platzieren = null;
			return;
		}

		// Griffe der gewählten Schlauchleitung: Punkt ziehen, doppelt antippen entfernt einen Knick
		const sgriff = ziel.closest('[data-schlauchgriff]');
		if (sgriff && gewaehlt?.art === 'schlauch') {
			if (sgriff.getAttribute('data-schlauchgriff') === 'verschieben') {
				merken();
				aktion = { art: 'verschieben', id: gewaehlt.id, dx: 0, dy: 0, start: p, punkte: [...gewaehlt.punkte] };
				return;
			}
			const index = Number(sgriff.getAttribute('data-index'));
			const n = gewaehlt.punkte.length / 2;
			const doppelt = letzterTipp.id === gewaehlt.id && letzterTipp.index === index && e.timeStamp - letzterTipp.zeit < 400;
			letzterTipp = { id: gewaehlt.id, index, zeit: e.timeStamp };
			if (doppelt && index > 0 && index < n - 1) {
				merken();
				gewaehlt.punkte.splice(index * 2, 2);
				return;
			}
			merken();
			aktion = { art: 'punkt', id: gewaehlt.id, index };
			return;
		}

		if (werkzeug === 'schlauch') {
			if (schlauchStart) {
				schlauchLegen(p);
			} else {
				// Anfang setzen; wird gleich gezogen, entsteht die Leitung beim Loslassen
				schlauchStart = schlauchZeiger = p;
				aktion = { art: 'schlauch-legen', cx: e.clientX, cy: e.clientY };
			}
			return;
		}

		const griff = ziel.closest('[data-griff]')?.getAttribute('data-griff');
		if (griff && gewaehlt && (gewaehlt.art === 'symbol' || gewaehlt.art === 'text')) {
			merken();
			if (griff === 'drehen') aktion = { art: 'drehen', id: gewaehlt.id };
			else if (griff === 'ausleger' && griffe?.ausleger) aktion = { art: 'ausleger', id: gewaehlt.id, px: griffe.ausleger.dreh.x, py: griffe.ausleger.dreh.y };
			else aktion = { art: 'groesse', id: gewaehlt.id, abstand: Math.max(8, Math.hypot(p.x - gewaehlt.x, p.y - gewaehlt.y)), groesse: gewaehlt.groesse };
			return;
		}

		if (werkzeug === 'stift') {
			const s = sicherstellen();
			merken();
			const el: SkizzenElement = { id: neueId(), art: 'linie', punkte: [p.x, p.y], farbe, breite: 4 };
			s.elemente.push(el);
			aktion = { art: 'stift', id: el.id };
			return;
		}
		if (werkzeug === 'text') {
			const s = sicherstellen();
			merken();
			const el: SkizzenElement = { id: neueId(), art: 'text', x: p.x, y: p.y, winkel: 0, groesse: 1, text: 'Text', farbe };
			s.elemente.push(el);
			auswahl = el.id;
			werkzeug = 'auswahl';
			setTimeout(() => textFeld?.select(), 0);
			return;
		}

		const id = ziel.closest('[data-id]')?.getAttribute('data-id') ?? null;
		auswahl = id;
		const el = wert?.elemente.find((x) => x.id === id);
		if (!el) {
			// Ins Leere gezogen: vergrößerte Skizze verschieben
			aktion = { art: 'schwenken', cx: e.clientX, cy: e.clientY, v0: { ...ansicht } };
			return;
		}
		if (el.art === 'schlauch') {
			// An der Leitung ziehen biegt sie: erst bei Bewegung entsteht dort ein neuer Punkt
			aktion = { art: 'biegen', id: el.id, start: p, index: null };
			return;
		}
		merken();
		if (el.art === 'linie') aktion = { art: 'verschieben', id: el.id, dx: 0, dy: 0, start: p, punkte: [...el.punkte] };
		else aktion = { art: 'verschieben', id: el.id, dx: el.x - p.x, dy: el.y - p.y, start: p };
	}

	function svgMove(e: PointerEvent) {
		if (zeiger.has(e.pointerId)) zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (zwick) {
			if (zeiger.size >= 2) zwickBewegen();
			return;
		}
		if (aktion?.art === 'schwenken') {
			const { s } = abbildung(aktion.v0);
			ansichtSetzen(aktion.v0.x - (e.clientX - aktion.cx) / s, aktion.v0.y - (e.clientY - aktion.cy) / s, aktion.v0.w);
			return;
		}
		// Gummiband vom Anfang der Schlauchleitung zum Zeiger, auch ohne gedrückte Taste
		if (werkzeug === 'schlauch' && schlauchStart) {
			schlauchZeiger = inSkizze(e.clientX, e.clientY);
			return;
		}
		if (!aktion || !wert || aktion.art === 'schlauch-legen') return;
		const p = inSkizze(e.clientX, e.clientY);
		const id = aktion.id;
		const el = wert.elemente.find((x) => x.id === id);
		if (!el) return;
		if (aktion.art === 'stift' && el.art === 'linie') {
			const n = el.punkte.length;
			if (Math.hypot(p.x - el.punkte[n - 2], p.y - el.punkte[n - 1]) > 3) el.punkte.push(p.x, p.y);
		} else if (aktion.art === 'biegen' && el.art === 'schlauch') {
			if (aktion.index === null) {
				if (Math.hypot(p.x - aktion.start.x, p.y - aktion.start.y) < 4 / zoom) return;
				merken();
				const abschnitt = naechsterAbschnitt(el.punkte, aktion.start.x, aktion.start.y);
				aktion.index = abschnitt + 1;
				el.punkte.splice(aktion.index * 2, 0, p.x, p.y);
			}
			el.punkte[aktion.index * 2] = p.x;
			el.punkte[aktion.index * 2 + 1] = p.y;
		} else if (aktion.art === 'punkt' && el.art === 'schlauch') {
			el.punkte[aktion.index * 2] = p.x;
			el.punkte[aktion.index * 2 + 1] = p.y;
		} else if (aktion.art === 'verschieben') {
			if ((el.art === 'linie' || el.art === 'schlauch') && aktion.punkte) {
				const dx = p.x - aktion.start.x, dy = p.y - aktion.start.y;
				el.punkte = aktion.punkte.map((v, i) => Math.round((v + (i % 2 ? dy : dx)) * 10) / 10);
			} else if (el.art === 'symbol' || el.art === 'text') {
				el.x = Math.round((p.x + aktion.dx) * 10) / 10;
				el.y = Math.round((p.y + aktion.dy) * 10) / 10;
			}
		} else if (aktion.art === 'drehen' && (el.art === 'symbol' || el.art === 'text')) {
			let w = (Math.atan2(p.y - el.y, p.x - el.x) * 180) / Math.PI + 90;
			const einrasten = Math.round(w / 45) * 45;
			if (Math.abs(w - einrasten) < 5) w = einrasten;
			el.winkel = Math.round(((w % 360) + 360) % 360);
		} else if (aktion.art === 'ausleger' && el.art === 'symbol') {
			// Winkel des Auslegers relativ zum Fahrzeug, rastet in 15°-Schritten
			let w = (Math.atan2(p.y - aktion.py, p.x - aktion.px) * 180) / Math.PI - el.winkel;
			const einrasten = Math.round(w / 15) * 15;
			if (Math.abs(w - einrasten) < 4) w = einrasten;
			el.ausleger = Math.round((((w + 180) % 360) + 360) % 360) - 180;
		} else if (aktion.art === 'groesse' && (el.art === 'symbol' || el.art === 'text')) {
			const faktor = Math.hypot(p.x - el.x, p.y - el.y) / aktion.abstand;
			el.groesse = Math.round(Math.min(6, Math.max(0.4, aktion.groesse * faktor)) * 100) / 100;
		}
	}

	function svgUp(e: PointerEvent) {
		zeiger.delete(e.pointerId);
		if (zwick) {
			// Erst wenn alle Finger weg sind, beginnt wieder eine neue Aktion
			if (zeiger.size === 0) zwick = null;
			return;
		}
		if (aktion?.art === 'schlauch-legen') {
			// Vom Anfang aus gezogen: Leitung bis hierher legen, sonst auf das Antippen des Endes warten
			if (Math.hypot(e.clientX - aktion.cx, e.clientY - aktion.cy) > 10) schlauchLegen(inSkizze(e.clientX, e.clientY));
		}
		if (aktion?.art === 'stift' && wert) {
			const id = aktion.id;
			const el = wert.elemente.find((x) => x.id === id);
			// Einzelner Punkt: kleinen Strich daraus machen
			if (el?.art === 'linie' && el.punkte.length === 2) el.punkte.push(el.punkte[0] + 0.5, el.punkte[1] + 0.5);
		}
		aktion = null;
	}

	/* ------------------------------------------------ Werkzeugleiste */

	function loeschen() {
		if (!wert || !auswahl) return;
		merken();
		wert.elemente = wert.elemente.filter((e) => e.id !== auswahl);
		auswahl = null;
	}
	function drehen(grad: number) {
		if (!gewaehlt || gewaehlt.art === 'linie' || gewaehlt.art === 'schlauch') return;
		merken();
		gewaehlt.winkel = (((gewaehlt.winkel + grad) % 360) + 360) % 360;
	}
	function skalieren(faktor: number) {
		if (!gewaehlt || gewaehlt.art === 'linie' || gewaehlt.art === 'schlauch') return;
		merken();
		gewaehlt.groesse = Math.round(Math.min(6, Math.max(0.4, gewaehlt.groesse * faktor)) * 100) / 100;
	}
	function auslegerDrehen(grad: number) {
		if (gewaehlt?.art !== 'symbol' || !gewaehltDef?.ausleger) return;
		merken();
		const w = (gewaehlt.ausleger ?? gewaehltDef.ausleger.winkel) + grad;
		gewaehlt.ausleger = ((((w + 180) % 360) + 360) % 360) - 180;
	}
	const vorschlaege = (f: Feld) => (f.funk ? funknamen : (f.vorschlaege ?? []));
	const feldWert = (f: Feld) => (gewaehlt?.art === 'symbol' ? (gewaehlt.felder?.[f.key] ?? f.vorgabe ?? '') : '');
	function feldSetzen(key: string, inhalt: string) {
		if (gewaehlt?.art !== 'symbol') return;
		gewaehlt.felder = { ...(gewaehlt.felder ?? {}), [key]: inhalt };
	}
	function farbeSetzen(f: string) {
		farbe = f;
		if (gewaehlt && (gewaehlt.art === 'text' || gewaehlt.art === 'linie')) {
			merken();
			gewaehlt.farbe = f;
		}
	}
	function karteUebernehmen(k: SkizzenKarte) {
		const s = sicherstellen();
		merken();
		s.karte = k;
		// Nordpfeil links oben, gegen die Drehung des Ausschnitts gedreht; bei neuem Ausschnitt nur nachführen
		const winkel = (((-(k.drehung ?? 0)) % 360) + 360) % 360;
		const nord = s.elemente.find((e) => e.art === 'symbol' && e.symbol === 'nord' && e.auto);
		if (nord && nord.art === 'symbol') nord.winkel = winkel;
		else s.elemente.push({ id: neueId(), art: 'symbol', symbol: 'nord', x: 55, y: 60, winkel, groesse: 1.4, auto: true });
		karteOffen = false;
	}
	function karteEntfernen() {
		if (!wert?.karte) return;
		merken();
		wert.karte = null;
	}

	function taste(e: KeyboardEvent) {
		const imFeld = (e.target as Element).closest('input, textarea, select');
		if (imFeld) return;
		if ((e.key === 'Delete' || e.key === 'Backspace') && auswahl) {
			e.preventDefault();
			loeschen();
		} else if (e.key === 'Escape') {
			// Erst Schlauch legen, Auswahl oder Setzen abbrechen, beim nächsten Esc das Vollbild verlassen
			if (werkzeug === 'schlauch') {
				werkzeugWaehlen('auswahl');
				return;
			}
			if (vollbild && !auswahl && !platzieren) vollbildAus();
			auswahl = null;
			platzieren = null;
		} else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
			e.preventDefault();
			rueckgaengig();
		} else if (vollbild && (e.key === '+' || e.key === '=')) {
			zoomen(1.4);
		} else if (vollbild && e.key === '-') {
			zoomen(1 / 1.4);
		} else if (vollbild && e.key === '0') {
			ansicht = { ...GANZ };
		}
	}

	/**
	 * Griffe zum Drehen und Vergrößern, bei Kran und Leiter auch für den Ausleger, in Skizzen-Koordinaten.
	 * Abstände durch den Zoom geteilt, damit die Griffe am Bildschirm gleich groß bleiben.
	 */
	const griffe = $derived.by(() => {
		if (!gewaehlt || gewaehlt.art === 'linie' || gewaehlt.art === 'schlauch') return null;
		const d = gewaehlt.art === 'symbol' ? SYMBOL[gewaehlt.symbol] : null;
		const b = gewaehlt.art === 'text' ? Math.max(60, gewaehlt.text.length * 13) : (d?.b ?? 48) * MASS;
		const h = gewaehlt.art === 'text' ? 32 : (d?.h ?? 32) * MASS;
		const g = gewaehlt.groesse;
		const hw = (b / 2) * g + 6 / zoom, hh = (h / 2) * g + 6 / zoom;
		const a = (gewaehlt.winkel * Math.PI) / 180;
		const dreh = (x: number, y: number) => ({ x: gewaehlt.x + x * Math.cos(a) - y * Math.sin(a), y: gewaehlt.y + x * Math.sin(a) + y * Math.cos(a) });
		const ecken = [dreh(-hw, -hh), dreh(hw, -hh), dreh(hw, hh), dreh(-hw, hh)];
		let ausleger: { dreh: { x: number; y: number }; spitze: { x: number; y: number } } | null = null;
		if (d?.ausleger && gewaehlt.art === 'symbol') {
			const au = d.ausleger, w = ((gewaehlt.ausleger ?? au.winkel) * Math.PI) / 180;
			const inSkizze = (x: number, y: number) => dreh((x - d.b / 2) * MASS * g, (y - d.h / 2) * MASS * g);
			ausleger = {
				dreh: inSkizze(au.x, au.y),
				spitze: inSkizze(au.x + (au.laenge + 9) * Math.cos(w), au.y + (au.laenge + 9) * Math.sin(w))
			};
		}
		return { ecken, drehen: dreh(0, -hh - 30 / zoom), oben: dreh(0, -hh), groesse: ecken[2], ausleger };
	});
</script>

<svelte:window onkeydown={taste} />

<div class="skizze-editor select-none" class:vollbild bind:this={editorEl}>
	<!-- Werkzeugleiste -->
	<div class="flex flex-wrap items-center gap-2">
		<button type="button" class="btn" onclick={() => (karteOffen = true)}>
			<MapPinned size={18} aria-hidden="true" />{wert?.karte ? 'Anderen Ausschnitt wählen' : 'Kartenausschnitt wählen'}
		</button>
		{#if wert?.karte}
			<button type="button" class="btn btn-ruhig" onclick={karteEntfernen}><MapOff size={18} aria-hidden="true" />Karte entfernen</button>
		{/if}
		<span class="mx-1 hidden h-8 w-px bg-line sm:block" aria-hidden="true"></span>
		<div class="flex rounded-lg bg-surface-3 p-1" role="group" aria-label="Werkzeug">
			{#each [['auswahl', 'Auswählen', MousePointer2], ['schlauch', 'Schlauch', Spline], ['stift', 'Stift', Pencil], ['text', 'Text', Type]] as const as [w, name, Icon] (w)}
				<button
					type="button"
					class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold"
					class:bg-surface={werkzeug === w}
					style:box-shadow={werkzeug === w ? 'var(--shadow-1)' : undefined}
					aria-pressed={werkzeug === w}
					onclick={() => werkzeugWaehlen(w)}
				><Icon size={16} aria-hidden="true" />{name}</button>
			{/each}
		</div>
		<div class="flex gap-1" role="group" aria-label="Farbe">
			{#each FARBEN as f (f.wert)}
				<button
					type="button"
					class="size-8 rounded-full border-2"
					style:background={f.wert}
					style:border-color={farbe === f.wert ? 'var(--c-focus)' : 'transparent'}
					style:outline={farbe === f.wert ? '2px solid var(--c-surface)' : undefined}
					style:outline-offset="-4px"
					aria-label="Farbe {f.name}"
					aria-pressed={farbe === f.wert}
					onclick={() => farbeSetzen(f.wert)}
				></button>
			{/each}
		</div>
		<button type="button" class="btn btn-ruhig px-3" onclick={rueckgaengig} title="Rückgängig (Strg+Z)"><Undo2 size={18} aria-hidden="true" />Rückgängig</button>
		{#if vollbild}
			<button type="button" class="btn btn-primary ml-auto" onclick={vollbildAus}><Minimize2 size={18} aria-hidden="true" />Fertig</button>
		{:else}
			<button type="button" class="btn ml-auto" onclick={vollbildAn}><Maximize2 size={18} aria-hidden="true" />Vollbild</button>
		{/if}
	</div>

	<!-- Leiste für das gewählte Element; bleibt immer stehen, damit die Skizze beim Antippen nicht springt -->
	<div class="mt-2 rounded-xl bg-surface-2 p-2">
		{#if !gewaehlt}
			<p class="flex min-h-9 items-center px-2 text-sm text-ink-3">Zeichen, Text oder Leitung antippen, um sie zu bearbeiten.</p>
		{:else}
			<div class="flex flex-wrap items-center gap-2">
				<span class="px-2 text-sm font-semibold text-ink-2">
					{gewaehltDef ? gewaehltDef.name : gewaehlt.art === 'text' ? 'Text' : gewaehlt.art === 'schlauch' ? 'Schlauchleitung' : 'Linie'}
				</span>
				{#if gewaehlt.art === 'text'}
					<input bind:this={textFeld} class="input min-h-9 w-48 py-1" bind:value={gewaehlt.text} aria-label="Beschriftung" />
				{/if}
				{#if gewaehlt.art === 'schlauch'}
					{@const schlauch = gewaehlt}
					<div class="flex rounded-lg bg-surface-3 p-1" role="group" aria-label="Größe der Schlauchleitung">
						{#each ['', 'B', 'C'] as k (k)}
							<button
								type="button"
								class="min-w-10 rounded-md px-2.5 py-1 text-sm font-bold"
								class:bg-surface={(schlauch.groesse ?? '') === k}
								style:box-shadow={(schlauch.groesse ?? '') === k ? 'var(--shadow-1)' : undefined}
								aria-pressed={(schlauch.groesse ?? '') === k}
								onclick={() => { merken(); schlauch.groesse = k || undefined; }}
							>{k || 'ohne'}</button>
						{/each}
					</div>
					{#if schlauch.punkte.length > 4}
						<button type="button" class="btn btn-ruhig min-h-9 px-3" onclick={schlauchGerade}>Gerade ziehen</button>
					{/if}
					<span class="hidden text-sm text-ink-3 xl:inline">An der Leitung ziehen biegt sie, Punkt doppelt antippen entfernt den Knick.</span>
				{/if}
				{#if gewaehlt.art === 'symbol' || gewaehlt.art === 'text'}
					<button type="button" class="btn btn-ruhig min-h-9 px-2" onclick={() => drehen(-15)} aria-label="Nach links drehen"><RotateCcw size={18} /></button>
					<button type="button" class="btn btn-ruhig min-h-9 px-2" onclick={() => drehen(15)} aria-label="Nach rechts drehen"><RotateCw size={18} /></button>
					<button type="button" class="btn btn-ruhig min-h-9 px-2" onclick={() => skalieren(1 / 1.2)} aria-label="Kleiner"><Minus size={18} /></button>
					<button type="button" class="btn btn-ruhig min-h-9 px-2" onclick={() => skalieren(1.2)} aria-label="Größer"><Plus size={18} /></button>
				{/if}
				{#if gewaehltDef?.ausleger}
					<span class="flex items-center gap-1 rounded-lg bg-surface-3 py-0.5 pr-0.5 pl-2.5 text-sm font-semibold text-ink-2">
						Ausleger
						<button type="button" class="btn btn-ruhig min-h-8 px-1.5" onclick={() => auslegerDrehen(-15)} aria-label="Ausleger nach links drehen"><RotateCcw size={16} /></button>
						<button type="button" class="btn btn-ruhig min-h-8 px-1.5" onclick={() => auslegerDrehen(15)} aria-label="Ausleger nach rechts drehen"><RotateCw size={16} /></button>
					</span>
				{/if}
				<button type="button" class="btn btn-gefahr min-h-9 px-3" onclick={loeschen}><Trash2 size={18} aria-hidden="true" />Entfernen</button>
			</div>
			{#if gewaehlt.art === 'symbol' && gewaehltDef?.felder}
				<div class="mt-2 flex flex-wrap items-end gap-3 border-t border-line pt-2">
					{#each gewaehltDef.felder as f (f.key)}
						{#if f.knoepfe}
							<div class="flex items-center gap-2" role="group" aria-label={f.name}>
								<span class="text-sm font-semibold text-ink-2">{f.name}</span>
								<div class="flex rounded-lg bg-surface-3 p-1">
									{#each ['', ...f.knoepfe] as k (k)}
										<button
											type="button"
											class="min-w-10 rounded-md px-2.5 py-1 text-sm font-bold"
											class:bg-surface={feldWert(f) === k}
											style:box-shadow={feldWert(f) === k ? 'var(--shadow-1)' : undefined}
											aria-pressed={feldWert(f) === k}
											onclick={() => { merken(); feldSetzen(f.key, k); }}
										>{k || 'ohne'}</button>
									{/each}
								</div>
							</div>
						{:else}
							<label class="block">
								<span class="text-xs font-semibold text-ink-2">{f.name}</span>
								<input
									class="input min-h-9 py-1 {f.zahl ? 'w-28' : 'w-52'}"
									value={feldWert(f)}
									list="{uid}-{f.funk ? 'funk' : f.key}"
									inputmode={f.zahl ? 'numeric' : undefined}
									autocomplete="off"
									onfocus={merken}
									oninput={(e) => feldSetzen(f.key, e.currentTarget.value)}
								/>
							</label>
							<datalist id="{uid}-{f.funk ? 'funk' : f.key}">
								{#each vorschlaege(f) as v (v)}<option value={v}></option>{/each}
							</datalist>
						{/if}
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	<div class="arbeitsbereich mt-3 grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
		<!-- Zeichen nach ÖBFV RL E-27 als Palette -->
		<div class="palette-spalte min-w-0">
			<div class="mb-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
				<label class="relative block">
					<Search size={16} class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
					<input type="search" class="input min-h-10 py-1 pl-8" placeholder="Zeichen suchen" bind:value={suche} aria-label="Zeichen suchen" />
				</label>
				<select class="input min-h-10 py-1" bind:value={gruppe} aria-label="Gruppe" disabled={!!suche.trim()}>
					<option value="blatt">Aufnahmeblatt</option>
					{#each GRUPPEN as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
				</select>
			</div>
			<div class="palette" role="group" aria-label="Zeichen zum Einsetzen">
				{#each palette as s (s.id)}
					<button
						type="button"
						class="zeichen"
						class:aktiv={platzieren === s.id}
						title={s.name}
						onpointerdown={(e) => paletteDown(e, s.id)}
						onpointermove={paletteMove}
						onpointerup={paletteUp}
						onpointercancel={() => (ziehen = null)}
					>
						<svg viewBox={s.vb.join(' ')} class="h-8 w-12 shrink-0" aria-hidden="true">{@html zeichnen(s)}</svg>
						<span class="text-left text-[0.8rem] leading-tight">{s.name}</span>
					</button>
				{:else}
					<p class="hinweis px-1">Kein Zeichen gefunden.</p>
				{/each}
			</div>
		</div>

		<div class="flaeche-spalte min-w-0">
			{#if platzieren}
				<p class="mb-2 rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
					In die Skizze tippen, um „{SYMBOL[platzieren].name}“ zu setzen. Esc bricht ab.
				</p>
			{:else if werkzeug === 'schlauch'}
				<p class="mb-2 rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
					{schlauchStart
						? 'Jetzt das Ende der Schlauchleitung antippen. Esc bricht ab.'
						: 'Schlauchleitung legen: Anfang antippen, dann das Ende. Oder vom Anfang zum Ende ziehen.'}
				</p>
			{:else}
				<p class="hinweis allgemein mb-2">
					Zeichen aus der Liste in die Skizze ziehen oder antippen und dann in die Skizze tippen. Zum Drehen und Vergrößern die Griffe am gewählten Zeichen ziehen,
					bei Kran und Drehleiter dreht der orange Griff den Ausleger. Zoomen mit zwei Fingern, Strg + Mausrad oder den Knöpfen unten rechts.
				</p>
			{/if}
			<div
				bind:this={flaeche}
				class="zeichenflaeche"
				class:stift={werkzeug === 'stift' || werkzeug === 'schlauch'}
				class:setzen={!!platzieren || werkzeug === 'text'}
				class:schwenkbar={zoom > 1}
				onpointerdown={svgDown}
				onpointermove={svgMove}
				onpointerup={svgUp}
				onpointercancel={svgUp}
				role="application"
				aria-label="Skizzenfeld"
			>
				<SkizzeSvg skizze={wert} modus="editor" {auswahl} {ansicht} bind:svg>
					{#if schlauchStart && schlauchZeiger}
						<!-- Vorschau der Leitung, solange das Ende noch fehlt -->
						<line x1={schlauchStart.x} y1={schlauchStart.y} x2={schlauchZeiger.x} y2={schlauchZeiger.y} stroke="#1a1a1a" stroke-width="2.6" stroke-dasharray="{8 / zoom} {6 / zoom}" pointer-events="none" />
						<circle cx={schlauchStart.x} cy={schlauchStart.y} r={6 / zoom} fill="#1f5fa8" pointer-events="none" />
					{/if}
					{#if gewaehlt?.art === 'schlauch'}
						{@const z = zoom}
						{@const n = gewaehlt.punkte.length / 2}
						{@const m = schlauchMitte(gewaehlt.punkte)}
						{@const mw = (m.winkel * Math.PI) / 180}
						{@const gx = m.x - Math.sin(mw) * (30 / z)}
						{@const gy = m.y + Math.cos(mw) * (30 / z)}
						<!-- Ganze Leitung verschieben; liegt gegenüber der Beschriftung B oder C -->
						<g data-schlauchgriff="verschieben" class="cursor-move">
							<circle cx={gx} cy={gy} r={13 / z} fill="#1f5fa8" stroke="#fff" stroke-width={2 / z} />
							<path
								d="M12 4v16 M4 12h16 M9 7l3-3 3 3 M9 17l3 3 3-3 M7 9l-3 3 3 3 M17 9l3 3-3 3"
								transform="translate({gx - 9 / z} {gy - 9 / z}) scale({0.75 / z})"
								fill="none"
								stroke="#fff"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								pointer-events="none"
							/>
						</g>
						<!-- Punkte der Leitung: Enden gefüllt, Knicke hohl -->
						{#each { length: n } as _, i (i)}
							<circle
								data-schlauchgriff="punkt"
								data-index={i}
								cx={gewaehlt.punkte[i * 2]}
								cy={gewaehlt.punkte[i * 2 + 1]}
								r={(i === 0 || i === n - 1 ? 9 : 7.5) / z}
								fill={i === 0 || i === n - 1 ? '#1f5fa8' : '#fff'}
								stroke={i === 0 || i === n - 1 ? '#fff' : '#1f5fa8'}
								stroke-width={2.5 / z}
								class="cursor-grab"
							/>
						{/each}
					{/if}
					{#if griffe}
						{@const z = zoom}
						<polygon points={griffe.ecken.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1f5fa8" stroke-width={2 / z} stroke-dasharray="{6 / z} {4 / z}" pointer-events="none" />
						<line x1={griffe.oben.x} y1={griffe.oben.y} x2={griffe.drehen.x} y2={griffe.drehen.y} stroke="#1f5fa8" stroke-width={2 / z} pointer-events="none" />
						<circle data-griff="drehen" cx={griffe.drehen.x} cy={griffe.drehen.y} r={11 / z} fill="#fff" stroke="#1f5fa8" stroke-width={3 / z} class="cursor-grab" />
						<rect data-griff="groesse" x={griffe.groesse.x - 10 / z} y={griffe.groesse.y - 10 / z} width={20 / z} height={20 / z} fill="#1f5fa8" stroke="#fff" stroke-width={2 / z} class="cursor-nwse-resize" />
						{#if griffe.ausleger}
							<line x1={griffe.ausleger.dreh.x} y1={griffe.ausleger.dreh.y} x2={griffe.ausleger.spitze.x} y2={griffe.ausleger.spitze.y} stroke="#e8710a" stroke-width={2 / z} stroke-dasharray="{4 / z} {4 / z}" pointer-events="none" />
							<circle data-griff="ausleger" cx={griffe.ausleger.spitze.x} cy={griffe.ausleger.spitze.y} r={10 / z} fill="#e8710a" stroke="#fff" stroke-width={3 / z} class="cursor-grab" />
						{/if}
					{/if}
				</SkizzeSvg>

				<!-- Zoom: eigene Knöpfe, damit es auch ohne Mausrad und Zwei-Finger-Geste geht -->
				<div class="zoomleiste" role="group" aria-label="Zoom" onpointerdown={(e) => e.stopPropagation()}>
					<button type="button" onclick={() => zoomen(1 / 1.4)} disabled={zoom <= 1} aria-label="Verkleinern"><ZoomOut size={18} /></button>
					<button type="button" class="prozent tabular" onclick={() => (ansicht = { ...GANZ })} title="Ganze Skizze anzeigen">{Math.round(zoom * 100)} %</button>
					<button type="button" onclick={() => zoomen(1.4)} disabled={zoom >= MAX_ZOOM - 0.01} aria-label="Vergrößern"><ZoomIn size={18} /></button>
				</div>
			</div>
		</div>
	</div>

	{#if ziehen?.bewegt}
		<!-- Zeichen am Finger beim Ziehen (innerhalb des Editors, damit es auch im Vollbild sichtbar ist) -->
		<svg viewBox={SYMBOL[ziehen.symbol].vb.join(' ')} class="pointer-events-none fixed z-[70] h-14 w-20 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg" style:left="{ziehen.x}px" style:top="{ziehen.y}px" aria-hidden="true">
			{@html zeichnen(SYMBOL[ziehen.symbol])}
		</svg>
	{/if}

	{#if karteOffen}
		<KarteWaehlen {einsatzort} alteKarte={wert?.karte ?? null} uebernehmen={karteUebernehmen} schliessen={() => (karteOffen = false)} />
	{/if}
</div>

<style>
	.palette {
		display: flex;
		gap: 0.375rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}
	@media (min-width: 1024px) {
		.palette {
			flex-direction: column;
			max-height: min(78vh, 60rem);
			overflow-x: visible;
			overflow-y: auto;
			padding-right: 0.25rem;
		}
	}
	.zeichen {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0.3rem 0.6rem 0.3rem 0.35rem;
		border: 1px solid var(--c-line-strong);
		border-radius: var(--radius-field);
		background: #fff;
		color: #111;
		touch-action: none;
		max-width: 15rem;
	}
	.zeichen:hover {
		border-color: var(--c-ink-3);
	}
	.zeichen.aktiv {
		border-color: var(--c-red);
		box-shadow: 0 0 0 1px var(--c-red);
	}
	@media (max-width: 1023px) {
		.zeichen span {
			display: none;
		}
	}
	.zeichenflaeche {
		position: relative;
		max-width: calc(min(78vh, 60rem) * 1000 / 1380);
		margin-inline: auto;
		border: 1px solid var(--c-line-strong);
		border-radius: 8px;
		overflow: hidden;
		touch-action: none;
		cursor: default;
	}
	.zeichenflaeche.schwenkbar {
		cursor: grab;
	}
	.zeichenflaeche.stift {
		cursor: crosshair;
	}
	.zeichenflaeche.setzen {
		cursor: copy;
	}

	.zoomleiste {
		position: absolute;
		right: 0.6rem;
		bottom: 0.6rem;
		display: flex;
		overflow: hidden;
		border-radius: 8px;
		background: rgb(10 10 10 / 0.86);
		color: #fff;
		cursor: default;
	}
	.zoomleiste button {
		display: grid;
		place-items: center;
		min-width: 2.75rem;
		height: 2.75rem;
		padding: 0 0.5rem;
		font-size: 0.875rem;
		font-weight: 700;
	}
	.zoomleiste button:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.12);
	}
	.zoomleiste button:disabled {
		opacity: 0.35;
	}
	.zoomleiste .prozent {
		min-width: 4rem;
		border-inline: 1px solid rgb(255 255 255 / 0.15);
	}

	/* Vollbild: Editor über die ganze Seite, die Skizze füllt den freien Platz */
	.skizze-editor.vollbild {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom))
			max(0.75rem, env(safe-area-inset-left));
		background: var(--c-bg);
		color: var(--c-ink);
	}
	.vollbild .arbeitsbereich {
		flex: 1;
		min-height: 0;
		grid-template-rows: auto minmax(0, 1fr);
	}
	.vollbild .flaeche-spalte {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.vollbild .allgemein {
		display: none;
	}
	.vollbild .zeichenflaeche {
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: none;
		background: var(--c-surface-3);
	}
	.vollbild .zeichenflaeche :global(svg) {
		width: 100%;
		height: 100%;
	}
	@media (min-width: 1024px) {
		.vollbild .arbeitsbereich {
			grid-template-rows: minmax(0, 1fr);
		}
		.vollbild .palette-spalte {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
		.vollbild .palette {
			flex: 1;
			min-height: 0;
			max-height: none;
		}
	}
</style>
