<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Plus from '@lucide/svelte/icons/plus';
	import Share2 from '@lucide/svelte/icons/share-2';
	import FileText from '@lucide/svelte/icons/file-text';
	import { pageTitle } from '$lib/app';
	import { TYPEN } from '$lib/berichte/typen';
	import {
		abgeschlosseneEinsaetze, analyse, ausruestung, codeAnzeigen, datumAusIso, dauer, einsatzText, MIN, protokollEintraege,
		STATUS_TEXT, uhr, type Trupp
	} from '$lib/asue/kern';
	import { alleOffenenSenden, neueId, Sitzung } from '$lib/asue/sitzung.svelte';

	let { data } = $props();

	const STUFEN = { Brand: ['B1', 'B2', 'B3', 'B4'], Technisch: ['T1', 'T2', 'T3'], Schadstoff: ['S1', 'S2', 'S3'] };

	let s = $state<Sitzung | null>(null);
	let jetzt = $state(Date.now());
	let ton = $state(true);
	let wach = $state<'an' | 'tippen' | 'nicht'>('tippen');
	const stumm = new SvelteMap<string, number>();
	const vorgewarnt = new Set<string>();

	// Für jeden Code eine eigene Sitzung; beim Wechsel die alte schließen
	$effect(() => {
		const code = data.code;
		const neu = new Sitzung(code);
		untrack(() => (s = neu));
		void neu.verbinden();
		void alleOffenenSenden(code);
		return () => neu.beenden();
	});

	const z = $derived(s?.zustand);
	const offen = $derived(!!z?.einsatz && !z.abgeschlossen);

	/* ------------------------------------------------ Takt, Ton, Bildschirm */

	let audioCtx: AudioContext | null = null;
	function audio() {
		if (!audioCtx) {
			try {
				audioCtx = new AudioContext();
			} catch {
				return null;
			}
		}
		if (audioCtx.state === 'suspended') void audioCtx.resume();
		return audioCtx;
	}
	function piep(freqs: number[], laenge: number) {
		const c = audio();
		if (!c) return;
		let t0 = c.currentTime + 0.02;
		for (const f of freqs) {
			const o = c.createOscillator(), g = c.createGain();
			o.type = 'square';
			o.frequency.value = f;
			g.gain.setValueAtTime(0.0001, t0);
			g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.01);
			g.gain.exponentialRampToValueAtTime(0.0001, t0 + laenge);
			o.connect(g).connect(c.destination);
			o.start(t0);
			o.stop(t0 + laenge + 0.02);
			t0 += laenge + 0.05;
		}
	}

	let wakeLock: WakeLockSentinel | null = null;
	async function wachHalten() {
		if (!('wakeLock' in navigator)) {
			wach = 'nicht';
			return;
		}
		if (wakeLock || document.visibilityState !== 'visible') return;
		try {
			wakeLock = await navigator.wakeLock.request('screen');
			wach = 'an';
			wakeLock.addEventListener('release', () => {
				wakeLock = null;
				wach = 'tippen';
			});
		} catch {
			wach = 'tippen';
		}
	}

	let letzterTon = 0;
	onMount(() => {
		try {
			ton = localStorage.getItem('ffleodoc-ton') !== 'aus';
		} catch {
			/* Standard: Ton an */
		}
		void wachHalten();
		const takt = setInterval(() => {
			jetzt = Date.now();
			alarmTon();
		}, 500);
		const sichtbar = () => document.visibilityState === 'visible' && wachHalten();
		const online = () => s && !s.verbunden && s.verbinden();
		document.addEventListener('visibilitychange', sichtbar);
		window.addEventListener('online', online);
		return () => {
			clearInterval(takt);
			document.removeEventListener('visibilitychange', sichtbar);
			window.removeEventListener('online', online);
			void wakeLock?.release();
		};
	});

	function alarmTon() {
		if (!z || !s) return;
		let klingeln = false, notfall = false;
		for (const t of z.trupps) {
			const a = analyse(t, z, jetzt, stumm.get(t.id));
			const schluessel = `${t.id}:${t.start}`;
			if (a.stufe === 'bald' && !z.abgeschlossen && !vorgewarnt.has(schluessel)) {
				vorgewarnt.add(schluessel);
				if (ton) piep([880], 0.25);
			}
			if (a.klingelt) {
				klingeln = true;
				if (a.alarm === 'notfall') notfall = true;
			}
		}
		if (!klingeln || !ton) return;
		if (jetzt - letzterTon >= (notfall ? 1000 : 3000)) {
			letzterTon = jetzt;
			if (notfall) piep([1300, 850, 1300, 850], 0.16);
			else piep([880, 660], 0.2);
			navigator.vibrate?.(notfall ? [300, 100, 300] : [200]);
		}
	}

	function tonUmschalten() {
		ton = !ton;
		try {
			localStorage.setItem('ffleodoc-ton', ton ? 'an' : 'aus');
		} catch {
			/* nur für diese Sitzung */
		}
		if (ton) audio();
	}

	/* ------------------------------------------------ Anzeige */

	const karten = $derived(
		z ? z.trupps.map((t) => ({ t, a: analyse(t, z, jetzt, stumm.get(t.id)) })) : []
	);
	const alarme = $derived(karten.filter((k) => k.a.alarm));
	const imEinsatz = $derived(karten.filter((k) => k.a.laufend).length);
	const bereit = $derived(karten.filter((k) => k.t.status === 'bereit').length);
	const fertig = $derived(z ? abgeschlosseneEinsaetze(z) : []);

	function seit(t: Trupp) {
		if (t.status === 'einsatz') return `Beginn ${uhr(t.start!)} Uhr`;
		if (t.status === 'zurueck') return `Einsatz ${uhr(t.start!)} bis ${uhr(t.ende!)} Uhr`;
		if (t.status === 'nichtbereit') return `Nicht einsatzbereit seit ${uhr(t.nichtbereitAt!)} Uhr` + (t.ende ? `, letzter Einsatz ${uhr(t.start!)} bis ${uhr(t.ende)} Uhr` : '');
		return t.verlauf.length ? 'Neue Flaschen, Uhr startet mit „Einsatz beginnt“' : 'Uhr startet mit „Einsatz beginnt“';
	}

	/** Zeitleiste: Füllung = Zeit unter Atemschutz, Striche alle 5 min, dicker Strich = Zeitgrenze */
	function leiste(zeit: number, grenze: number) {
		const zeitMin = zeit / MIN;
		const skala = Math.max(grenze, Math.ceil((zeitMin + 0.01) / 5) * 5);
		const pos = (m: number) => `${Math.min(100, Math.max(0, (m / skala) * 100)).toFixed(2)}%`;
		const striche: string[] = [];
		for (let m = 5; m < skala; m += 5) if (m !== grenze) striche.push(pos(m));
		return { fuellung: pos(zeitMin), striche, grenze: grenze < skala ? pos(grenze) : null };
	}

	/* ------------------------------------------------ Aktionen */

	function klick(t: Trupp, was: string) {
		if (!s || !offen) return;
		const now = Date.now();
		switch (was) {
			case 'start':
				s.aktion('einsatz_beginnt', { id: t.id });
				audio();
				break;
			case 'zurueck':
				if (confirm(`${t.name} zurück? Die Uhr stoppt bei ${dauer(now - t.start!)}.`)) s.aktion('zurueck', { id: t.id });
				break;
			case 'nichtbereit':
				s.aktion('nicht_bereit', { id: t.id });
				break;
			case 'wiederbereit':
				if (confirm(`${t.name}: Neue Flaschen (${t.flasche} bar) aufgesetzt und Trupp wieder hergerichtet?`)) s.aktion('wieder_bereit', { id: t.id });
				break;
			case 'notfall':
				stumm.delete(t.id);
				s.aktion('notfall', { id: t.id, an: !t.notfall });
				break;
			case 'quittieren':
				if (analyse(t, z!, now).alarm === 'zeit') s.aktion('alarm_aus', { id: t.id });
				else stumm.set(t.id, now + MIN);
				break;
		}
	}

	/* ------------------------------------------------ Dialog: Trupp */

	let dlgTrupp = $state<HTMLDialogElement>();
	let bearbeitet = $state<Trupp | null>(null);
	let truppName = $state('');
	let flasche = $state<200 | 300>(300);
	let startZeit = $state('');

	function truppOeffnen(t: Trupp | null) {
		bearbeitet = t;
		const eigene = z?.trupps.filter((x) => /^Trupp \d+$/.test(x.name)).length ?? 0;
		truppName = t ? t.name : `Trupp ${eigene + 1}`;
		flasche = t ? t.flasche : 300;
		startZeit = t?.status === 'einsatz' && t.start ? uhr(t.start, true) : '';
		dlgTrupp?.showModal();
	}
	function truppSpeichern(e: SubmitEvent) {
		e.preventDefault();
		if (!s) return;
		const name = truppName.trim();
		if (bearbeitet) {
			const daten: Record<string, unknown> = { id: bearbeitet.id, name, flasche };
			if (bearbeitet.status === 'einsatz' && bearbeitet.start && startZeit) {
				const [h, m, sek = 0] = startZeit.split(':').map(Number);
				const d = new Date(bearbeitet.start);
				d.setHours(h, m, sek, 0);
				if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
				if (d.getTime() !== bearbeitet.start) daten.start = d.getTime();
			}
			s.aktion('trupp_geaendert', daten);
		} else {
			s.aktion('trupp_angelegt', { id: neueId(), name, flasche });
		}
		dlgTrupp?.close();
	}
	function truppLoeschen() {
		if (!s || !bearbeitet || !confirm(`${bearbeitet.name} wirklich löschen? Die Einträge im Protokoll bleiben erhalten.`)) return;
		s.aktion('trupp_geloescht', { id: bearbeitet.id });
		dlgTrupp?.close();
	}

	/* ------------------------------------------------ Dialog: Protokoll und Teilen */

	let dlgProtokoll = $state<HTMLDialogElement>();
	let dlgTeilen = $state<HTMLDialogElement>();
	let kopiert = $state(false);
	const link = $derived(typeof location === 'undefined' ? '' : `${location.origin}/atemschutz/${data.code}`);
	const eintraege = $derived(z ? protokollEintraege(z, jetzt).reverse() : []);

	function feldAendern(feld: 'datum' | 'adresse' | 'stufe' | 'ueberwacher', wert: string) {
		wert = wert.trim();
		if (!s || !z?.einsatz || (!wert && (feld === 'datum' || feld === 'adresse'))) return;
		if (wert !== z.einsatz[feld]) s.aktion('einsatz_geaendert', { [feld]: wert });
	}
	function berichtZuordnen(id: string) {
		if (!s) return;
		const b = data.berichte.find((x) => String(x.id) === id);
		s.aktion('bericht_zugeordnet', b ? { berichtId: b.id, titel: `${TYPEN[b.typ].kurz} ${b.einsatzort}`.trim() } : { berichtId: null });
	}
	function abschliessen() {
		if (!s) return;
		const laufend = karten.filter((k) => k.a.laufend).length;
		const text = laufend
			? `${laufend === 1 ? '1 Trupp ist' : `${laufend} Trupps sind`} noch im Einsatz und ${laufend === 1 ? 'wird' : 'werden'} als zurück eingetragen. Trotzdem abschließen?`
			: 'Überwachung abschließen? Sie bleibt gespeichert und kann jederzeit angesehen werden.';
		if (confirm(text)) s.aktion('einsatz_abgeschlossen');
	}
	function wiederOeffnen() {
		if (s && confirm('Überwachung wieder öffnen? Danach kann wieder auf allen Geräten geändert werden.')) s.aktion('einsatz_wiedereroeffnet');
	}
	async function kopieren() {
		try {
			await navigator.clipboard.writeText(link);
			kopiert = true;
		} catch {
			kopiert = false;
		}
	}
	function csv() {
		if (!z?.einsatz) return;
		const zelle = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
		const tag = (ts: number) => new Date(ts).toLocaleDateString('de-AT');
		const zeilen = [
			['Code', codeAnzeigen(data.code)], ['Datum', datumAusIso(z.einsatz.datum)], ['Adresse', z.einsatz.adresse], ['Einsatzstufe', z.einsatz.stufe], ['Atemschutzüberwacher', z.einsatz.ueberwacher], [],
			['Datum', 'Uhrzeit', 'Trupp', 'Ereignis'],
			...protokollEintraege(z).map((l) => [tag(l.t), uhr(l.t, true), l.trupp, l.text])
		];
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob(['﻿' + zeilen.map((r) => r.map(zelle).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
		a.download = `atemschutz-${z.einsatz.datum}-${data.code}.csv`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}
</script>

<svelte:head><title>{pageTitle(z?.einsatz ? `Atemschutz ${z.einsatz.adresse}` : 'Atemschutz')}</title></svelte:head>
<svelte:window onpointerdown={() => { audio(); void wachHalten(); }} />

{#if s?.unbekannt}
	<div class="wrap pt-10 text-center">
		<h1 class="display text-4xl">Code {codeAnzeigen(data.code)} unbekannt</h1>
		<p class="mt-3 text-ink-2">Es gibt keine Atemschutzüberwachung mit diesem Code. Bitte den Code prüfen.</p>
		<a href="/atemschutz" class="btn btn-primary mt-6">Zur Übersicht</a>
	</div>
{:else if !z?.einsatz}
	<div class="wrap pt-10 text-center">
		<h1 class="display text-4xl">Überwachung wird geladen</h1>
		<p class="mt-3 text-ink-2">Code {codeAnzeigen(data.code)}. Die Daten kommen vom Server, sobald eine Verbindung besteht.</p>
		<a href="/atemschutz" class="btn mt-6">Abbrechen</a>
	</div>
{:else}
	<!-- Kopf der Tafel -->
	<div class="sticky top-16 z-30 border-b border-line bg-surface print:hidden">
		<div class="wrap flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
			<button class="min-w-0 text-left" onclick={() => dlgProtokoll?.showModal()}>
				<span class="block truncate font-bold">{z.einsatz.adresse || 'Ohne Adresse'}</span>
				<span class="block text-sm text-ink-3">{[datumAusIso(z.einsatz.datum), z.einsatz.stufe].filter(Boolean).join(', ')}{z.bericht ? `, Bericht: ${z.bericht.titel}` : ''}</span>
			</button>
			<span class="uhrzeit tabular">{uhr(jetzt, true)}</span>
			<span class="text-sm text-ink-2">{imEinsatz} im Einsatz, {bereit} einsatzbereit</span>
			<span class="sync" data-zustand={s?.offen.length ? 'offline' : s?.verbunden ? 'ok' : 'offline'}>
				{s?.offen.length ? `Offline, ${s.offen.length === 1 ? '1 Änderung wartet' : `${s.offen.length} Änderungen warten`}` : s?.verbunden ? 'Verbunden' : 'Offline'}
			</span>
			<div class="ml-auto flex flex-wrap gap-2">
				<button class="btn" onclick={() => { kopiert = false; dlgTeilen?.showModal(); }}><Share2 size={18} aria-hidden="true" />Code {codeAnzeigen(data.code)}</button>
				<button class="btn px-3" onclick={tonUmschalten} aria-pressed={ton} aria-label={ton ? 'Ton ausschalten' : 'Ton einschalten'} title={ton ? 'Ton ausschalten' : 'Ton einschalten'}>
					{#if ton}<Volume2 size={20} />{:else}<VolumeX size={20} />{/if}
				</button>
				<button class="btn" onclick={() => dlgProtokoll?.showModal()}><ScrollText size={18} aria-hidden="true" />Protokoll</button>
				{#if offen}<button class="btn btn-primary" onclick={() => truppOeffnen(null)}><Plus size={18} aria-hidden="true" />Trupp anlegen</button>{/if}
			</div>
		</div>
	</div>

	{#if alarme.length}
		<div class="alarme print:hidden" role="alert">
			{#each alarme as { t, a } (t.id)}
				<span>{t.name}: {a.alarm === 'notfall' ? 'NOTFALL' : `${a.grenze} min überschritten`}</span>
				{#if a.klingelt}<button onclick={() => klick(t, 'quittieren')}>{a.alarm === 'notfall' ? 'Stumm' : 'Alarm aus'}</button>{/if}
			{/each}
		</div>
	{/if}
	{#if z.abgeschlossen}
		<div class="flex flex-wrap items-center gap-3 bg-warn-soft px-4 py-2.5 font-semibold print:hidden">
			<span>Diese Überwachung ist abgeschlossen und wird nur angezeigt.</span>
			<button class="btn min-h-9 px-3 text-sm" onclick={wiederOeffnen}>Wieder öffnen</button>
		</div>
	{/if}

	<div class="wrap pt-5 print:hidden">
		{#if wach !== 'an'}
			<p class="hinweis mb-3">{wach === 'nicht' ? 'Bildschirm-Sperre bitte am Gerät ausschalten.' : 'Einmal tippen, damit der Bildschirm eingeschaltet bleibt.'}</p>
		{/if}
		<div class="raster">
			{#each karten as { t, a } (t.id)}
				{@const l = leiste(a.zeit, a.grenze)}
				<article class="trupp" data-status={t.status} data-notfall={t.notfall} data-stufe={a.stufe} data-alarm={a.alarm ?? ''}>
					<header class="band">
						<h2>{t.name}</h2>
						<span class="status">{t.notfall ? 'NOTFALL' : STATUS_TEXT[t.status]}</span>
					</header>
					<div class="koerper">
						<div class="dauer tabular" role="timer" aria-label="Zeit unter Atemschutz">{dauer(a.zeit)}</div>
						<p class="seit">{seit(t)}</p>
						{#if t.start && t.status !== 'nichtbereit'}
							<div class="leiste" aria-hidden="true">
								<span class="fuellung" style:width={l.fuellung}></span>
								{#each l.striche as x (x)}<span class="strich" style:left={x}></span>{/each}
								{#if l.grenze}<span class="grenze" style:left={l.grenze}></span>{/if}
							</div>
						{:else if t.status !== 'nichtbereit'}
							<div class="leiste" aria-hidden="true"></div>
						{/if}
						{#if t.status === 'einsatz'}
							<p class="zeitinfo">
								{a.stufe === 'ueber' ? `${a.grenze} min überschritten seit ${dauer(-a.bisGrenze)}` : `Noch ${dauer(a.bisGrenze)} bis ${a.grenze} min (${uhr(t.start! + a.grenze * MIN)} Uhr)`}
							</p>
						{/if}
						<p class="ausruestung">{ausruestung(t)}</p>
						{#if offen}
							<div class="aktionen">
								{#if t.status === 'bereit'}
									<button class="btn btn-gross breit primaer-blau" onclick={() => klick(t, 'start')}>Einsatz beginnt</button>
									<button class="btn" onclick={() => klick(t, 'nichtbereit')}>Nicht einsatzbereit</button>
									<button class="btn" onclick={() => truppOeffnen(t)}>Bearbeiten</button>
								{:else if t.status === 'einsatz'}
									{#if a.klingelt}<button class="btn breit" onclick={() => klick(t, 'quittieren')}>{a.alarm === 'zeit' ? 'Alarm aus' : 'Alarm 1 min stumm'}</button>{/if}
									<button class="btn btn-gross breit primaer-rot" onclick={() => klick(t, 'zurueck')}>Zurück</button>
									<button class="btn notfall" aria-pressed={t.notfall} onclick={() => klick(t, 'notfall')}>{t.notfall ? 'Notfall aufheben' : 'Notfall'}</button>
									<button class="btn" onclick={() => truppOeffnen(t)}>Bearbeiten</button>
								{:else if t.status === 'zurueck'}
									<button class="btn btn-gross breit primaer-gruen" onclick={() => klick(t, 'wiederbereit')}>Wieder einsatzbereit</button>
									<button class="btn" onclick={() => klick(t, 'nichtbereit')}>Nicht einsatzbereit</button>
									<button class="btn" onclick={() => truppOeffnen(t)}>Bearbeiten</button>
								{:else}
									<button class="btn btn-gross breit primaer-gruen" onclick={() => klick(t, 'wiederbereit')}>Wieder einsatzbereit</button>
									<button class="btn breit" onclick={() => truppOeffnen(t)}>Bearbeiten</button>
								{/if}
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		{#if fertig.length}
			<section class="mt-8">
				<h2 class="text-lg font-bold">Abgeschlossene Atemschutzeinsätze</h2>
				<div class="mt-2 overflow-x-auto card">
					<table class="w-full text-left">
						<thead class="text-sm text-ink-2"><tr><th class="px-4 py-2">Trupp</th><th class="px-4 py-2">Beginn</th><th class="px-4 py-2">Ende</th><th class="px-4 py-2">Dauer</th></tr></thead>
						<tbody>
							{#each fertig as v, i (i)}
								<tr class="border-t border-line"><td class="px-4 py-2 font-semibold">{v.trupp.name}</td><td class="px-4 py-2 tabular">{uhr(v.start)}</td><td class="px-4 py-2 tabular">{uhr(v.ende)}</td><td class="px-4 py-2 tabular">{dauer(v.ende - v.start)}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	</div>

	<!-- Druck des Protokolls -->
	<section class="asue-druck hidden print:block">
		<h1>Atemschutzüberwachung</h1>
		<p>{einsatzText(z.einsatz)}, Code {codeAnzeigen(data.code)}{z.einsatz.ueberwacher ? `, Atemschutzüberwacher: ${z.einsatz.ueberwacher}` : ''}</p>
		<h2>Atemschutzeinsätze</h2>
		<table><thead><tr><th>Trupp</th><th>Beginn</th><th>Ende</th><th>Dauer</th></tr></thead>
			<tbody>{#each fertig as v, i (i)}<tr><td>{v.trupp.name}</td><td>{uhr(v.start, true)}</td><td>{uhr(v.ende, true)}</td><td>{dauer(v.ende - v.start)}</td></tr>{/each}</tbody>
		</table>
		<h2>Protokoll</h2>
		<table><thead><tr><th>Uhrzeit</th><th>Trupp</th><th>Ereignis</th></tr></thead>
			<tbody>{#each [...eintraege].reverse() as l, i (i)}<tr><td>{uhr(l.t, true)}</td><td>{l.trupp}</td><td>{l.text}</td></tr>{/each}</tbody>
		</table>
	</section>

	<!-- Trupp anlegen / bearbeiten -->
	<dialog bind:this={dlgTrupp} class="dialog">
		<form class="space-y-4 p-5" onsubmit={truppSpeichern}>
			<h2 class="display text-2xl">{bearbeitet ? `${bearbeitet.name} bearbeiten` : 'Trupp anlegen'}</h2>
			<label class="block"><span class="field-label">Trupp / Funkrufname</span><input class="input" required bind:value={truppName} /></label>
			<div class="flex items-center gap-2" role="group" aria-label="Flaschen">
				<span class="w-20 font-semibold">Flaschen</span>
				{#each [200, 300] as const as f (f)}
					<button type="button" class="btn flex-1" class:wahl-an={flasche === f} aria-pressed={flasche === f} onclick={() => (flasche = f)}>{f} bar</button>
				{/each}
			</div>
			{#if bearbeitet?.status === 'einsatz'}
				<label class="block"><span class="field-label">Einsatzbeginn (Uhrzeit)</span><input class="input" type="time" step="1" bind:value={startZeit} /></label>
			{/if}
			<div class="flex flex-wrap items-center gap-2 pt-2">
				{#if bearbeitet}<button type="button" class="btn btn-gefahr" onclick={truppLoeschen}>Trupp löschen</button>{/if}
				<span class="flex-1"></span>
				<button type="button" class="btn" onclick={() => dlgTrupp?.close()}>Abbrechen</button>
				<button class="btn btn-primary">{bearbeitet ? 'Speichern' : 'Anlegen'}</button>
			</div>
		</form>
	</dialog>

	<!-- Protokoll -->
	<dialog bind:this={dlgProtokoll} class="dialog breit">
		<div class="space-y-4 p-5">
			<h2 class="display text-2xl">Einsatz und Protokoll</h2>
			<fieldset class="grid gap-3 sm:grid-cols-2" disabled={!offen}>
				<label><span class="field-label">Datum</span><input class="input" type="date" value={z.einsatz.datum} onchange={(e) => feldAendern('datum', e.currentTarget.value)} /></label>
				<label><span class="field-label">Adresse</span><input class="input" value={z.einsatz.adresse} onchange={(e) => feldAendern('adresse', e.currentTarget.value)} /></label>
				<label><span class="field-label">Einsatzstufe</span>
					<select class="input" value={z.einsatz.stufe} onchange={(e) => feldAendern('stufe', e.currentTarget.value)}>
						<option value="">Keine Angabe</option>
						{#each Object.entries(STUFEN) as [gruppe, liste] (gruppe)}<optgroup label={gruppe}>{#each liste as st (st)}<option>{st}</option>{/each}</optgroup>{/each}
					</select>
				</label>
				<label><span class="field-label">Atemschutzüberwacher</span><input class="input" value={z.einsatz.ueberwacher} onchange={(e) => feldAendern('ueberwacher', e.currentTarget.value)} /></label>
				<label class="sm:col-span-2"><span class="field-label">Einsatzbericht</span>
					<select class="input" value={z.bericht ? String(z.bericht.id) : ''} onchange={(e) => berichtZuordnen(e.currentTarget.value)}>
						<option value="">Kein Bericht zugeordnet</option>
						{#if z.bericht && !data.berichte.some((b) => b.id === z.bericht!.id)}<option value={String(z.bericht.id)}>{z.bericht.titel}</option>{/if}
						{#each data.berichte as b (b.id)}<option value={String(b.id)}>{TYPEN[b.typ].kurz}: {b.einsatzort || 'ohne Einsatzort'} ({datumAusIso(b.datum)})</option>{/each}
					</select>
				</label>
			</fieldset>
			{#if z.bericht}
				<a href="/berichte/{z.bericht.id}" class="inline-flex items-center gap-2 font-semibold text-red hover:underline"><FileText size={18} aria-hidden="true" />Zum Einsatzbericht</a>
			{/if}
			<ol class="max-h-[45vh] overflow-y-auto rounded-xl border border-line">
				{#each eintraege as l, i (i)}
					<li class="grid grid-cols-[5.5rem_9rem_1fr] gap-2 border-b border-line px-3 py-2 text-[0.9375rem] last:border-0" class:text-danger={l.art === 'alarm'}>
						<span class="font-bold tabular">{uhr(l.t, true)}</span><span class="text-ink-2">{l.trupp}</span><span>{l.text}</span>
					</li>
				{/each}
			</ol>
			<div class="flex flex-wrap items-center gap-2">
				{#if offen}<button class="btn btn-gefahr" onclick={abschliessen}>Überwachung abschließen</button>{/if}
				<span class="flex-1"></span>
				<button class="btn" onclick={csv}>Als CSV speichern</button>
				<button class="btn" onclick={() => window.print()}>Drucken</button>
				<button class="btn btn-primary" onclick={() => dlgProtokoll?.close()}>Fertig</button>
			</div>
		</div>
	</dialog>

	<!-- Teilen -->
	<dialog bind:this={dlgTeilen} class="dialog">
		<div class="space-y-4 p-5">
			<h2 class="display text-2xl">Überwachung teilen</h2>
			<p class="hinweis">Auf dem anderen Gerät „Atemschutz“ öffnen, „Überwachung beitreten“ wählen und diesen Code eingeben, oder den Link öffnen.</p>
			<p class="code-gross tabular">{codeAnzeigen(data.code)}</p>
			<label class="block"><span class="field-label">Link</span><input class="input" readonly value={link} onfocus={(e) => e.currentTarget.select()} /></label>
			<div class="flex justify-end gap-2">
				<button class="btn" onclick={kopieren}>{kopiert ? 'Link kopiert' : 'Link kopieren'}</button>
				<button class="btn btn-primary" onclick={() => dlgTeilen?.close()}>Fertig</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	.uhrzeit {
		font-size: 1.6rem;
		font-weight: 750;
		font-stretch: 75%;
	}
	.sync {
		font-size: 0.875rem;
		font-weight: 650;
		white-space: nowrap;
	}
	.sync::before {
		content: '';
		display: inline-block;
		width: 9px;
		height: 9px;
		margin-right: 6px;
		border-radius: 50%;
		background: var(--c-danger);
	}
	.sync[data-zustand='ok']::before {
		background: var(--c-ok);
	}
	.sync[data-zustand='offline'] {
		color: var(--c-danger);
	}

	.alarme {
		position: sticky;
		top: 7.5rem;
		z-index: 25;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		padding: 10px 16px;
		background: #c62828;
		color: #fff;
		font-weight: 700;
	}
	.alarme button {
		min-height: 40px;
		padding: 6px 12px;
		border: 1.5px solid rgb(255 255 255 / 0.7);
		border-radius: 8px;
		color: #fff;
		font-weight: 700;
	}

	.raster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
		gap: 16px;
		align-items: start;
	}

	/* Status-Farben: einsatzbereit grün, im Einsatz blau, zurück rot, nicht einsatzbereit orange */
	.trupp {
		--band: #1d7548;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--c-line);
		border-radius: var(--radius-card);
		background: var(--c-surface);
	}
	.trupp[data-status='einsatz'] {
		--band: #2156a5;
	}
	.trupp[data-status='zurueck'] {
		--band: #c62828;
	}
	.trupp[data-status='nichtbereit'] {
		--band: #b45309;
	}
	.band {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		min-height: 68px;
		padding: 12px 16px;
		background: var(--band);
		color: #fff;
	}
	.band h2 {
		font-size: 1.75rem;
		font-weight: 800;
		font-stretch: 78%;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}
	.status {
		font-size: 1.25rem;
		font-weight: 700;
		font-stretch: 85%;
	}
	.trupp[data-notfall='true'] {
		border: 4px solid #c62828;
		background: var(--c-danger-soft);
		animation: rahmen 0.8s steps(2, jump-none) infinite;
	}
	.trupp[data-notfall='true'] .band {
		background: #af2b1e;
	}
	.trupp[data-stufe='ueber'] {
		border: 3px solid #c62828;
	}
	.koerper {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 14px 14px;
	}
	.dauer {
		margin: -2px 0 -4px;
		font-size: clamp(3.25rem, 10vw, 4.5rem);
		font-weight: 750;
		font-stretch: 68%;
		line-height: 1;
	}
	.trupp[data-status='bereit'] .dauer,
	.trupp[data-status='nichtbereit'] .dauer {
		color: var(--c-ink-3);
		opacity: 0.6;
	}
	.trupp[data-status='zurueck'] .dauer {
		color: var(--c-ink-2);
	}
	.seit {
		color: var(--c-ink-2);
		font-size: 0.95rem;
	}
	.leiste {
		position: relative;
		height: 14px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--c-line) 70%, transparent);
	}
	.fuellung {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 3px;
		background: var(--band);
	}
	.trupp[data-stufe='bald'] .fuellung {
		background: #e3a008;
	}
	.trupp[data-stufe='ueber'] .fuellung {
		background: #c62828;
	}
	.strich {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 2px;
		margin-left: -1px;
		background: var(--c-surface);
	}
	.grenze {
		position: absolute;
		top: -5px;
		bottom: -5px;
		width: 3px;
		margin-left: -1.5px;
		background: var(--c-ink);
	}
	.zeitinfo {
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--c-surface-3);
		font-weight: 650;
	}
	.trupp[data-stufe='bald'] .zeitinfo {
		background: var(--c-warn-soft);
		box-shadow: inset 4px 0 0 #e3a008;
	}
	.trupp[data-stufe='ueber'] .zeitinfo {
		background: #c62828;
		color: #fff;
	}
	.trupp[data-alarm='zeit'] .zeitinfo {
		animation: blinken 1s steps(2, jump-none) infinite;
	}
	.ausruestung {
		padding-top: 8px;
		border-top: 1px solid var(--c-line);
		color: var(--c-ink-2);
	}
	.aktionen {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.aktionen .breit {
		grid-column: 1 / -1;
	}
	.btn-gross {
		min-height: 3.25rem;
		font-size: 1.1rem;
	}
	.primaer-blau {
		background: #2156a5;
		border-color: #2156a5;
		color: #fff;
	}
	.primaer-rot {
		background: #c62828;
		border-color: #c62828;
		color: #fff;
	}
	.primaer-gruen {
		background: #1d7548;
		border-color: #1d7548;
		color: #fff;
	}
	.notfall {
		border-color: #c62828;
		color: #c62828;
	}
	.notfall[aria-pressed='true'] {
		background: #c62828;
		color: #fff;
	}
	.wahl-an {
		background: var(--c-ink);
		border-color: var(--c-ink);
		color: var(--c-surface);
	}
	@keyframes blinken {
		50% {
			background: var(--c-danger-soft);
			color: #c62828;
		}
	}
	@keyframes rahmen {
		50% {
			border-color: transparent;
		}
	}

	.dialog {
		width: min(520px, calc(100vw - 24px));
		max-height: calc(100dvh - 24px);
		margin: auto;
		padding: 0;
		border: 0;
		border-radius: var(--radius-card);
		background: var(--c-surface);
		color: var(--c-ink);
		box-shadow: var(--shadow-3);
	}
	.dialog.breit {
		width: min(860px, calc(100vw - 24px));
	}
	.dialog::backdrop {
		background: var(--c-scrim);
	}
	.code-gross {
		font-size: 3rem;
		font-weight: 800;
		font-stretch: 75%;
		letter-spacing: 0.08em;
		text-align: center;
	}

	.asue-druck {
		font-family: Arial, Helvetica, sans-serif;
		color: #000;
		padding: 12mm;
	}
	.asue-druck h1 {
		font-size: 16pt;
		font-weight: 700;
	}
	.asue-druck h2 {
		margin: 6mm 0 2mm;
		font-size: 12pt;
		font-weight: 700;
	}
	.asue-druck table {
		width: 100%;
		border-collapse: collapse;
		font-size: 9pt;
	}
	.asue-druck th,
	.asue-druck td {
		border: 0.5pt solid #000;
		padding: 1mm 1.5mm;
		text-align: left;
	}
</style>
