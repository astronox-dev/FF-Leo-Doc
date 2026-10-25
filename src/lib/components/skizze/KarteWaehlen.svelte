<script lang="ts">
	import { onMount, tick } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type { Map as LMap, TileLayer } from 'leaflet';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import { adresseSuchen, karteNachzeichnen, START, type Ausschnitt } from '$lib/berichte/karte';
	import { SKIZZE_B, SKIZZE_H, type SkizzenKarte } from '$lib/berichte/typen';

	let {
		einsatzort,
		alteKarte,
		uebernehmen,
		schliessen
	}: {
		einsatzort: string;
		alteKarte: SkizzenKarte | null;
		uebernehmen: (k: SkizzenKarte) => void;
		schliessen: () => void;
	} = $props();

	const VERHAELTNIS = SKIZZE_B / SKIZZE_H;

	let dialog: HTMLDialogElement;
	let kartenEl: HTMLDivElement;
	let bereichEl: HTMLDivElement;
	let rahmenEl: HTMLDivElement;
	let karte: LMap | null = null;
	let ebenen: Record<'karte' | 'luftbild', TileLayer> | null = null;
	let ebene = $state<'karte' | 'luftbild'>('karte');

	let suche = $state(einsatzort);
	let treffer = $state<{ lat: number; lon: number; name: string }[]>([]);
	let sucht = $state(false);
	let laedt = $state(false);
	let fehler = $state('');
	let abbruch: AbortController | null = null;

	/* ------------------------------------------------ Drehbarer Rahmen */

	/** Drehung des Rahmens im Uhrzeigersinn, -180 bis 180 Grad */
	let drehung = $state(alteKarte?.ansicht?.drehung ?? 0);
	let bereich = $state({ b: 0, h: 0 });
	let dreht = false;

	// Rahmen so groß wie möglich, auch gedreht noch ganz im sichtbaren Bereich
	const rahmen = $derived.by(() => {
		const a = (drehung * Math.PI) / 180;
		const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
		const b = Math.max(0, Math.min(bereich.b / (c + s / VERHAELTNIS), bereich.h / (s + c / VERHAELTNIS)));
		return { b, h: b / VERHAELTNIS };
	});

	const normalisieren = (w: number) => {
		const x = ((w % 360) + 360) % 360;
		return x > 180 ? x - 360 : x;
	};
	function drehen(grad: number) {
		drehung = normalisieren(Math.round((drehung + grad) / 15) * 15);
	}

	function griffDown(e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		dreht = true;
	}
	function griffMove(e: PointerEvent) {
		if (!dreht) return;
		const r = rahmenEl.getBoundingClientRect();
		const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
		let w = Math.round((Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180) / Math.PI);
		// Bei Norden und den rechten Winkeln einrasten
		const rechter = Math.round(w / 90) * 90;
		if (Math.abs(w - rechter) <= 4) w = rechter;
		drehung = normalisieren(w);
	}
	function griffUp() {
		dreht = false;
	}

	/* ------------------------------------------------ Karte */

	onMount(() => {
		dialog.showModal();
		let entfernt = false;
		const beobachter = new ResizeObserver(() => (bereich = { b: bereichEl.clientWidth, h: bereichEl.clientHeight }));
		beobachter.observe(bereichEl);
		(async () => {
			const L = (await import('leaflet')).default;
			if (entfernt) return;
			await tick();
			karte = L.map(kartenEl, { zoomControl: true, attributionControl: true }).setView([START.lat, START.lon], START.zoom);
			const attr = '<a href="https://basemap.at" target="_blank" rel="noopener">basemap.at</a>, Gebäude/Straßen © OpenStreetMap';
			ebenen = {
				karte: L.tileLayer('https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png', { maxZoom: 19, attribution: attr }),
				luftbild: L.tileLayer('https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg', { maxZoom: 19, attribution: attr })
			};
			ebenen.karte.addTo(karte);
			if (alteKarte?.ansicht) {
				karte.setView([alteKarte.ansicht.lat, alteKarte.ansicht.lon], alteKarte.ansicht.zoom);
			} else if (alteKarte) {
				const [s, w, n, o] = alteKarte.bbox;
				karte.fitBounds([[s, w], [n, o]]);
			} else if (einsatzort.trim()) {
				suchen();
			}
			setTimeout(() => karte?.invalidateSize(), 50);
		})();
		return () => {
			entfernt = true;
			beobachter.disconnect();
			abbruch?.abort();
			karte?.remove();
		};
	});

	function ebeneWaehlen(neu: 'karte' | 'luftbild') {
		if (!karte || !ebenen || neu === ebene) return;
		ebenen[ebene].remove();
		ebenen[neu].addTo(karte);
		ebene = neu;
	}

	async function suchen(e?: Event) {
		e?.preventDefault();
		if (!suche.trim()) return;
		sucht = true;
		fehler = '';
		try {
			treffer = await adresseSuchen(suche.trim());
			if (treffer.length === 0) fehler = 'Adresse nicht gefunden. Karte bitte von Hand verschieben.';
			else if (treffer.length === 1) hinspringen(treffer[0]);
		} catch {
			fehler = 'Die Adresssuche ist gerade nicht erreichbar.';
		} finally {
			sucht = false;
		}
	}

	function hinspringen(t: { lat: number; lon: number }) {
		karte?.setView([t.lat, t.lon], 18);
		treffer = [];
	}

	/** Rahmen samt Drehung in Kartenkoordinaten umrechnen */
	function ausschnitt(): Ausschnitt | null {
		if (!karte) return null;
		const m = karte;
		const zoom = m.getZoom();
		const k = kartenEl.getBoundingClientRect();
		const r = rahmenEl.getBoundingClientRect();
		const mitteLL = m.containerPointToLatLng([r.left + r.width / 2 - k.left, r.top + r.height / 2 - k.top]);
		const mitte = m.project(mitteLL, zoom);
		const a = (drehung * Math.PI) / 180;
		const cos = Math.cos(a), sin = Math.sin(a);
		const { b: fb, h: fh } = rahmen;

		// Ecken des gedrehten Rahmens (Bildschirm-y zeigt nach unten, positive Drehung = Uhrzeigersinn)
		const ecken = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
			const x = (sx * fb) / 2, y = (sy * fh) / 2;
			return m.unproject([mitte.x + x * cos - y * sin, mitte.y + x * sin + y * cos], zoom);
		});
		const lats = ecken.map((e) => e.lat), lons = ecken.map((e) => e.lng);
		const bbox: [number, number, number, number] = [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)];

		const meterJePixel = (40075016.686 * Math.cos((mitteLL.lat * Math.PI) / 180)) / (256 * 2 ** zoom);
		return {
			bbox,
			einheitenJeMeter: SKIZZE_B / (fb * meterJePixel),
			ansicht: { lat: mitteLL.lat, lon: mitteLL.lng, zoom, drehung },
			projektion: (lat, lon) => {
				const p = m.project([lat, lon], zoom);
				const dx = p.x - mitte.x, dy = p.y - mitte.y;
				// Drehung des Rahmens zurückrechnen, dann auf die Skizze skalieren
				const x = dx * cos + dy * sin;
				const y = -dx * sin + dy * cos;
				return [(x / fb + 0.5) * SKIZZE_B, (y / fh + 0.5) * SKIZZE_H];
			}
		};
	}

	async function uebernehmenKlick() {
		const a = ausschnitt();
		if (!a || !karte) return;
		if (karte.getZoom() < 15) {
			fehler = 'Bitte näher heranzoomen: der Ausschnitt ist zu groß zum Nachzeichnen.';
			return;
		}
		laedt = true;
		fehler = '';
		abbruch = new AbortController();
		try {
			uebernehmen(await karteNachzeichnen(a, abbruch.signal));
		} catch {
			if (!abbruch.signal.aborted) fehler = 'Gebäude und Straßen konnten nicht geladen werden. Bitte später noch einmal versuchen.';
		} finally {
			laedt = false;
		}
	}
</script>

<dialog bind:this={dialog} class="karte-dialog" oncancel={(e) => { e.preventDefault(); schliessen(); }} aria-labelledby="karte-titel">
	<div class="flex h-full flex-col">
		<header class="flex flex-wrap items-center gap-3 border-b border-line p-3 sm:p-4">
			<h2 id="karte-titel" class="display mr-auto text-2xl">Kartenausschnitt wählen</h2>
			<div class="flex rounded-lg bg-surface-3 p-1" role="group" aria-label="Kartenart">
				<button type="button" class="rounded-md px-3 py-1.5 text-sm font-semibold" class:bg-surface={ebene === 'karte'} aria-pressed={ebene === 'karte'} onclick={() => ebeneWaehlen('karte')}>Karte</button>
				<button type="button" class="rounded-md px-3 py-1.5 text-sm font-semibold" class:bg-surface={ebene === 'luftbild'} aria-pressed={ebene === 'luftbild'} onclick={() => ebeneWaehlen('luftbild')}>Luftbild</button>
			</div>
			<button type="button" class="btn btn-ruhig px-2" aria-label="Schließen" onclick={schliessen}><X size={22} /></button>
			<form class="relative flex w-full gap-2" onsubmit={suchen}>
				<input class="input" type="search" placeholder="Adresse suchen, z. B. Achauerstraße 43" bind:value={suche} aria-label="Adresse suchen" />
				<button class="btn shrink-0" disabled={sucht}><Search size={18} aria-hidden="true" />Suchen</button>
				{#if treffer.length > 1}
					<ul class="absolute top-full right-0 left-0 z-[1000] mt-1 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-2)]">
						{#each treffer as t (t.name)}
							<li><button type="button" class="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-2" onclick={() => hinspringen(t)}>{t.name}</button></li>
						{/each}
					</ul>
				{/if}
			</form>
		</header>

		<div class="relative min-h-0 flex-1 overflow-hidden">
			<div bind:this={kartenEl} class="absolute inset-0"></div>
			<!-- Rahmen im Seitenverhältnis des Skizzenfelds; Karte darunter verschieben und zoomen, Rahmen am Griff drehen -->
			<div class="pointer-events-none absolute inset-0 z-[500] px-6 pt-12 pb-6">
				<div bind:this={bereichEl} class="grid h-full w-full place-items-center">
					<div
						bind:this={rahmenEl}
						class="rahmen"
						style:width="{rahmen.b}px"
						style:height="{rahmen.h}px"
						style:transform="rotate({drehung}deg)"
					>
						<span class="oben" aria-hidden="true">oben</span>
						<button
							type="button"
							class="griff"
							aria-label="Rahmen drehen"
							title="Ziehen zum Drehen"
							onpointerdown={griffDown}
							onpointermove={griffMove}
							onpointerup={griffUp}
							onpointercancel={griffUp}
						><RotateCw size={18} /></button>
					</div>
				</div>
			</div>
		</div>

		<footer class="flex flex-wrap items-center gap-3 border-t border-line p-3 sm:p-4">
			<div class="flex items-center gap-1" role="group" aria-label="Drehung des Ausschnitts">
				<button type="button" class="btn btn-ruhig px-2" onclick={() => drehen(-15)} aria-label="15 Grad gegen den Uhrzeigersinn"><RotateCcw size={18} /></button>
				<input type="range" min="-180" max="180" step="1" class="w-32 accent-[#af2b1e]" bind:value={drehung} aria-label="Drehung in Grad" />
				<button type="button" class="btn btn-ruhig px-2" onclick={() => drehen(15)} aria-label="15 Grad im Uhrzeigersinn"><RotateCw size={18} /></button>
				<span class="w-12 text-right font-semibold tabular">{Math.round(drehung)}°</span>
				<button type="button" class="btn btn-ruhig px-3 text-sm" onclick={() => (drehung = 0)} disabled={drehung === 0}>Norden oben</button>
			</div>
			<p class="hinweis mr-auto min-w-60 flex-1">
				{#if fehler}<span class="font-semibold text-danger" role="alert">{fehler}</span>
				{:else if laedt}Gebäude und Straßen werden aus OpenStreetMap geladen. Das kann bis zu einer Minute dauern.
				{:else}Karte verschieben und zoomen, Rahmen bei Bedarf drehen. Die Skizze übernimmt genau diesen Ausschnitt.{/if}
			</p>
			<button type="button" class="btn" onclick={schliessen}>Abbrechen</button>
			<button type="button" class="btn btn-primary" onclick={uebernehmenKlick} disabled={laedt}>
				{#if laedt}<LoaderCircle size={18} class="animate-spin" aria-hidden="true" />Wird nachgezeichnet …{:else}Ausschnitt übernehmen{/if}
			</button>
		</footer>
	</div>
</dialog>

<style>
	.karte-dialog {
		width: min(1100px, calc(100vw - 16px));
		height: min(900px, calc(100dvh - 16px));
		max-width: none;
		max-height: none;
		margin: auto;
		padding: 0;
		border: 0;
		border-radius: 16px;
		background: var(--c-surface);
		color: var(--c-ink);
		box-shadow: var(--shadow-3);
		overflow: hidden;
	}
	.karte-dialog::backdrop {
		background: var(--c-scrim);
	}
	.rahmen {
		position: relative;
		border: 3px solid #af2b1e;
		border-radius: 4px;
		box-shadow: 0 0 0 9999px rgb(16 24 33 / 0.38);
	}
	/* Markiert die Oberkante: sie wird zur Oberkante der Skizze */
	.oben {
		position: absolute;
		top: 4px;
		left: 50%;
		transform: translateX(-50%);
		padding: 0 6px;
		border-radius: 4px;
		background: #af2b1e;
		color: #fff;
		font-size: 0.7rem;
		font-weight: 700;
	}
	.griff {
		position: absolute;
		top: -38px;
		left: 50%;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		margin-left: -16px;
		border: 3px solid #af2b1e;
		border-radius: 50%;
		background: #fff;
		color: #af2b1e;
		cursor: grab;
		pointer-events: auto;
		touch-action: none;
	}
	.griff::after {
		content: '';
		position: absolute;
		top: 29px;
		left: 50%;
		width: 3px;
		height: 9px;
		margin-left: -1.5px;
		background: #af2b1e;
	}
	.griff:active {
		cursor: grabbing;
	}
</style>
