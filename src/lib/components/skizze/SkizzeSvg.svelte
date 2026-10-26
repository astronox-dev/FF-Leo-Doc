<script lang="ts">
	import { LEGENDE_ZEILEN, MASS, SYMBOL, kopfueber, zeichnen, type SymbolDef } from '$lib/berichte/legende';
	import { schlauchMitte, schlauchPfad } from '$lib/berichte/schlauch';
	import { SKIZZE_B, SKIZZE_H, type Skizze, type SkizzenElement } from '$lib/berichte/typen';

	let {
		skizze,
		modus = 'druck',
		auswahl = null,
		ansicht = null,
		svg = $bindable(),
		children
	}: {
		skizze: Skizze | null;
		modus?: 'druck' | 'editor';
		auswahl?: string | null;
		/** Sichtbarer Ausschnitt beim Zoomen, sonst die ganze Skizze */
		ansicht?: { x: number; y: number; w: number; h: number } | null;
		svg?: SVGSVGElement;
		children?: import('svelte').Snippet;
	} = $props();

	const uid = $props.id();
	const ZELLE = SKIZZE_B / 36;

	/** Bereich der gedruckten Legende, rechts oben wie auf dem Aufnahmeblatt */
	const LEGENDE = { x: 760, y: 0, b: 240 };

	/**
	 * Legende: Zeichen links, Text rechts umbrochen. Unter der Legende des Aufnahmeblatts stehen
	 * die weiteren Zeichen, die in dieser Skizze vorkommen.
	 */
	const legende = $derived.by(() => {
		const imBlatt = new Set(LEGENDE_ZEILEN.flatMap((z) => z.ids));
		const weitere = [
			...new Set((skizze?.elemente ?? []).flatMap((e) => (e.art === 'symbol' && SYMBOL[e.symbol] && !imBlatt.has(e.symbol) ? [e.symbol] : [])))
		];
		const zeilen: { ids: string[]; text: string[]; y: number; textX: number }[] = [];
		let y = 44;
		function zeile(ids: string[], inhalt: string) {
			const breite = ids.length > 1 ? 34 - ids.length * 3 : 32;
			const text: string[] = [''];
			for (const w of inhalt.split(' ')) {
				const letzte = text[text.length - 1];
				if ((letzte + ' ' + w).trim().length > breite && letzte) text.push(w);
				else text[text.length - 1] = (letzte + ' ' + w).trim();
			}
			zeilen.push({ ids, text, y, textX: ids.length > 1 ? 12 + ids.length * 23 : 46 });
			y += 12 + text.length * 7.5;
		}
		for (const z of LEGENDE_ZEILEN) zeile(z.ids, z.text);
		let weitereY: number | null = null;
		if (weitere.length) {
			weitereY = y + 12;
			y += 22;
			for (const id of weitere) zeile([id], SYMBOL[id].name);
		}
		return { zeilen, hoehe: y + 6, weitereY };
	});

	/** Zeichen in ein Feld der Legende einpassen */
	function einpassen(id: string, x: number, y: number, w: number, h: number) {
		const [vx, vy, vw, vh] = SYMBOL[id].vb;
		const f = Math.min(w / vw, h / vh);
		return `translate(${x + (w - vw * f) / 2 - vx * f} ${y + (h - vh * f) / 2 - vy * f}) scale(${f})`;
	}

	/** Beschriftungen; ältere Stände hatten bei der Windrichtung nur `text` */
	function felderVon(e: Extract<SkizzenElement, { art: 'symbol' }>, d: SymbolDef) {
		if (e.felder) return e.felder;
		return e.text && d.felder?.[0] ? { [d.felder[0].key]: e.text } : undefined;
	}

	const punkte = (p: number[]) => {
		let s = '';
		for (let i = 0; i < p.length; i += 2) s += `${p[i]},${p[i + 1]} `;
		return s;
	};

	function transform(e: Extract<SkizzenElement, { x: number }>) {
		return `translate(${e.x} ${e.y}) rotate(${e.winkel}) scale(${e.groesse})`;
	}
</script>

<svg
	bind:this={svg}
	viewBox={ansicht ? `${ansicht.x} ${ansicht.y} ${ansicht.w} ${ansicht.h}` : `0 0 ${SKIZZE_B} ${SKIZZE_H}`}
	xmlns="http://www.w3.org/2000/svg"
	class="block h-auto w-full select-none"
	font-family="Arial, Helvetica, sans-serif"
	role="img"
	aria-label="Skizze der Einsatzstelle"
>
	<defs>
		<pattern id="{uid}-raster" width={ZELLE} height={ZELLE} patternUnits="userSpaceOnUse">
			<path d="M {ZELLE} 0 V {ZELLE} M 0 {ZELLE} H {ZELLE}" fill="none" stroke="#9aa0a6" stroke-width="0.9" stroke-dasharray="2.2 1.6" />
		</pattern>
		<clipPath id="{uid}-clip"><rect width={SKIZZE_B} height={SKIZZE_H} /></clipPath>
	</defs>

	<rect width={SKIZZE_B} height={SKIZZE_H} fill="#fff" />
	<rect width={SKIZZE_B} height={SKIZZE_H} fill="url(#{uid}-raster)" />

	{#if skizze?.karte}
		{@const k = skizze.karte}
		<g clip-path="url(#{uid}-clip)" class="karte">
			{#each k.linien as l, i (i)}
				{#if l.art === 'wasser' && l.zu}
					<polygon points={punkte(l.punkte)} fill="#dbe8f8" stroke="#3f74c9" stroke-width="1.4" />
				{:else if l.art === 'wasser'}
					<polyline points={punkte(l.punkte)} fill="none" stroke="#3f74c9" stroke-width={l.breite ?? 2.5} stroke-linecap="round" stroke-linejoin="round" />
				{:else if l.art === 'gebaeude'}
					<polygon points={punkte(l.punkte)} fill="#eceae6" stroke="#2b2b2b" stroke-width="1.5" stroke-linejoin="round" />
				{:else if l.art === 'weg'}
					<polyline points={punkte(l.punkte)} fill="none" stroke="#6b6b6b" stroke-width="1.2" stroke-dasharray="5 4" />
				{/if}
			{/each}
			<!-- Straßen doppelt: dunkler Rand, darüber weiße Fahrbahn, damit Kreuzungen offen bleiben -->
			{#each k.linien as l, i (i)}
				{#if l.art === 'strasse'}
					<polyline points={punkte(l.punkte)} fill="none" stroke="#3b3b3b" stroke-width={(l.breite ?? 8) + 3} stroke-linecap="round" stroke-linejoin="round" />
				{/if}
			{/each}
			{#each k.linien as l, i (i)}
				{#if l.art === 'strasse'}
					<polyline points={punkte(l.punkte)} fill="none" stroke="#ffffff" stroke-width={l.breite ?? 8} stroke-linecap="round" stroke-linejoin="round" />
				{:else if l.art === 'bahn'}
					<polyline points={punkte(l.punkte)} fill="none" stroke="#2b2b2b" stroke-width="2.4" />
					<polyline points={punkte(l.punkte)} fill="none" stroke="#2b2b2b" stroke-width="9" stroke-dasharray="1.5 12" />
				{/if}
			{/each}
			{#each k.namen as n, i (i)}
				<text
					x={n.x}
					y={n.y}
					transform="rotate({n.winkel} {n.x} {n.y})"
					text-anchor="middle"
					dominant-baseline="central"
					font-size="13"
					font-style="italic"
					fill="#444"
					paint-order="stroke"
					stroke="#fff"
					stroke-width="3">{n.text}</text
				>
			{/each}
		</g>
	{/if}

	<!-- Gezeichnete Elemente -->
	{#each skizze?.elemente ?? [] as e (e.id)}
		{#if e.art === 'linie'}
			<g data-id={e.id}>
				<polyline points={punkte(e.punkte)} fill="none" stroke={e.farbe} stroke-width={e.breite} stroke-linecap="round" stroke-linejoin="round" />
				{#if modus === 'editor'}
					<!-- breitere unsichtbare Linie zum Antippen -->
					<polyline points={punkte(e.punkte)} fill="none" stroke="transparent" stroke-width={Math.max(18, e.breite + 12)} />
				{/if}
				{#if auswahl === e.id}
					<polyline points={punkte(e.punkte)} fill="none" stroke="#1f5fa8" stroke-width={e.breite + 6} stroke-opacity="0.35" stroke-linecap="round" />
				{/if}
			</g>
		{:else if e.art === 'schlauch'}
			{@const pfad = schlauchPfad(e.punkte)}
			<g data-id={e.id}>
				{#if auswahl === e.id}
					<path d={pfad} fill="none" stroke="#1f5fa8" stroke-width="10" stroke-opacity="0.3" stroke-linecap="round" />
				{/if}
				<path d={pfad} fill="none" stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
				{#if e.groesse}
					{@const m = schlauchMitte(e.punkte)}
					<!-- Größe (B oder C) mittig neben der Leitung, immer lesbar -->
					<text
						transform="translate({m.x} {m.y}) rotate({m.winkel}) translate(0 -11)"
						text-anchor="middle"
						dominant-baseline="central"
						font-size="17"
						font-weight="700"
						fill="#1a1a1a"
						paint-order="stroke"
						stroke="#fff"
						stroke-width="4">{e.groesse}</text
					>
				{/if}
				{#if modus === 'editor'}
					<!-- breiter unsichtbarer Streifen zum Antippen und Biegen -->
					<path d={pfad} fill="none" stroke="transparent" stroke-width="20" stroke-linecap="round" />
				{/if}
			</g>
		{:else if e.art === 'text'}
			<g data-id={e.id} transform={transform(e)}>
				<text text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="700" fill={e.farbe} paint-order="stroke" stroke="#fff" stroke-width="4">{e.text}</text>
				{#if modus === 'editor'}<rect x={-Math.max(30, e.text.length * 6.5)} y="-16" width={Math.max(60, e.text.length * 13)} height="32" fill="transparent" />{/if}
			</g>
		{:else if SYMBOL[e.symbol]}
			{@const d = SYMBOL[e.symbol]}
			<g data-id={e.id} transform={transform(e)}>
				<g transform="scale({MASS}) translate({-d.b / 2} {-d.h / 2})">
					{@html zeichnen(d, { felder: felderVon(e, d), ausleger: e.ausleger, kopf: kopfueber(e.winkel) })}
				</g>
				{#if modus === 'editor'}<rect x={(-d.b * MASS) / 2} y={(-d.h * MASS) / 2} width={d.b * MASS} height={d.h * MASS} fill="transparent" />{/if}
			</g>
		{/if}
	{/each}

	{#if modus === 'druck'}
		<!-- Legende wie auf dem Aufnahmeblatt -->
		<g transform="translate({LEGENDE.x} {LEGENDE.y})">
			<rect width={LEGENDE.b} height={legende.hoehe} fill="#fff" stroke="#9aa0a6" stroke-width="0.9" stroke-dasharray="2.2 1.6" />
			<text x="8" y="16" font-size="10" fill="#333">Die Legende stellt nur einen Auszug</text>
			<text x="8" y="29" font-size="10" fill="#333">aus der ÖBFV RL E-27 dar:</text>
			{#each legende.zeilen as z (z.ids.join())}
				{#each z.ids as id, i (id)}
					<g transform={z.ids.length > 1 ? einpassen(id, 8 + i * 23, z.y, 22, 15) : einpassen(id, 8, z.y, 30, 20)}>
						{@html zeichnen(SYMBOL[id])}
					</g>
				{/each}
				{#each z.text as t, j (j)}
					<text x={z.textX} y={z.y + 11 + j * 9} font-size="9.5" fill="#333">{t}</text>
				{/each}
			{/each}
			{#if legende.weitereY !== null}
				<text x="8" y={legende.weitereY} font-size="10" font-weight="700" fill="#333">Weitere Zeichen in dieser Skizze:</text>
			{/if}
		</g>
	{:else}
		<rect x={LEGENDE.x} y={LEGENDE.y} width={LEGENDE.b} height={legende.hoehe} fill="#ffffff" fill-opacity="0.72" stroke="#9aa0a6" stroke-dasharray="6 5" pointer-events="none" />
		<text x={LEGENDE.x + LEGENDE.b / 2} y={LEGENDE.y + 40} text-anchor="middle" font-size="18" fill="#8a9097" pointer-events="none">Legende</text>
		<text x={LEGENDE.x + LEGENDE.b / 2} y={LEGENDE.y + 64} text-anchor="middle" font-size="13" fill="#8a9097" pointer-events="none">steht hier im Ausdruck</text>
	{/if}

	{@render children?.()}
</svg>
