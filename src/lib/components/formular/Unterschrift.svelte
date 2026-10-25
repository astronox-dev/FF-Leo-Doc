<script lang="ts">
	import Eraser from '@lucide/svelte/icons/eraser';
	import type { MitgliedKurz, Unterschrift } from '$lib/berichte/typen';

	let {
		wert = $bindable(),
		rolle,
		mannschaft,
		gesperrt = false
	}: { wert: Unterschrift; rolle: string; mannschaft: MitgliedKurz[]; gesperrt?: boolean } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let zeichnet = false;
	let striche: { x: number; y: number }[][] = [];
	let leer = $state(true);

	const B = 600;
	const H = 200;

	function punkt(e: PointerEvent) {
		const r = canvas!.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * B, y: ((e.clientY - r.top) / r.height) * H };
	}

	function zeichnen() {
		const ctx = canvas?.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, B, H);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = '#10204a';
		ctx.lineWidth = 3.2;
		for (const s of striche) {
			ctx.beginPath();
			s.forEach((p, i) => {
				if (i === 0) ctx.moveTo(p.x, p.y);
				else {
					// geglättet über die Mittelpunkte
					const v = s[i - 1];
					ctx.quadraticCurveTo(v.x, v.y, (v.x + p.x) / 2, (v.y + p.y) / 2);
				}
			});
			if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y + 0.1);
			ctx.stroke();
		}
	}

	function start(e: PointerEvent) {
		if (gesperrt) return;
		canvas?.setPointerCapture(e.pointerId);
		zeichnet = true;
		striche.push([punkt(e)]);
		leer = false;
		zeichnen();
	}
	function bewegen(e: PointerEvent) {
		if (!zeichnet) return;
		striche[striche.length - 1].push(punkt(e));
		zeichnen();
	}
	function ende() {
		if (!zeichnet) return;
		zeichnet = false;
		if (!canvas) return;
		wert.bild = canvas.toDataURL('image/png');
		wert.zeit = Date.now();
	}
	function loeschen() {
		striche = [];
		leer = true;
		if (canvas) zeichnen();
		wert.bild = '';
		wert.zeit = null;
	}

	function mitgliedWaehlen(stbnr: string) {
		const m = mannschaft.find((x) => String(x.stbnr) === stbnr);
		wert.stbnr = m ? m.stbnr : null;
		wert.name = m ? `${m.vorname} ${m.nachname}` : '';
	}
</script>

<fieldset class="rounded-xl border border-line p-4" disabled={gesperrt}>
	<legend class="px-1 text-lg font-bold">{rolle}</legend>
	<label>
		<span class="field-label">Standesbuchnummer und Name</span>
		<select class="input" value={wert.stbnr != null ? String(wert.stbnr) : ''} onchange={(e) => mitgliedWaehlen(e.currentTarget.value)}>
			<option value="">Bitte wählen</option>
			{#each mannschaft as m (m.stbnr)}<option value={String(m.stbnr)}>{m.stbnr} {m.nachname} {m.vorname}</option>{/each}
		</select>
	</label>

	<div class="mt-4">
		<div class="flex items-end justify-between">
			<span class="field-label">Unterschrift</span>
			{#if !gesperrt && (wert.bild || !leer)}
				<button type="button" class="btn btn-ruhig min-h-9 px-2 text-sm" onclick={loeschen}><Eraser size={16} aria-hidden="true" />Neu unterschreiben</button>
			{/if}
		</div>
		{#if wert.bild && leer}
			<!-- Gespeicherte Unterschrift -->
			<img src={wert.bild} alt="Unterschrift {wert.name}" class="aspect-[3/1] w-full rounded-lg border border-line bg-white object-contain" />
		{:else}
			<canvas
				bind:this={canvas}
				width={B}
				height={H}
				class="aspect-[3/1] w-full touch-none rounded-lg border-2 border-dashed border-line-strong bg-white"
				onpointerdown={start}
				onpointermove={bewegen}
				onpointerup={ende}
				onpointercancel={ende}
				aria-label="Unterschriftsfeld {rolle}: mit Finger oder Stift unterschreiben"
			></canvas>
			<p class="hinweis mt-1">Mit Finger, Stift oder Maus im Feld unterschreiben.</p>
		{/if}
	</div>
</fieldset>
