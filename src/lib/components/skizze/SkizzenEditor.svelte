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
	import SkizzeSvg from './SkizzeSvg.svelte';
	import KarteWaehlen from './KarteWaehlen.svelte';
	import { GRUPPEN, LEGENDE, MASS, SYMBOL, SYMBOLE, zeichnen, type Feld } from '$lib/berichte/legende';
	import type { BerichtTyp, Skizze, SkizzenElement, SkizzenKarte } from '$lib/berichte/typen';

	let {
		wert = $bindable(),
		typ,
		einsatzort,
		funknamen = []
	}: { wert: Skizze | null; typ: BerichtTyp; einsatzort: string; funknamen?: string[] } = $props();

	const uid = $props.id();

	type Werkzeug = 'auswahl' | 'stift' | 'text';
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
		| { art: 'stift'; id: string };
	let aktion: Aktion | null = null;

	function svgDown(e: PointerEvent) {
		if (!svg || e.button > 0) return;
		const p = inSkizze(e.clientX, e.clientY);
		const ziel = e.target as Element;

		if (platzieren) {
			symbolSetzen(platzieren, p.x, p.y);
			platzieren = null;
			return;
		}

		const griff = ziel.closest('[data-griff]')?.getAttribute('data-griff');
		if (griff && gewaehlt && gewaehlt.art !== 'linie') {
			svg.setPointerCapture(e.pointerId);
			merken();
			if (griff === 'drehen') aktion = { art: 'drehen', id: gewaehlt.id };
			else if (griff === 'ausleger' && griffe?.ausleger) aktion = { art: 'ausleger', id: gewaehlt.id, px: griffe.ausleger.dreh.x, py: griffe.ausleger.dreh.y };
			else aktion = { art: 'groesse', id: gewaehlt.id, abstand: Math.max(8, Math.hypot(p.x - gewaehlt.x, p.y - gewaehlt.y)), groesse: gewaehlt.groesse };
			return;
		}

		if (werkzeug === 'stift') {
			const s = sicherstellen();
			merken();
			svg.setPointerCapture(e.pointerId);
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
		if (!el) return;
		svg.setPointerCapture(e.pointerId);
		merken();
		if (el.art === 'linie') aktion = { art: 'verschieben', id: el.id, dx: 0, dy: 0, start: p, punkte: [...el.punkte] };
		else aktion = { art: 'verschieben', id: el.id, dx: el.x - p.x, dy: el.y - p.y, start: p };
	}

	function svgMove(e: PointerEvent) {
		if (!aktion || !wert) return;
		const p = inSkizze(e.clientX, e.clientY);
		const el = wert.elemente.find((x) => x.id === aktion!.id);
		if (!el) return;
		if (aktion.art === 'stift' && el.art === 'linie') {
			const n = el.punkte.length;
			if (Math.hypot(p.x - el.punkte[n - 2], p.y - el.punkte[n - 1]) > 3) el.punkte.push(p.x, p.y);
		} else if (aktion.art === 'verschieben') {
			if (el.art === 'linie' && aktion.punkte) {
				const dx = p.x - aktion.start.x, dy = p.y - aktion.start.y;
				el.punkte = aktion.punkte.map((v, i) => Math.round((v + (i % 2 ? dy : dx)) * 10) / 10);
			} else if (el.art !== 'linie') {
				el.x = Math.round((p.x + aktion.dx) * 10) / 10;
				el.y = Math.round((p.y + aktion.dy) * 10) / 10;
			}
		} else if (aktion.art === 'drehen' && el.art !== 'linie') {
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
		} else if (aktion.art === 'groesse' && el.art !== 'linie') {
			const faktor = Math.hypot(p.x - el.x, p.y - el.y) / aktion.abstand;
			el.groesse = Math.round(Math.min(6, Math.max(0.4, aktion.groesse * faktor)) * 100) / 100;
		}
	}

	function svgUp() {
		if (aktion?.art === 'stift' && wert) {
			const el = wert.elemente.find((x) => x.id === aktion!.id);
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
		if (!gewaehlt || gewaehlt.art === 'linie') return;
		merken();
		gewaehlt.winkel = (((gewaehlt.winkel + grad) % 360) + 360) % 360;
	}
	function skalieren(faktor: number) {
		if (!gewaehlt || gewaehlt.art === 'linie') return;
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
		else s.elemente.push({ id: neueId(), art: 'symbol', symbol: 'nord', x: 42, y: 62, winkel, groesse: 1.1, auto: true });
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
			auswahl = null;
			platzieren = null;
		} else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
			e.preventDefault();
			rueckgaengig();
		}
	}

	/** Griffe zum Drehen und Vergrößern, bei Kran und Leiter auch für den Ausleger, in Skizzen-Koordinaten */
	const griffe = $derived.by(() => {
		if (!gewaehlt || gewaehlt.art === 'linie') return null;
		const d = gewaehlt.art === 'symbol' ? SYMBOL[gewaehlt.symbol] : null;
		const b = gewaehlt.art === 'text' ? Math.max(60, gewaehlt.text.length * 13) : (d?.b ?? 48) * MASS;
		const h = gewaehlt.art === 'text' ? 32 : (d?.h ?? 32) * MASS;
		const g = gewaehlt.groesse;
		const hw = (b / 2) * g + 6, hh = (h / 2) * g + 6;
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
		return { ecken, drehen: dreh(0, -hh - 30), oben: dreh(0, -hh), groesse: ecken[2], ausleger };
	});
</script>

<svelte:window onkeydown={taste} />

<div class="skizze-editor select-none">
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
			{#each [['auswahl', 'Auswählen', MousePointer2], ['stift', 'Stift', Pencil], ['text', 'Text', Type]] as const as [w, name, Icon] (w)}
				<button
					type="button"
					class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold"
					class:bg-surface={werkzeug === w}
					style:box-shadow={werkzeug === w ? 'var(--shadow-1)' : undefined}
					aria-pressed={werkzeug === w}
					onclick={() => { werkzeug = w; platzieren = null; }}
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
	</div>

	{#if gewaehlt}
		<div class="mt-2 rounded-xl bg-surface-2 p-2">
			<div class="flex flex-wrap items-center gap-2">
				<span class="px-2 text-sm font-semibold text-ink-2">
					{gewaehltDef ? gewaehltDef.name : gewaehlt.art === 'text' ? 'Text' : 'Linie'}
				</span>
				{#if gewaehlt.art === 'text'}
					<input bind:this={textFeld} class="input min-h-9 w-48 py-1" bind:value={gewaehlt.text} aria-label="Beschriftung" />
				{/if}
				{#if gewaehlt.art !== 'linie'}
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
		</div>
	{/if}

	<div class="mt-3 grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
		<!-- Zeichen nach ÖBFV RL E-27 als Palette -->
		<div class="min-w-0">
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

		<div>
			{#if platzieren}
				<p class="mb-2 rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
					In die Skizze tippen, um „{SYMBOL[platzieren].name}“ zu setzen. Esc bricht ab.
				</p>
			{:else}
				<p class="hinweis mb-2">
					Zeichen aus der Liste in die Skizze ziehen oder antippen und dann in die Skizze tippen. Zum Drehen und Vergrößern die Griffe am gewählten Zeichen ziehen,
					bei Kran und Drehleiter dreht der orange Griff den Ausleger.
				</p>
			{/if}
			<div
				class="zeichenflaeche"
				class:stift={werkzeug === 'stift'}
				class:setzen={!!platzieren || werkzeug === 'text'}
				onpointerdown={svgDown}
				onpointermove={svgMove}
				onpointerup={svgUp}
				onpointercancel={svgUp}
				role="application"
				aria-label="Skizzenfeld"
			>
				<SkizzeSvg skizze={wert} modus="editor" {auswahl} bind:svg>
					{#if griffe}
						<polygon points={griffe.ecken.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1f5fa8" stroke-width="2" stroke-dasharray="6 4" pointer-events="none" />
						<line x1={griffe.oben.x} y1={griffe.oben.y} x2={griffe.drehen.x} y2={griffe.drehen.y} stroke="#1f5fa8" stroke-width="2" pointer-events="none" />
						<circle data-griff="drehen" cx={griffe.drehen.x} cy={griffe.drehen.y} r="11" fill="#fff" stroke="#1f5fa8" stroke-width="3" class="cursor-grab" />
						<rect data-griff="groesse" x={griffe.groesse.x - 10} y={griffe.groesse.y - 10} width="20" height="20" fill="#1f5fa8" stroke="#fff" stroke-width="2" class="cursor-nwse-resize" />
						{#if griffe.ausleger}
							<line x1={griffe.ausleger.dreh.x} y1={griffe.ausleger.dreh.y} x2={griffe.ausleger.spitze.x} y2={griffe.ausleger.spitze.y} stroke="#e8710a" stroke-width="2" stroke-dasharray="4 4" pointer-events="none" />
							<circle data-griff="ausleger" cx={griffe.ausleger.spitze.x} cy={griffe.ausleger.spitze.y} r="10" fill="#e8710a" stroke="#fff" stroke-width="3" class="cursor-grab" />
						{/if}
					{/if}
				</SkizzeSvg>
			</div>
		</div>
	</div>
</div>

{#if ziehen?.bewegt}
	<!-- Zeichen am Finger beim Ziehen -->
	<svg viewBox={SYMBOL[ziehen.symbol].vb.join(' ')} class="pointer-events-none fixed z-50 h-14 w-20 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg" style:left="{ziehen.x}px" style:top="{ziehen.y}px" aria-hidden="true">
		{@html zeichnen(SYMBOL[ziehen.symbol])}
	</svg>
{/if}

{#if karteOffen}
	<KarteWaehlen {einsatzort} alteKarte={wert?.karte ?? null} uebernehmen={karteUebernehmen} schliessen={() => (karteOffen = false)} />
{/if}

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
		border: 1.5px solid var(--c-line);
		border-radius: 10px;
		background: #fff;
		color: #1d2b3a;
		touch-action: none;
		max-width: 15rem;
	}
	.zeichen:hover {
		border-color: var(--c-ink-3);
	}
	.zeichen.aktiv {
		border-color: var(--c-focus);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-focus) 25%, transparent);
	}
	@media (max-width: 1023px) {
		.zeichen span {
			display: none;
		}
	}
	.zeichenflaeche {
		max-width: calc(min(78vh, 60rem) * 1000 / 1380);
		margin-inline: auto;
		border: 1px solid var(--c-line-strong);
		border-radius: 8px;
		overflow: hidden;
		touch-action: none;
		cursor: default;
	}
	.zeichenflaeche.stift {
		cursor: crosshair;
	}
	.zeichenflaeche.setzen {
		cursor: copy;
	}
</style>
