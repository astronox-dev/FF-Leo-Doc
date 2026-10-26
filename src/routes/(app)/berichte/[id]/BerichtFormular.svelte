<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Eye from '@lucide/svelte/icons/eye';
	import FileDown from '@lucide/svelte/icons/file-down';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Send from '@lucide/svelte/icons/send';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Timer from '@lucide/svelte/icons/timer';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import TypMarke from '$lib/components/TypMarke.svelte';
	import Abschnitt from '$lib/components/formular/Abschnitt.svelte';
	import Zeile from '$lib/components/formular/Zeile.svelte';
	import Kreuze from '$lib/components/formular/Kreuze.svelte';
	import Zeitpunkt from '$lib/components/formular/Zeitpunkt.svelte';
	import Teilnahme from '$lib/components/formular/Teilnahme.svelte';
	import Unterschrift from '$lib/components/formular/Unterschrift.svelte';
	import SkizzenEditor from '$lib/components/skizze/SkizzenEditor.svelte';
	import { pageTitle } from '$lib/app';
	import { datumAusIso } from '$lib/format';
	import {
		ALARMIERUNG_DURCH, ANWESEND, BRANDSCHUTZ, EIGENES_GEBIET, GEFAHRENKLASSE, KM_FAHRZEUGE, KM_ZUSATZ, LOESCHWASSER,
		MELDUNG_DURCH, SCHUTZSTUFE, SONDERGERAETE, STRAHLROHRE, TAETIGKEIT, TUS_OBJEKTE, TYPEN, WETTER, WLFK,
		leererGeschaedigter, type Zelle
	} from '$lib/berichte/typen';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const typ = data.bericht.typ;
	/** Kopffarbe der Abschnitte wie auf dem Aufnahmeblatt */
	const farbe = TYPEN[typ].farbe;
	const flach = (z: Zelle[][]) => z.flat().filter((x): x is [string, number] => !!x).map((x) => x[0]);

	let daten = $state(structuredClone(data.bericht.daten));
	let version = data.bericht.version;
	let gespeichert = JSON.stringify(daten);

	/* ------------------------------------------------ Automatisch speichern */

	type Zustand = 'gespeichert' | 'speichert' | 'ungespeichert' | 'offline' | 'konflikt';
	let zustand = $state<Zustand>('gespeichert');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let laeuft = false;

	$effect(() => {
		const json = JSON.stringify(daten);
		if (json === gespeichert) return;
		zustand = 'ungespeichert';
		clearTimeout(timer);
		timer = setTimeout(speichern, 700);
	});

	async function speichern(): Promise<boolean> {
		if (laeuft) {
			timer = setTimeout(speichern, 400);
			return false;
		}
		const json = JSON.stringify(daten);
		if (json === gespeichert) {
			zustand = 'gespeichert';
			return true;
		}
		laeuft = true;
		zustand = 'speichert';
		try {
			const r = await fetch(`/api/berichte/${data.bericht.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ version, daten: JSON.parse(json) })
			});
			if (r.status === 409) {
				zustand = 'konflikt';
				return false;
			}
			if (!r.ok) throw new Error(String(r.status));
			version = (await r.json()).version;
			gespeichert = json;
			zustand = JSON.stringify(daten) === gespeichert ? 'gespeichert' : 'ungespeichert';
			if (zustand === 'ungespeichert') timer = setTimeout(speichern, 300);
			return true;
		} catch {
			zustand = 'offline';
			timer = setTimeout(speichern, 5000);
			return false;
		} finally {
			laeuft = false;
		}
	}

	function verlassenWarnen(e: BeforeUnloadEvent) {
		if (zustand !== 'gespeichert') e.preventDefault();
	}

	/* ------------------------------------------------ Einreichen */

	let fehlt = $state<string[]>([]);
	let reicht = $state(false);

	async function einreichen() {
		if (!(await speichern()) && zustand !== 'gespeichert') return;
		if (!confirm('Bericht jetzt einreichen? Danach kann er nicht mehr geändert werden und verschwindet aus der Liste der offenen Berichte.')) return;
		reicht = true;
		try {
			const r = await fetch(`/api/berichte/${data.bericht.id}/einreichen`, { method: 'POST' });
			if (r.status === 400) {
				fehlt = (await r.json()).fehlt;
				return;
			}
			if (!r.ok) throw new Error();
			await goto('/berichte?eingereicht', { invalidateAll: true });
		} catch {
			alert('Einreichen hat nicht geklappt. Bitte Verbindung prüfen und erneut versuchen.');
		} finally {
			reicht = false;
		}
	}

	const abschnitte = $derived([
		['alarmierung', 'Alarmierung'],
		['einsatzort', 'Einsatzort'],
		['geschaedigte', 'Geschädigte'],
		['geraete', 'Geräte'],
		['hilfe', 'Fremde FF, Verletzte'],
		['material', 'Material, Löschwasser'],
		['taetigkeit', 'Situation, Tätigkeit'],
		['zeiten', 'Zeiten, Kilometer'],
		...(TYPEN[typ].skizze ? [['skizze', 'Skizze']] : []),
		['teilnahme', 'Teilnahme'],
		...(data.asue.length ? [['asue', 'Atemschutz']] : []),
		...(data.etb.length ? [['etb', 'Tagebuch']] : []),
		['abschluss', 'Unterschriften']
	] as const);
</script>

<svelte:head><title>{pageTitle(`${TYPEN[typ].kurz} ${daten.einsatzort}`)}</title></svelte:head>
<svelte:window onbeforeunload={verlassenWarnen} />

<!-- Kopf mit Speicherstatus -->
<div class="sticky top-16 z-30 border-b border-line bg-bg/95 backdrop-blur print:hidden">
	<div class="wrap flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
		<TypMarke {typ} gross />
		<h1 class="min-w-0 flex-1 truncate text-xl font-bold">{daten.einsatzort || 'Neuer Bericht'}</h1>
		<span class="flex items-center gap-1.5 text-sm font-semibold" class:text-ok={zustand === 'gespeichert'} class:text-ink-3={zustand === 'speichert' || zustand === 'ungespeichert'} class:text-danger={zustand === 'offline' || zustand === 'konflikt'} role="status">
			{#if zustand === 'gespeichert'}<Check size={16} aria-hidden="true" />Gespeichert
			{:else if zustand === 'speichert'}<LoaderCircle size={16} class="animate-spin" aria-hidden="true" />Speichert …
			{:else if zustand === 'ungespeichert'}Änderungen …
			{:else if zustand === 'offline'}<CloudOff size={16} aria-hidden="true" />Keine Verbindung, versucht es weiter
			{:else}<CircleAlert size={16} aria-hidden="true" />Von jemand anderem geändert{/if}
		</span>
		<div class="flex gap-2">
			<a href="/berichte/{data.bericht.id}/vorschau" class="btn" onclick={() => speichern()}><Eye size={18} aria-hidden="true" />Vorschau</a>
			<a href="/berichte/{data.bericht.id}/pdf" class="btn" onclick={() => speichern()} data-sveltekit-reload><FileDown size={18} aria-hidden="true" />PDF</a>
		</div>
	</div>
	{#if zustand === 'konflikt'}
		<div class="wrap pb-3">
			<div class="flex flex-wrap items-center gap-3 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert">
				<p class="flex-1 font-medium">Jemand anderer hat diesen Bericht inzwischen gespeichert. Lade neu, um seinen Stand zu sehen. Deine letzten Änderungen gehen dabei verloren.</p>
				<button class="btn" onclick={async () => { await invalidateAll(); location.reload(); }}>Neu laden</button>
			</div>
		</div>
	{/if}
</div>

<div class="wrap mt-6 grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
	<!-- Abschnitte -->
	<nav class="hidden lg:block" aria-label="Abschnitte">
		<ol class="sticky top-40 space-y-0.5 text-[0.9375rem]">
			{#each abschnitte as [id, name] (id)}
				<li><a href="#{id}" class="block rounded-lg px-3 py-1.5 font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">{name}</a></li>
			{/each}
		</ol>
	</nav>

	<div class="min-w-0 space-y-6">
		<Abschnitt id="alarmierung" titel="Alarmierung" {farbe}>
			<Zeile label="Alarmierung"><Zeitpunkt id="alarmierung" label="Alarmierung" bind:wert={daten.alarmierung} /></Zeile>
			<Zeile label="Ausfahrt"><Zeitpunkt id="ausfahrt" label="Ausfahrt" bind:wert={daten.ausfahrt} /></Zeile>
			<Zeile label="Alarmierung durch">
				<Kreuze optionen={flach(ALARMIERUNG_DURCH(typ))} bind:wert={daten.alarmierungDurch} />
				{#if typ === 'brand' && daten.alarmierungDurch.includes('TUS')}
					<label class="block max-w-md"><span class="field-label">TUS</span><input class="input" bind:value={daten.tusText} /></label>
				{/if}
			</Zeile>
			<Zeile label="Meldung durch"><Kreuze optionen={flach(MELDUNG_DURCH)} bind:wert={daten.meldungDurch} /></Zeile>
			<Zeile label="Anwesend"><Kreuze optionen={flach(ANWESEND)} bind:wert={daten.anwesend} /></Zeile>
		</Abschnitt>

		<Abschnitt id="einsatzort" titel="Einsatzort und Wetter" {farbe}>
			<Zeile label="Einsatzort" hinweis="Ort; Straße; Hausnummer / KM">
				<input class="input" placeholder="z. B. Leopoldsdorf; Hauptstraße 12" bind:value={daten.einsatzort} aria-label="Einsatzort" />
			</Zeile>
			<Zeile label="Eigenes Einsatzgebiet"><Kreuze optionen={EIGENES_GEBIET} bind:wert={daten.eigenesGebiet} /></Zeile>
			<Zeile label="Wetter"><Kreuze optionen={flach(WETTER)} bind:wert={daten.wetter} /></Zeile>
		</Abschnitt>

		<Abschnitt id="geschaedigte" titel={typ === 'tus' ? 'Geschädigter' : 'Geschädigte'} {farbe}>
			{#if typ === 'tus'}
				<Zeile label="Geschädigter" hinweis="Objekt mit Brandmeldeanlage"><Kreuze optionen={flach(TUS_OBJEKTE)} bind:wert={daten.tusObjekte} /></Zeile>
			{:else}
				<Zeile label="Anz. Geschädigte">
					<input class="input max-w-32" inputmode="numeric" bind:value={daten.anzGeschaedigte} aria-label="Anzahl Geschädigte" />
				</Zeile>
				{#each daten.geschaedigte as g, i (i)}
					<Zeile label="Geschädigter {i + 1}" hinweis={i === 0 ? 'Angaben laut Zulassungsschein' : 'kommt aufs Sonderblatt'}>
						{#snippet aktion()}
							{#if daten.geschaedigte.length > 1}
								<button type="button" class="btn btn-gefahr mt-1 min-h-8 px-2 text-sm font-semibold" onclick={() => daten.geschaedigte.splice(i, 1)}><X size={16} aria-hidden="true" />Entfernen</button>
							{/if}
						{/snippet}
						<div class="grid gap-3 md:grid-cols-2">
							<label><span class="field-label">Vorname, Zuname</span><input class="input" bind:value={g.name} /></label>
							<label><span class="field-label">Anschrift</span><input class="input" bind:value={g.anschrift} /></label>
							<label><span class="field-label">Kfz-Kennzeichen</span><input class="input" bind:value={g.kennzeichen} /></label>
							<label><span class="field-label">Marke / Type</span><input class="input" bind:value={g.marke} /></label>
							<label><span class="field-label">Name Fahrer</span><input class="input" bind:value={g.fahrer} /></label>
							<label><span class="field-label">Geb. Datum</span><input class="input" bind:value={g.gebDatum} placeholder="TT.MM.JJJJ" /></label>
							<label class="md:col-span-2"><span class="field-label">Anschrift Fahrer</span><input class="input" bind:value={g.fahrerAnschrift} /></label>
						</div>
					</Zeile>
				{/each}
				<Zeile voll>
					<button type="button" class="btn w-fit" onclick={() => daten.geschaedigte.push(leererGeschaedigter())}><Plus size={18} aria-hidden="true" />Weiteren Geschädigten</button>
				</Zeile>
			{/if}
		</Abschnitt>

		<Abschnitt id="geraete" titel="Geräte" {farbe}>
			<Zeile label="Eingesetzte Geräte">
				{#if typ === 'tus'}<label class="kreuz w-fit"><input type="checkbox" bind:checked={daten.wbk} />WBK</label>{/if}
				<textarea class="input" rows="4" bind:value={daten.geraete} aria-label="Eingesetzte Geräte"></textarea>
			</Zeile>
			{#if typ !== 'tus'}
				<Zeile label="Sondergeräte">
					<Kreuze optionen={flach(SONDERGERAETE[typ])} bind:wert={daten.sondergeraete} />
					{#if typ === 'schadstoff' && daten.sondergeraete.includes('Auffangwannen')}
						<label class="block max-w-48"><span class="field-label">Auffangwannen: Liter</span><input class="input" inputmode="decimal" bind:value={daten.auffangwannenLiter} /></label>
					{/if}
				</Zeile>
				{#if typ === 'brand'}<Zeile label="Schutzstufe"><Kreuze optionen={SCHUTZSTUFE} bind:wert={daten.schutzstufe} /></Zeile>{/if}
			{/if}
		</Abschnitt>

		<Abschnitt id="hilfe" titel="Fremde Feuerwehren und Verletzte" {farbe}>
			<Zeile label="Fremde Feuerwehren" hinweis="Hilfebericht anfordern! Mannschaftsstärke (MS), Dauer (D)">
				{#each [['mariaLanzendorf', 'FF Maria-Lanzendorf'], ['lanzendorf', 'FF Lanzendorf']] as const as [key, name] (key)}
					<div class="flex flex-wrap items-end gap-3">
						<label class="kreuz min-w-52"><input type="checkbox" bind:checked={daten.fremdeFF[key].an} />{name}</label>
						<label class="w-28"><span class="field-label">MS</span><input class="input" inputmode="numeric" bind:value={daten.fremdeFF[key].ms} oninput={() => (daten.fremdeFF[key].an = true)} /></label>
						<label class="w-36"><span class="field-label">Dauer</span><input class="input" bind:value={daten.fremdeFF[key].d} placeholder="z. B. 2 h" oninput={() => (daten.fremdeFF[key].an = true)} /></label>
					</div>
				{/each}
				<label class="block"><span class="field-label">Weitere Feuerwehren</span><input class="input" bind:value={daten.fremdeFF.text} /></label>
			</Zeile>
			<Zeile label="Verletzte Personen" hinweis="Zivil (Z); FF (F) – Name; Feuerwehr">
				<textarea class="input" rows="3" bind:value={daten.verletzte} aria-label="Verletzte Personen"></textarea>
			</Zeile>
		</Abschnitt>

		<Abschnitt id="material" titel="Verbrauchsmaterial und Löschwasser" {farbe}>
			<Zeile label="Verbrauchsmaterialien" hinweis={typ === 'tus' ? undefined : 'Mengenangabe, z. B. Ölbindem. Kanister gelb 6 kg / blau 12 kg'}>
				{#if typ !== 'tus'}
					<div class="flex flex-wrap items-end gap-3">
						<label class="kreuz min-w-44"><input type="checkbox" bind:checked={daten.verbrauch.schaummittel} />Schaummittel</label>
						<label class="w-44"><span class="field-label">Liter / Kanister</span><input class="input" bind:value={daten.verbrauch.schaummittelMenge} oninput={() => (daten.verbrauch.schaummittel = true)} /></label>
					</div>
					<div class="flex flex-wrap items-end gap-3">
						<label class="kreuz min-w-44"><input type="checkbox" bind:checked={daten.verbrauch.oelbindemittel} />Ölbindemittel</label>
						<label class="w-44"><span class="field-label">kg / Kanister</span><input class="input" bind:value={daten.verbrauch.oelbindemittelMenge} oninput={() => (daten.verbrauch.oelbindemittel = true)} /></label>
					</div>
				{/if}
				<textarea class="input" rows="2" placeholder="Weitere Verbrauchsmaterialien" bind:value={daten.verbrauch.text} aria-label="Verbrauchsmaterialien"></textarea>
			</Zeile>
			<Zeile label="Löschwasserversorgung"><Kreuze optionen={LOESCHWASSER} bind:wert={daten.loeschwasser} /></Zeile>
		</Abschnitt>

		<Abschnitt id="taetigkeit" titel="Situation und Tätigkeit" {farbe}>
			<Zeile label="Situation bei der Ankunft" hinweis="kurze Beschreibung der Situation">
				{#if typ === 'tus'}
					<div class="flex flex-wrap items-center gap-3">
						<span class="font-semibold">TUS-Brandmeldealarm; Melder</span>
						<input class="input w-24" bind:value={daten.melder[0]} aria-label="Melder Gruppe" />
						<span>/</span>
						<input class="input w-24" bind:value={daten.melder[1]} aria-label="Melder Nummer" />
					</div>
				{/if}
				<textarea class="input" rows="5" bind:value={daten.situation} aria-label="Situation bei der Ankunft"></textarea>
			</Zeile>
			<Zeile label="Tätigkeit am Einsatzort" hinweis="kurze Beschreibung der Tätigkeit">
				{#if typ === 'tus'}
					<p class="rounded-lg bg-surface-2 px-3 py-2 text-[0.9375rem]">Aufsuchen des ausgelösten Melders; Kontrolle des Bereichs mittels WBK. Brandmeldeanlage zurückgestellt.</p>
				{/if}
				<Kreuze optionen={TAETIGKEIT[typ]} bind:wert={daten.taetigkeitChecks} />
				<textarea class="input" rows="8" bind:value={daten.taetigkeit} aria-label="Tätigkeit am Einsatzort"></textarea>
			</Zeile>
			{#if typ === 'technik'}
				<Zeile label="Brandschutz"><Kreuze optionen={BRANDSCHUTZ} bind:wert={daten.brandschutz} /></Zeile>
				<Zeile label="Tätigkeiten WLF-K">
					<Kreuze optionen={WLFK} bind:wert={daten.wlfk} />
					<textarea class="input" rows="2" bind:value={daten.wlfkText} aria-label="Tätigkeiten WLF-K"></textarea>
				</Zeile>
			{/if}
			{#if typ === 'schadstoff'}
				<Zeile label="Gefahrenklasse"><Kreuze optionen={flach(GEFAHRENKLASSE)} bind:wert={daten.gefahrenklasse} /></Zeile>
			{/if}
		</Abschnitt>

		<Abschnitt id="zeiten" titel="Zeiten und Kilometer" {farbe}>
			{#if typ === 'brand' || typ === 'schadstoff'}
				<Zeile label="Brandwache">
					<div class="flex flex-wrap gap-2">
						<input type="date" class="input w-44" bind:value={daten.brandwache.datum} aria-label="Brandwache Datum" />
						<label class="flex items-center gap-2">von <input type="time" class="input w-32" bind:value={daten.brandwache.von} /></label>
						<label class="flex items-center gap-2">bis <input type="time" class="input w-32" bind:value={daten.brandwache.bis} /></label>
					</div>
				</Zeile>
				<Zeile label="Anzahl der Strahlrohre (FAV)"><Kreuze optionen={STRAHLROHRE} bind:wert={daten.strahlrohre} /></Zeile>
			{/if}
			{#if typ !== 'technik'}<Zeile label="Brand aus"><Zeitpunkt id="brandaus" label="Brand aus" bind:wert={daten.brandAus} /></Zeile>{/if}
			<Zeile label="Rückkehr"><Zeitpunkt id="rueckkehr" label="Rückkehr" bind:wert={daten.rueckkehr} /></Zeile>
			<Zeile label="Gefahrene Kilometer">
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
					{#each KM_FAHRZEUGE as f (f.key)}
						<label>
							<span class="block text-sm font-semibold">{f.name}{f.funk ? ` (${f.funk})` : ''}</span>
							<input class="input mt-1" inputmode="numeric" bind:value={daten.km[f.key]} />
						</label>
					{/each}
				</div>
				<Kreuze optionen={KM_ZUSATZ} bind:wert={daten.kmZusatz} />
			</Zeile>
			<Zeile label="Einsatzmängel / Anmerkungen"><textarea class="input" rows="3" bind:value={daten.maengel} aria-label="Einsatzmängel / Anmerkungen"></textarea></Zeile>
		</Abschnitt>

		{#if TYPEN[typ].skizze}
			<Abschnitt id="skizze" titel="Skizze" hinweis="Kartenausschnitt wählen und mit den Zeichen der Legende ergänzen." {farbe}>
				<Zeile voll>
					<SkizzenEditor bind:wert={daten.skizze} {typ} einsatzort={daten.einsatzort} funknamen={data.funknamen} />
				</Zeile>
			</Abschnitt>
		{/if}

		<Abschnitt id="teilnahme" titel="Teilnahme Einsatz" {farbe}>
			<Zeile voll>
				<Teilnahme mannschaft={data.mannschaft} bind:wert={daten.teilnahme} />
			</Zeile>
		</Abschnitt>

		{#if data.asue.length}
			<Abschnitt id="asue" titel="Atemschutzüberwachung" hinweis="Zugeordnete Protokolle werden im Ausdruck angehängt." {farbe}>
				<Zeile voll>
					<ul class="space-y-2">
						{#each data.asue as a (a.id)}
							<li><a href="/atemschutz/{a.id}" class="flex items-center gap-2 font-semibold text-red hover:underline"><Timer size={18} aria-hidden="true" />{a.adresse || 'Ohne Adresse'}, {datumAusIso(a.datum)}, Code {a.id.slice(0, 3)}-{a.id.slice(3)}</a></li>
						{/each}
					</ul>
				</Zeile>
			</Abschnitt>
		{/if}

		{#if data.etb.length}
			<Abschnitt id="etb" titel="Einsatztagebuch" hinweis="Zugeordnete Tagebücher werden im Ausdruck im Querformat angehängt." {farbe}>
				<Zeile voll>
					<ul class="space-y-2">
						{#each data.etb as t (t.id)}
							<li><a href="/einsatztagebuch/{t.id}" class="flex items-center gap-2 font-semibold text-red hover:underline"><NotebookPen size={18} aria-hidden="true" />{t.einsatzort || 'Ohne Einsatzort'}, {datumAusIso(t.datum)}, {t.eintraege === 1 ? '1 Eintrag' : `${t.eintraege} Einträge`}</a></li>
						{/each}
					</ul>
				</Zeile>
			</Abschnitt>
		{/if}

		<Abschnitt id="abschluss" titel="Unterschreiben und einreichen" hinweis="Mit Standesbuchnummer und Unterschrift von Ausfüllendem und Einsatzleiter. Nach dem Einreichen ist der Bericht nicht mehr änderbar." {farbe}>
			<Zeile voll>
				<div class="grid gap-4 xl:grid-cols-2">
					<Unterschrift rolle="Ausfüllender" mannschaft={data.mannschaft} bind:wert={daten.unterschriften.ausfuellender} />
					<Unterschrift rolle="Einsatzleiter" mannschaft={data.mannschaft} bind:wert={daten.unterschriften.einsatzleiter} />
				</div>
			</Zeile>
			<Zeile voll>
				{#if fehlt.length}
					<div class="flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert">
						<CircleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
						<p class="font-medium">Zum Einreichen fehlt noch: {fehlt.join(', ')}.</p>
					</div>
				{/if}
				<div class="flex flex-wrap items-center gap-3">
					<button type="button" class="btn btn-primary min-h-12 px-6 text-base" onclick={einreichen} disabled={reicht}>
						<Send size={18} aria-hidden="true" />{reicht ? 'Wird eingereicht …' : 'Bericht einreichen'}
					</button>
					<a href="/berichte/{data.bericht.id}/vorschau" class="btn min-h-12" onclick={() => speichern()}><Eye size={18} aria-hidden="true" />Vorschau ansehen</a>
					{#if data.darfLoeschen}
						<form method="POST" action="?/loeschen" class="ml-auto" use:enhance={({ cancel }) => { if (!confirm('Diesen Bericht endgültig löschen?')) cancel(); }}>
							<button class="btn btn-gefahr"><Trash2 size={18} aria-hidden="true" />Bericht löschen</button>
						</form>
					{/if}
				</div>
			</Zeile>
		</Abschnitt>
	</div>
</div>
