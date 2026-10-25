<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import TypMarke from '$lib/components/TypMarke.svelte';
	import { pageTitle } from '$lib/app';
	import { TYP_REIHENFOLGE, TYPEN } from '$lib/berichte/typen';
	import { datumAusIso, relativ } from '$lib/format';

	let { data } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{pageTitle('Einsatzberichte')}</title></svelte:head>

<div class="wrap pt-8">
	{#if data.eingereicht}
		<div class="mb-6 flex gap-2 rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status">
			<CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
			<p class="font-medium">Der Bericht ist eingereicht. Er kann jetzt nicht mehr geändert werden.</p>
		</div>
	{/if}

	<h1 class="display text-4xl sm:text-5xl">Einsatzberichte</h1>

	<section class="mt-8" aria-labelledby="neu">
		<h2 id="neu" class="text-lg font-bold">Neuen Bericht beginnen</h2>
		<!-- Nicht „disabled“ setzen: gesperrte Knöpfe schickt der Browser nicht mit, dann fehlt die Berichtsart -->
		<form
			method="POST"
			action="?/neu"
			class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
			onsubmit={(e) => {
				if (busy) e.preventDefault();
				busy = true;
			}}
		>
			{#each TYP_REIHENFOLGE as typ (typ)}
				<button name="typ" value={typ} class="typ card" aria-busy={busy} style:--typ={TYPEN[typ].farbe}>
					<span class="kopf" class:weiss={typ === 'tus'}>Aufnahmeblatt</span>
					<span class="block px-4 pt-3 pb-4 text-left">
						<span class="display block text-2xl">{TYPEN[typ].kurz}</span>
						<span class="mt-1 block text-sm text-ink-2">für {TYPEN[typ].titel}{TYPEN[typ].skizze ? ', mit Skizze' : ''}</span>
					</span>
				</button>
			{/each}
		</form>
	</section>

	<section class="mt-10" aria-labelledby="offen">
		<h2 id="offen" class="text-lg font-bold">Offene Berichte</h2>
		<p class="hinweis mt-1">Alle können offene Berichte bearbeiten. Eingereichte Berichte verschwinden aus dieser Liste.</p>
		{#if data.berichte.length === 0}
			<p class="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-ink-2">
				Kein offener Bericht. Wähle oben eine Berichtsart, um zu beginnen.
			</p>
		{:else}
			<ul class="mt-3 divide-y divide-line card overflow-hidden">
				{#each data.berichte as b (b.id)}
					<li>
						<a href="/berichte/{b.id}" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2">
							<TypMarke typ={b.typ} />
							<span class="min-w-0 flex-1">
								<span class="block truncate font-semibold">{b.einsatzort || 'Ohne Einsatzort'}</span>
								<span class="block text-sm text-ink-3">
									{datumAusIso(b.datum) || 'ohne Datum'}, angelegt von {b.erstelltVon ?? 'unbekannt'}, zuletzt {relativ(b.geaendertAm)}
								</span>
							</span>
							<span class="flex items-center gap-1.5 text-sm font-semibold" class:text-ok={b.unterschrieben === 2} class:text-ink-3={b.unterschrieben < 2}>
								<PenLine size={16} aria-hidden="true" />{b.unterschrieben} von 2 Unterschriften
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.typ {
		display: block;
		overflow: hidden;
		text-align: left;
		transition:
			box-shadow 120ms,
			background-color 120ms;
	}
	.typ:hover {
		background: var(--c-surface-2);
		box-shadow: 0 0 0 1px var(--c-ink-3);
	}
	.typ[aria-busy='true'] {
		opacity: 0.6;
		cursor: progress;
	}
	.kopf {
		display: block;
		padding: 0.35rem 1rem;
		background: var(--typ);
		color: #111;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.kopf.weiss {
		border-bottom: 1px solid var(--c-line-strong);
	}
</style>
