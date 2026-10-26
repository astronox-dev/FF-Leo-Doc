<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import { pageTitle } from '$lib/app';
	import { TYPEN } from '$lib/berichte/typen';
	import { datumAusIso, isoHeute, relativ } from '$lib/format';
	import { CODE, codeAnzeigen, codeLesen, neuerCode } from '$lib/live/sitzung.svelte';
	import { alleOffenenSenden, TagebuchSitzung } from '$lib/etb/sitzung.svelte';

	let { data } = $props();

	let datum = $state(isoHeute());
	let einsatzort = $state('');
	let feuerwehr = $state('FF Leopoldsdorf');
	let bearbeiter = $state(page.data.user?.name ?? '');
	let bericht = $state('');
	let code = $state('');
	let codeFehler = $state('');

	onMount(() => {
		void alleOffenenSenden();
	});

	// Einsatzort aus dem gewählten Bericht übernehmen
	$effect(() => {
		const b = data.berichte.find((x) => String(x.id) === bericht);
		if (b && !einsatzort.trim()) einsatzort = b.einsatzort;
	});

	async function anlegen(e: SubmitEvent) {
		e.preventDefault();
		const neu = neuerCode();
		const s = new TagebuchSitzung(neu);
		s.aktion('tagebuch_angelegt', { datum, einsatzort: einsatzort.trim(), feuerwehr: feuerwehr.trim(), bearbeiter: bearbeiter.trim() });
		const b = data.berichte.find((x) => String(x.id) === bericht);
		if (b) s.aktion('bericht_zugeordnet', { berichtId: b.id, titel: `${TYPEN[b.typ].kurz} ${b.einsatzort}`.trim() });
		await s.senden();
		s.beenden();
		await goto(`/einsatztagebuch/${neu}`);
	}

	function beitreten(e: SubmitEvent) {
		e.preventDefault();
		const c = codeLesen(code);
		if (!CODE.test(c)) {
			codeFehler = 'Der Code hat 6 Zeichen, z. B. K7M-4QX.';
			return;
		}
		goto(`/einsatztagebuch/${c}`);
	}

	const offen = $derived(data.liste.filter((t) => !t.abgeschlossen));
	const fertig = $derived(data.liste.filter((t) => t.abgeschlossen));
</script>

<svelte:head><title>{pageTitle('Einsatztagebuch')}</title></svelte:head>

<div class="wrap pt-8">
	<h1 class="display text-center text-4xl sm:text-5xl">Einsatztagebuch</h1>
	<p class="mt-2 text-center text-ink-2">Neues Tagebuch anlegen oder mit dem Code eines anderen Geräts mitschreiben.</p>

	<div class="mx-auto mt-8 grid max-w-4xl items-start justify-center gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
		<form class="card space-y-4 p-6" onsubmit={anlegen}>
			<h2 class="display text-2xl">Tagebuch anlegen</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block"><span class="field-label">Datum</span><input class="input" type="date" required bind:value={datum} /></label>
				<label class="block"><span class="field-label">Feuerwehr</span><input class="input" required bind:value={feuerwehr} /></label>
			</div>
			<label class="block"><span class="field-label">Einsatzort</span><input class="input" required autocomplete="off" placeholder="Straße und Hausnummer, Ort" bind:value={einsatzort} /></label>
			<label class="block"><span class="field-label">Bearbeiter</span><input class="input" required bind:value={bearbeiter} /></label>
			{#if data.berichte.length}
				<label class="block"><span class="field-label">Einsatzbericht zuordnen (optional)</span>
					<select class="input" bind:value={bericht}>
						<option value="">Kein Bericht</option>
						{#each data.berichte as b (b.id)}<option value={String(b.id)}>{TYPEN[b.typ].kurz}: {b.einsatzort || 'ohne Einsatzort'} ({datumAusIso(b.datum)})</option>{/each}
					</select>
				</label>
			{/if}
			<button class="btn btn-primary min-h-12 w-full text-base">Tagebuch anlegen</button>
		</form>

		<form class="card space-y-4 p-6" onsubmit={beitreten}>
			<h2 class="display text-2xl">Tagebuch beitreten</h2>
			<p class="hinweis">Den Code zeigt das Gerät, auf dem das Tagebuch angelegt wurde.</p>
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
					{#each liste as t (t.id)}
						<li>
							<a href="/einsatztagebuch/{t.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
								<span class="grid size-9 shrink-0 place-items-center rounded-lg {t.abgeschlossen ? 'bg-surface-3 text-ink-3' : 'bg-red text-white'}"><NotebookPen size={18} aria-hidden="true" /></span>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-semibold">{t.einsatzort || 'Ohne Einsatzort'}</span>
									<span class="block text-sm text-ink-3">{datumAusIso(t.datum)}, {t.eintraege === 1 ? '1 Eintrag' : `${t.eintraege} Einträge`}, Code {codeAnzeigen(t.id)}, angelegt {relativ(t.erstellt)}</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/each}
</div>
