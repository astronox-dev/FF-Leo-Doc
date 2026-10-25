<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Timer from '@lucide/svelte/icons/timer';
	import { pageTitle } from '$lib/app';
	import { TYPEN } from '$lib/berichte/typen';
	import { datumAusIso, isoHeute, relativ } from '$lib/format';
	import { alleOffenenSenden, CODE, codeLesen, neueId, neuerCode, Sitzung } from '$lib/asue/sitzung.svelte';

	let { data } = $props();

	const STUFEN = { Brand: ['B1', 'B2', 'B3', 'B4'], Technisch: ['T1', 'T2', 'T3'], Schadstoff: ['S1', 'S2', 'S3'] };

	let datum = $state(isoHeute());
	let adresse = $state('');
	let stufe = $state('');
	let bericht = $state('');
	let code = $state('');
	let codeFehler = $state('');

	onMount(() => {
		void alleOffenenSenden();
	});

	// Adresse aus dem gewählten Bericht übernehmen
	$effect(() => {
		const b = data.berichte.find((x) => String(x.id) === bericht);
		if (b && !adresse.trim()) adresse = b.einsatzort;
	});

	async function anlegen(e: SubmitEvent) {
		e.preventDefault();
		const neu = neuerCode();
		const s = new Sitzung(neu);
		s.aktion('einsatz_angelegt', {
			datum,
			adresse: adresse.trim(),
			stufe,
			zeitGrenze: data.einstellungen.zeitGrenze,
			vorwarnung: data.einstellungen.vorwarnung,
			trupps: data.einstellungen.standardTrupps.map((name) => ({ id: neueId(), name, flasche: 300 }))
		});
		const b = data.berichte.find((x) => String(x.id) === bericht);
		if (b) s.aktion('bericht_zugeordnet', { berichtId: b.id, titel: `${TYPEN[b.typ].kurz} ${b.einsatzort}`.trim() });
		await s.senden();
		s.beenden();
		await goto(`/atemschutz/${neu}`);
	}

	function beitreten(e: SubmitEvent) {
		e.preventDefault();
		const c = codeLesen(code);
		if (!CODE.test(c)) {
			codeFehler = 'Der Code hat 6 Zeichen, z. B. K7M-4QX.';
			return;
		}
		goto(`/atemschutz/${c}`);
	}

	const offen = $derived(data.liste.filter((e) => !e.abgeschlossen));
	const fertig = $derived(data.liste.filter((e) => e.abgeschlossen));
</script>

<svelte:head><title>{pageTitle('Atemschutzüberwachung')}</title></svelte:head>

<div class="wrap pt-8">
	<h1 class="display text-center text-4xl sm:text-5xl">Atemschutzüberwachung</h1>
	<p class="mt-2 text-center text-ink-2">Neue Überwachung anlegen oder mit dem Code einer anderen beitreten.</p>

	<div class="mx-auto mt-8 grid max-w-4xl items-start justify-center gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
		<form class="card space-y-4 p-6" onsubmit={anlegen}>
			<h2 class="display text-2xl">Überwachung anlegen</h2>
			<p class="hinweis">Danach stehen {data.einstellungen.standardTrupps.join(', ')} bereit.</p>
			<label class="block"><span class="field-label">Datum</span><input class="input" type="date" required bind:value={datum} /></label>
			<label class="block"><span class="field-label">Adresse</span><input class="input" required autocomplete="off" placeholder="Straße und Hausnummer, Ort" bind:value={adresse} /></label>
			<label class="block"><span class="field-label">Einsatzstufe (optional)</span>
				<select class="input" bind:value={stufe}>
					<option value="">Keine Angabe</option>
					{#each Object.entries(STUFEN) as [gruppe, liste] (gruppe)}
						<optgroup label={gruppe}>{#each liste as s (s)}<option>{s}</option>{/each}</optgroup>
					{/each}
				</select>
			</label>
			{#if data.berichte.length}
				<label class="block"><span class="field-label">Einsatzbericht zuordnen (optional)</span>
					<select class="input" bind:value={bericht}>
						<option value="">Kein Bericht</option>
						{#each data.berichte as b (b.id)}<option value={String(b.id)}>{TYPEN[b.typ].kurz}: {b.einsatzort || 'ohne Einsatzort'} ({datumAusIso(b.datum)})</option>{/each}
					</select>
				</label>
			{/if}
			<button class="btn btn-primary min-h-12 w-full text-base">Überwachung anlegen</button>
		</form>

		<form class="card space-y-4 p-6" onsubmit={beitreten}>
			<h2 class="display text-2xl">Überwachung beitreten</h2>
			<p class="hinweis">Den Code zeigt das Gerät, auf dem die Überwachung angelegt wurde.</p>
			<label class="block"><span class="field-label">Code</span>
				<input class="input text-lg tracking-widest uppercase" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7M-4QX" maxlength="9" bind:value={code} oninput={() => (codeFehler = '')} aria-invalid={codeFehler ? true : undefined} />
			</label>
			{#if codeFehler}<p class="font-semibold text-danger" role="alert">{codeFehler}</p>{/if}
			<button class="btn min-h-12 w-full text-base">Beitreten</button>
		</form>
	</div>

	{#each [['Laufend', offen], ['Abgeschlossen', fertig]] as const as [titel, liste] (titel)}
		{#if liste.length}
			<section class="mx-auto mt-10 max-w-4xl">
				<h2 class="text-lg font-bold">{titel}</h2>
				<ul class="mt-3 divide-y divide-line card overflow-hidden">
					{#each liste as e (e.id)}
						<li>
							<a href="/atemschutz/{e.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
								<span class="grid size-9 shrink-0 place-items-center rounded-lg {e.abgeschlossen ? 'bg-surface-3 text-ink-3' : 'bg-red text-white'}"><Timer size={18} aria-hidden="true" /></span>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-semibold">{[e.adresse, e.stufe].filter(Boolean).join(', ') || 'Ohne Adresse'}</span>
									<span class="block text-sm text-ink-3">{datumAusIso(e.datum)}, Code {e.id.slice(0, 3)}-{e.id.slice(3)}, angelegt {relativ(e.erstellt)}</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/each}
</div>
