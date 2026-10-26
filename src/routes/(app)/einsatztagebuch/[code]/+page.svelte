<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import Printer from '@lucide/svelte/icons/printer';
	import FileDown from '@lucide/svelte/icons/file-down';
	import FileText from '@lucide/svelte/icons/file-text';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Strikethrough from '@lucide/svelte/icons/strikethrough';
	import { pageTitle } from '$lib/app';
	import { TYPEN } from '$lib/berichte/typen';
	import { datumAusIso } from '$lib/format';
	import { codeAnzeigen, neueId } from '$lib/live/sitzung.svelte';
	import { alleOffenenSenden, TagebuchSitzung } from '$lib/etb/sitzung.svelte';
	import { kuerzel, nummerVon, offeneAuftraege, uhrzeitJetzt, type Eintrag } from '$lib/etb/kern';
	import EtbDruck from '$lib/components/druck/EtbDruck.svelte';

	let { data } = $props();

	let s = $state<TagebuchSitzung | null>(null);

	// Für jeden Code eine eigene Sitzung; beim Wechsel die alte schließen
	$effect(() => {
		const code = data.code;
		const neu = new TagebuchSitzung(code);
		untrack(() => (s = neu));
		void neu.verbinden();
		void alleOffenenSenden(code);
		return () => neu.beenden();
	});

	const z = $derived(s?.zustand);
	const offen = $derived(!!z?.kopf && !z.abgeschlossen);
	const auftraege = $derived(z ? offeneAuftraege(z) : []);
	// Neueste oben: im Einsatz zählt, was zuletzt kam
	const liste = $derived(z ? [...z.eintraege].reverse() : []);

	const VORSCHLAEGE = ['Einsatzleiter', 'Einsatzleitung', 'BAZ', 'LWZ', 'Abschnittskommando', 'Bezirkskommando', 'Polizei', 'Rettung', 'Notarzt', 'Gemeinde'];
	const vorschlaege = $derived([...new Set([...data.funknamen, ...VORSCHLAEGE, ...(z?.eintraege.flatMap((x) => [x.an, x.von]) ?? [])].filter(Boolean))]);

	/* ------------------------------------------------ Neuer Eintrag */

	let uhrzeit = $state(uhrzeitJetzt());
	// Solange niemand die Uhrzeit ändert, läuft sie mit
	let uhrzeitFest = $state(false);
	let an = $state('');
	let von = $state('');
	let inhalt = $state('');
	let istAuftrag = $state(false);
	let bezug = $state('');
	let formular = $state<HTMLFormElement>();
	let inhaltFeld = $state<HTMLTextAreaElement>();

	onMount(() => {
		const takt = setInterval(() => {
			if (!uhrzeitFest) uhrzeit = uhrzeitJetzt();
		}, 5000);
		const online = () => s && !s.verbunden && s.verbinden();
		window.addEventListener('online', online);
		return () => {
			clearInterval(takt);
			window.removeEventListener('online', online);
		};
	});

	function eintragen(e: SubmitEvent) {
		e.preventDefault();
		if (!s || !offen || !inhalt.trim()) return;
		s.aktion('eintrag', {
			eid: neueId(12),
			uhrzeit: uhrzeitFest ? uhrzeit : uhrzeitJetzt(),
			an: an.trim(),
			von: von.trim(),
			inhalt: inhalt.trim(),
			auftrag: istAuftrag,
			...(bezug ? { auftragUnter: bezug } : {})
		});
		an = von = inhalt = bezug = '';
		istAuftrag = uhrzeitFest = false;
		uhrzeit = uhrzeitJetzt();
		inhaltFeld?.focus();
	}
	function tausch() {
		[an, von] = [von, an];
	}
	/** Erledigung eines Auftrags melden: Richtung umgedreht, Bezug gesetzt */
	function erledigtMelden(x: Eintrag) {
		bezug = x.eid;
		an = x.von;
		von = x.an;
		inhalt = '';
		formular?.scrollIntoView({ block: 'start', behavior: 'smooth' });
		inhaltFeld?.focus();
	}

	/* ------------------------------------------------ Einträge */

	function streichen(x: Eintrag) {
		if (!s || !offen) return;
		if (x.gestrichen) s.aktion('eintrag_gestrichen', { eid: x.eid, gestrichen: false });
		else if (confirm(`Eintrag ${x.nr} streichen? Er bleibt durchgestrichen im Tagebuch stehen.`)) s.aktion('eintrag_gestrichen', { eid: x.eid, gestrichen: true });
	}
	function kontrolle(x: Eintrag, an: boolean) {
		s?.aktion('kontrolle', { eid: x.eid, an, name: data.ich });
	}

	let dlgEintrag = $state<HTMLDialogElement>();
	let bearbeitet = $state<Eintrag | null>(null);
	let f = $state({ uhrzeit: '', an: '', von: '', inhalt: '', auftrag: false, auftragUnter: '' });

	function bearbeiten(x: Eintrag) {
		bearbeitet = x;
		f = { uhrzeit: x.uhrzeit, an: x.an, von: x.von, inhalt: x.inhalt, auftrag: x.auftrag, auftragUnter: x.auftragUnter ?? '' };
		dlgEintrag?.showModal();
	}
	function aenderungSpeichern(e: SubmitEvent) {
		e.preventDefault();
		const x = bearbeitet;
		if (!s || !x) return;
		const neu: Record<string, unknown> = {};
		for (const k of ['uhrzeit', 'an', 'von', 'inhalt'] as const) if (f[k].trim() !== x[k]) neu[k] = f[k].trim();
		if (f.auftrag !== x.auftrag) neu.auftrag = f.auftrag;
		if ((f.auftragUnter || null) !== x.auftragUnter) neu.auftragUnter = f.auftragUnter;
		if (Object.keys(neu).length) s.aktion('eintrag_geaendert', { eid: x.eid, ...neu });
		dlgEintrag?.close();
	}

	/* ------------------------------------------------ Angaben, Teilen */

	let dlgAngaben = $state<HTMLDialogElement>();
	let dlgTeilen = $state<HTMLDialogElement>();
	let kopiert = $state(false);
	const link = $derived(typeof location === 'undefined' ? '' : `${location.origin}/einsatztagebuch/${data.code}`);

	function kopfAendern(feld: 'datum' | 'einsatzort' | 'feuerwehr' | 'bearbeiter', wert: string) {
		wert = wert.trim();
		if (!s || !z?.kopf || (!wert && feld === 'datum')) return;
		if (wert !== z.kopf[feld]) s.aktion('tagebuch_geaendert', { [feld]: wert });
	}
	function berichtZuordnen(id: string) {
		if (!s) return;
		const b = data.berichte.find((x) => String(x.id) === id);
		s.aktion('bericht_zugeordnet', b ? { berichtId: b.id, titel: `${TYPEN[b.typ].kurz} ${b.einsatzort}`.trim() } : { berichtId: null });
	}
	function abschliessen() {
		const n = auftraege.length;
		const text = n
			? `${n === 1 ? '1 Auftrag ist' : `${n} Aufträge sind`} noch offen. Tagebuch trotzdem abschließen? Danach kann nichts mehr eingetragen werden.`
			: 'Tagebuch abschließen? Danach kann nichts mehr eingetragen oder geändert werden.';
		if (s && confirm(text)) s.aktion('tagebuch_abgeschlossen');
	}
	function wiederOeffnen() {
		if (s && confirm('Tagebuch wieder öffnen? Danach kann wieder auf allen Geräten eingetragen werden.')) s.aktion('tagebuch_wiedereroeffnet');
	}
	async function kopieren() {
		try {
			await navigator.clipboard.writeText(link);
			kopiert = true;
		} catch {
			kopiert = false;
		}
	}
</script>

<svelte:head><title>{pageTitle(z?.kopf ? `Tagebuch ${z.kopf.einsatzort}` : 'Einsatztagebuch')}</title></svelte:head>

{#if s?.unbekannt}
	<div class="wrap pt-10 text-center">
		<h1 class="display text-4xl">Code {codeAnzeigen(data.code)} unbekannt</h1>
		<p class="mt-3 text-ink-2">Es gibt kein Einsatztagebuch mit diesem Code. Bitte den Code prüfen.</p>
		<a href="/einsatztagebuch" class="btn btn-primary mt-6">Zur Übersicht</a>
	</div>
{:else if !z?.kopf}
	<div class="wrap pt-10 text-center">
		<h1 class="display text-4xl">Tagebuch wird geladen</h1>
		<p class="mt-3 text-ink-2">Code {codeAnzeigen(data.code)}. Die Einträge kommen vom Server, sobald eine Verbindung besteht.</p>
		<a href="/einsatztagebuch" class="btn mt-6">Abbrechen</a>
	</div>
{:else}
	<div class="print:hidden">
		<!-- Kopf -->
		<div class="sticky top-16 z-30 border-b border-line bg-surface">
			<div class="wrap flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
				<button class="min-w-0 text-left" onclick={() => dlgAngaben?.showModal()}>
					<span class="block truncate font-bold">{z.kopf.einsatzort || 'Ohne Einsatzort'}</span>
					<span class="block text-sm text-ink-3">
						{datumAusIso(z.kopf.datum)}, Bearbeiter {z.kopf.bearbeiter || 'nicht eingetragen'}{z.bericht ? `, Bericht: ${z.bericht.titel}` : ''}
					</span>
				</button>
				<span class="sync" data-zustand={s?.offen.length ? 'offline' : s?.verbunden ? 'ok' : 'offline'}>
					{s?.offen.length ? `Offline, ${s.offen.length === 1 ? '1 Änderung wartet' : `${s.offen.length} Änderungen warten`}` : s?.verbunden ? 'Verbunden' : 'Offline'}
				</span>
				<div class="ml-auto flex flex-wrap gap-2">
					<button class="btn" onclick={() => { kopiert = false; dlgTeilen?.showModal(); }}><Share2 size={18} aria-hidden="true" />Code {codeAnzeigen(data.code)}</button>
					<button class="btn" onclick={() => dlgAngaben?.showModal()}><Settings2 size={18} aria-hidden="true" />Angaben</button>
					<button class="btn" onclick={() => window.print()}><Printer size={18} aria-hidden="true" />Drucken</button>
					<a class="btn" href="/einsatztagebuch/{data.code}/pdf" data-sveltekit-reload><FileDown size={18} aria-hidden="true" />PDF</a>
				</div>
			</div>
		</div>

		{#if z.abgeschlossen}
			<div class="flex flex-wrap items-center gap-3 bg-warn-soft px-4 py-2.5 font-semibold text-warn">
				<span>Dieses Tagebuch ist abgeschlossen und wird nur angezeigt.</span>
				<button class="btn min-h-9 px-3 text-sm" onclick={wiederOeffnen}>Wieder öffnen</button>
			</div>
		{/if}

		<div class="wrap grid items-start gap-6 pt-5 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
			<!-- Eingabe und offene Aufträge -->
			<div class="space-y-5 lg:sticky lg:top-36">
				{#if offen}
					<form bind:this={formular} class="card space-y-3 p-4" onsubmit={eintragen}>
						<h2 class="display text-2xl">Neuer Eintrag</h2>
						<div class="grid grid-cols-[7rem_minmax(0,1fr)] items-end gap-3">
							<label class="block">
								<span class="field-label">Uhrzeit</span>
								<input class="input tabular" type="time" required bind:value={uhrzeit} oninput={() => (uhrzeitFest = true)} />
							</label>
							<p class="hinweis pb-3 text-sm">{uhrzeitFest ? 'Fest eingestellt.' : 'Läuft mit der Uhr mit.'}</p>
						</div>
						<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
							<label class="block"><span class="field-label">An</span><input class="input" list="etb-parteien" autocomplete="off" bind:value={an} /></label>
							<button type="button" class="btn btn-ruhig mb-0.5 px-2" onclick={tausch} title="An und Von tauschen" aria-label="An und Von tauschen"><ArrowLeftRight size={18} /></button>
							<label class="block"><span class="field-label">Von</span><input class="input" list="etb-parteien" autocomplete="off" bind:value={von} /></label>
						</div>
						<datalist id="etb-parteien">{#each vorschlaege as v (v)}<option value={v}></option>{/each}</datalist>
						<label class="block">
							<span class="field-label">Inhalt</span>
							<textarea
								bind:this={inhaltFeld}
								class="input"
								rows="3"
								required
								placeholder="Meldung, Auftrag oder Maßnahme"
								bind:value={inhalt}
								onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) formular?.requestSubmit(); }}
							></textarea>
						</label>
						{#if auftraege.length}
							<label class="block">
								<span class="field-label">Erledigt einen Auftrag</span>
								<select class="input" bind:value={bezug}>
									<option value="">Nein</option>
									{#each auftraege as x (x.eid)}<option value={x.eid}>Nr. {x.nr}: {x.inhalt.slice(0, 60)}</option>{/each}
								</select>
							</label>
						{/if}
						<label class="kreuz w-full"><input type="checkbox" bind:checked={istAuftrag} />Auftrag, bleibt offen bis zur Erledigung</label>
						<button class="btn btn-primary min-h-12 w-full text-base">Eintragen</button>
						<p class="hinweis text-sm">Strg + Enter trägt ebenfalls ein.</p>
					</form>
				{/if}

				{#if auftraege.length}
					<section class="card p-4">
						<h2 class="text-lg font-bold">Offene Aufträge</h2>
						<ul class="mt-2 space-y-2">
							{#each auftraege as x (x.eid)}
								<li class="rounded-lg border border-line p-3">
									<p class="text-sm text-ink-3">Nr. {x.nr}, {x.uhrzeit} Uhr{x.an ? `, an ${x.an}` : ''}</p>
									<p class="mt-0.5 font-medium">{x.inhalt}</p>
									{#if offen}<button class="btn mt-2 min-h-9 px-3 text-sm" onclick={() => erledigtMelden(x)}>Erledigung eintragen</button>{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>

			<!-- Einträge -->
			<section aria-labelledby="eintraege">
				<div class="flex items-baseline justify-between gap-3">
					<h2 id="eintraege" class="text-lg font-bold">Einträge</h2>
					<span class="text-sm text-ink-3">{z.eintraege.length === 1 ? '1 Eintrag' : `${z.eintraege.length} Einträge`}, neueste oben</span>
				</div>
				{#if liste.length === 0}
					<p class="mt-3 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-ink-2">Noch keine Einträge. Der erste Eintrag bekommt die Nummer 1.</p>
				{:else}
					<ol class="mt-3 divide-y divide-line card overflow-hidden">
						{#each liste as x (x.eid)}
							{@const auftragNr = nummerVon(z, x.auftragUnter)}
							<li class="eintrag" class:gestrichen={x.gestrichen}>
								<div class="nr tabular" class:vorlaeufig={x.vorlaeufig} title={x.vorlaeufig ? 'Wird übertragen, die Nummer kann sich noch ändern' : undefined}>{x.nr}</div>
								<div class="min-w-0">
									<p class="flex flex-wrap items-baseline gap-x-2 text-sm">
										<span class="font-bold tabular text-ink">{x.uhrzeit}</span>
										{#if x.an}<span><span class="text-ink-3">an</span> <b>{x.an}</b></span>{/if}
										{#if x.von}<span><span class="text-ink-3">von</span> <b>{x.von}</b></span>{/if}
										{#if x.gestrichen}<span class="marke">gestrichen</span>{/if}
										{#if x.geaendert && !x.gestrichen}<span class="text-ink-3">geändert</span>{/if}
									</p>
									<p class="inhalt">{x.inhalt}</p>
									{#if x.auftrag || auftragNr}
										<p class="mt-1 flex flex-wrap gap-1.5 text-sm">
											{#if x.auftrag}
												<span class="marke" class:offen={x.erledigungUnter == null && !x.gestrichen}>{x.erledigungUnter == null ? 'Auftrag offen' : `Auftrag, erledigt unter ${x.erledigungUnter}`}</span>
											{/if}
											{#if auftragNr}<span class="marke">Erledigt Auftrag {auftragNr}</span>{/if}
										</p>
									{/if}
								</div>
								<div class="aktionen">
									<label class="kontrolle" title={x.kontrolle ? `Kontrolliert von ${x.kontrolle}` : 'Als kontrolliert markieren'}>
										<input type="checkbox" checked={!!x.kontrolle} disabled={!offen} onchange={(e) => kontrolle(x, e.currentTarget.checked)} />
										<span>{x.kontrolle ? kuerzel(x.kontrolle) : 'Kontrolle'}</span>
									</label>
									{#if offen}
										<button class="btn btn-ruhig min-h-9 px-2" onclick={() => bearbeiten(x)} aria-label="Eintrag {x.nr} ändern" title="Ändern"><Pencil size={17} /></button>
										<button class="btn btn-ruhig min-h-9 px-2" onclick={() => streichen(x)} aria-label={x.gestrichen ? `Streichung von Eintrag ${x.nr} aufheben` : `Eintrag ${x.nr} streichen`} title={x.gestrichen ? 'Streichung aufheben' : 'Streichen'}><Strikethrough size={17} /></button>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		</div>
	</div>

	<!-- Druck im Layout des Formulars -->
	<div class="hidden print:block"><EtbDruck zustand={z} /></div>

	<!-- Eintrag ändern -->
	<dialog bind:this={dlgEintrag} class="dialog">
		<form class="space-y-3 p-5" onsubmit={aenderungSpeichern}>
			<h2 class="display text-2xl">Eintrag {bearbeitet?.nr} ändern</h2>
			<p class="hinweis text-sm">Für Tippfehler. Was falsch war, besser streichen und neu eintragen.</p>
			<label class="block w-32"><span class="field-label">Uhrzeit</span><input class="input tabular" type="time" required bind:value={f.uhrzeit} /></label>
			<div class="grid grid-cols-2 gap-3">
				<label class="block"><span class="field-label">An</span><input class="input" list="etb-parteien" bind:value={f.an} /></label>
				<label class="block"><span class="field-label">Von</span><input class="input" list="etb-parteien" bind:value={f.von} /></label>
			</div>
			<label class="block"><span class="field-label">Inhalt</span><textarea class="input" rows="4" required bind:value={f.inhalt}></textarea></label>
			<label class="block"><span class="field-label">Erledigt einen Auftrag</span>
				<select class="input" bind:value={f.auftragUnter}>
					<option value="">Nein</option>
					{#each z.eintraege.filter((x) => x.auftrag && x.eid !== bearbeitet?.eid && x.nr < (bearbeitet?.nr ?? 0)) as x (x.eid)}<option value={x.eid}>Nr. {x.nr}: {x.inhalt.slice(0, 60)}</option>{/each}
				</select>
			</label>
			<label class="kreuz w-full"><input type="checkbox" bind:checked={f.auftrag} />Auftrag, bleibt offen bis zur Erledigung</label>
			<div class="flex justify-end gap-2 pt-2">
				<button type="button" class="btn" onclick={() => dlgEintrag?.close()}>Abbrechen</button>
				<button class="btn btn-primary">Speichern</button>
			</div>
		</form>
	</dialog>

	<!-- Angaben -->
	<dialog bind:this={dlgAngaben} class="dialog">
		<div class="space-y-4 p-5">
			<h2 class="display text-2xl">Angaben zum Tagebuch</h2>
			<fieldset class="grid gap-3 sm:grid-cols-2" disabled={!offen}>
				<label><span class="field-label">Datum</span><input class="input" type="date" value={z.kopf.datum} onchange={(e) => kopfAendern('datum', e.currentTarget.value)} /></label>
				<label><span class="field-label">Feuerwehr</span><input class="input" value={z.kopf.feuerwehr} onchange={(e) => kopfAendern('feuerwehr', e.currentTarget.value)} /></label>
				<label class="sm:col-span-2"><span class="field-label">Einsatzort</span><input class="input" value={z.kopf.einsatzort} onchange={(e) => kopfAendern('einsatzort', e.currentTarget.value)} /></label>
				<label class="sm:col-span-2"><span class="field-label">Bearbeiter</span><input class="input" value={z.kopf.bearbeiter} onchange={(e) => kopfAendern('bearbeiter', e.currentTarget.value)} /></label>
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
			<div class="flex flex-wrap items-center gap-2 pt-2">
				{#if offen}<button class="btn btn-gefahr" onclick={abschliessen}>Tagebuch abschließen</button>{/if}
				<span class="flex-1"></span>
				<button class="btn btn-primary" onclick={() => dlgAngaben?.close()}>Fertig</button>
			</div>
		</div>
	</dialog>

	<!-- Teilen -->
	<dialog bind:this={dlgTeilen} class="dialog">
		<div class="space-y-4 p-5">
			<h2 class="display text-2xl">Tagebuch teilen</h2>
			<p class="hinweis">Auf dem anderen Gerät „Tagebuch“ öffnen, „Tagebuch beitreten“ wählen und diesen Code eingeben, oder den Link öffnen.</p>
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

	.eintrag {
		display: grid;
		grid-template-columns: 2.75rem minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.75rem;
		padding: 0.75rem 1rem 0.75rem 0.75rem;
	}
	.nr {
		display: grid;
		place-items: center;
		height: 2.25rem;
		border-radius: 8px;
		background: var(--c-surface-3);
		font-weight: 800;
		font-stretch: 85%;
	}
	.nr.vorlaeufig {
		color: var(--c-ink-3);
		background: transparent;
		border: 1px dashed var(--c-line-strong);
	}
	.inhalt {
		margin-top: 0.15rem;
		font-size: 1.0625rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.gestrichen .inhalt,
	.gestrichen b {
		text-decoration: line-through;
		color: var(--c-ink-3);
	}
	.marke {
		padding: 0.05rem 0.45rem;
		border: 1px solid var(--c-line-strong);
		border-radius: 6px;
		color: var(--c-ink-2);
		font-weight: 600;
	}
	.marke.offen {
		border-color: var(--c-red);
		background: var(--c-red-soft);
		color: var(--c-red);
	}
	.aktionen {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.kontrolle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.25rem;
		padding: 0 0.5rem;
		border-radius: 8px;
		color: var(--c-ink-2);
		font-size: 0.875rem;
		font-weight: 650;
	}
	.kontrolle input {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--c-ok);
	}
	@media (max-width: 639px) {
		.eintrag {
			grid-template-columns: 2.5rem minmax(0, 1fr);
		}
		.aktionen {
			grid-column: 2;
		}
	}

	.dialog {
		width: min(560px, calc(100vw - 24px));
		max-height: calc(100dvh - 24px);
		margin: auto;
		padding: 0;
		border: 0;
		border-radius: var(--radius-card);
		background: var(--c-surface);
		color: var(--c-ink);
		box-shadow: var(--shadow-3);
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
</style>
