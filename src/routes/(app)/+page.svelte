<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import Timer from '@lucide/svelte/icons/timer';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TypMarke from '$lib/components/TypMarke.svelte';
	import { pageTitle } from '$lib/app';
	import { TYP_REIHENFOLGE } from '$lib/berichte/typen';
	import { datumAusIso, relativ } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><title>{pageTitle()}</title></svelte:head>

<div class="wrap pt-8">
	{#if data.passwortGeaendert}
		<div class="mb-6 flex gap-2 rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status">
			<CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
			<p class="font-medium">Dein Passwort ist geändert.</p>
		</div>
	{/if}

	<h1 class="display text-4xl sm:text-5xl">Servus {data.user.name.split(' ')[0]}</h1>
	<p class="mt-2 text-ink-2">Was steht an?</p>

	<div class="mt-8 grid gap-4 md:grid-cols-2">
		<a href="/berichte" class="kachel card group">
			<div class="p-6">
				<FileText size={34} class="text-red" aria-hidden="true" />
				<h2 class="display mt-4 text-3xl">Einsatzbericht verfassen</h2>
				<p class="mt-2 text-ink-2">Brand, Technik, Schadstoff oder TUS: Aufnahmeblatt digital ausfüllen, Skizze zeichnen, unterschreiben und einreichen.</p>
				<span class="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
					{#each TYP_REIHENFOLGE as typ (typ)}<TypMarke {typ} />{/each}
				</span>
				<p class="mt-4 font-semibold text-red">
					{data.anzahlOffen === 0 ? 'Keine offenen Berichte' : data.anzahlOffen === 1 ? '1 offener Bericht' : `${data.anzahlOffen} offene Berichte`}
				</p>
			</div>
		</a>
		<a href="/atemschutz" class="kachel card group">
			<div class="p-6">
				<Timer size={34} class="text-red" aria-hidden="true" />
				<h2 class="display mt-4 text-3xl">Atemschutzüberwachung</h2>
				<p class="mt-2 text-ink-2">Trupps unter Atemschutz mit Zeit, Vorwarnung und Alarm überwachen, gemeinsam auf mehreren Geräten.</p>
				<p class="mt-4 font-semibold text-red">
					{data.asue.length === 0 ? 'Keine laufende Überwachung' : data.asue.length === 1 ? '1 laufende Überwachung' : `${data.asue.length} laufende Überwachungen`}
				</p>
			</div>
		</a>
	</div>

	{#if data.offen.length || data.asue.length}
		<div class="mt-10 grid gap-8 md:grid-cols-2">
			{#if data.offen.length}
				<section>
					<h2 class="text-lg font-bold">Offene Berichte</h2>
					<ul class="mt-3 divide-y divide-line card overflow-hidden">
						{#each data.offen as b (b.id)}
							<li>
								<a href="/berichte/{b.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
									<TypMarke typ={b.typ} />
									<span class="min-w-0 flex-1">
										<span class="block truncate font-semibold">{b.einsatzort || 'Ohne Einsatzort'}</span>
										<span class="block text-sm text-ink-3">{datumAusIso(b.datum)}, zuletzt {relativ(b.geaendertAm)}</span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if data.asue.length}
				<section>
					<h2 class="text-lg font-bold">Laufende Atemschutzüberwachung</h2>
					<ul class="mt-3 divide-y divide-line card overflow-hidden">
						{#each data.asue as e (e.id)}
							<li>
								<a href="/atemschutz/{e.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
									<span class="grid size-9 place-items-center rounded-lg bg-red text-white"><Timer size={18} aria-hidden="true" /></span>
									<span class="min-w-0 flex-1">
										<span class="block truncate font-semibold">{e.adresse || 'Ohne Adresse'}</span>
										<span class="block text-sm text-ink-3">{datumAusIso(e.datum)}, Code {e.id.slice(0, 3)}-{e.id.slice(3)}</span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Flach: beim Überfahren wird nur der Rahmen kräftiger */
	.kachel {
		display: block;
		overflow: hidden;
		transition:
			box-shadow 120ms,
			background-color 120ms;
	}
	.kachel:hover {
		background: var(--c-surface-2);
		box-shadow: 0 0 0 1px var(--c-ink-3);
	}
</style>
