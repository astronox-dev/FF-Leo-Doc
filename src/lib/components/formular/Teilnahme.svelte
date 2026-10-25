<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import { TEILNAHME_FAHRZEUGE, type MitgliedKurz, type Teilnahme } from '$lib/berichte/typen';

	let { mannschaft, wert = $bindable() }: { mannschaft: MitgliedKurz[]; wert: Record<string, Teilnahme> } = $props();

	let suche = $state('');
	let nurAnwesend = $state(false);

	const eintrag = (stbnr: number): Teilnahme => wert[stbnr] ?? { anw: false, fahrzeug: '', ma: false, ats: false };

	function setzen(stbnr: number, feld: keyof Teilnahme, v: boolean | string) {
		const neu = { ...eintrag(stbnr), [feld]: v };
		// Fahrzeug, Maschinist oder ATS heißt auch anwesend
		if (feld !== 'anw' && v) neu.anw = true;
		if (feld === 'anw' && !v) Object.assign(neu, { fahrzeug: '', ma: false, ats: false });
		const kopie = { ...wert };
		if (!neu.anw && !neu.fahrzeug && !neu.ma && !neu.ats) delete kopie[stbnr];
		else kopie[stbnr] = neu;
		wert = kopie;
	}

	const gefiltert = $derived(
		mannschaft.filter((m) => {
			if (nurAnwesend && !wert[m.stbnr]?.anw) return false;
			const s = suche.trim().toLowerCase();
			return !s || `${m.stbnr} ${m.nachname} ${m.vorname}`.toLowerCase().includes(s);
		})
	);
	const anwesend = $derived(Object.values(wert).filter((t) => t.anw).length);
	const ats = $derived(Object.values(wert).filter((t) => t.ats).length);
</script>

<div class="flex flex-wrap items-center gap-3">
	<label class="relative min-w-56 flex-1">
		<span class="sr-only">Mitglied suchen</span>
		<Search size={18} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden="true" />
		<input class="input pl-10" type="search" placeholder="Name oder Standesbuchnummer" bind:value={suche} />
	</label>
	<label class="kreuz"><input type="checkbox" bind:checked={nurAnwesend} />Nur Anwesende</label>
	<p class="w-full text-sm font-semibold text-ink-2 sm:w-auto">{anwesend} anwesend, davon {ats} mit ATS</p>
</div>

<div class="mt-4 overflow-x-auto rounded-xl border border-line">
	<table class="w-full min-w-[40rem] text-[0.9375rem]">
		<thead class="bg-surface-2 text-left text-sm text-ink-2">
			<tr>
				<th class="px-3 py-2 font-semibold">Stbnr.</th>
				<th class="px-3 py-2 font-semibold">Name</th>
				<th class="px-3 py-2 text-center font-semibold">Anw.</th>
				<th class="px-3 py-2 font-semibold">Fahrzeug</th>
				<th class="px-3 py-2 text-center font-semibold" title="Maschinist">MA</th>
				<th class="px-3 py-2 text-center font-semibold" title="Atemschutz im Einsatz tatsächlich angelegt">ATS</th>
			</tr>
		</thead>
		<tbody>
			{#each gefiltert as m, i (m.stbnr)}
				{@const t = eintrag(m.stbnr)}
				{#if i === 0 || gefiltert[i - 1].gruppe !== m.gruppe}
					<tr class="bg-surface-2"><th colspan="6" class="px-3 py-1.5 text-left text-xs font-bold tracking-wide text-ink-2">
						{m.gruppe === 'aktiv' ? 'Aktive Mannschaft' : 'Reserve Mannschaft'}
					</th></tr>
				{/if}
				<tr class="border-t border-line" class:bg-red-soft={t.anw}>
					<td class="px-3 py-1.5 tabular text-ink-2">{m.stbnr}</td>
					<td class="px-3 py-1.5 font-medium">{m.nachname} {m.vorname}</td>
					<td class="px-3 py-1.5 text-center">
						<input type="checkbox" class="size-5 accent-[var(--c-red)]" checked={t.anw} onchange={(e) => setzen(m.stbnr, 'anw', e.currentTarget.checked)} aria-label="{m.vorname} {m.nachname} anwesend" />
					</td>
					<td class="px-3 py-1">
						<select class="input min-h-9 py-1 text-sm" value={t.fahrzeug} onchange={(e) => setzen(m.stbnr, 'fahrzeug', e.currentTarget.value)} aria-label="Fahrzeug von {m.vorname} {m.nachname}">
							<option value="">–</option>
							{#each TEILNAHME_FAHRZEUGE as f (f.wert)}<option value={f.wert}>{f.text}</option>{/each}
						</select>
					</td>
					<td class="px-3 py-1.5 text-center">
						<input type="checkbox" class="size-5 accent-[var(--c-red)]" checked={t.ma} onchange={(e) => setzen(m.stbnr, 'ma', e.currentTarget.checked)} aria-label="{m.vorname} {m.nachname} Maschinist" />
					</td>
					<td class="px-3 py-1.5 text-center">
						<input type="checkbox" class="size-5 accent-[var(--c-red)]" checked={t.ats} onchange={(e) => setzen(m.stbnr, 'ats', e.currentTarget.checked)} aria-label="{m.vorname} {m.nachname} Atemschutz" />
					</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="px-3 py-6 text-center text-ink-2">Niemand gefunden.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="hinweis mt-2">ATS nur eintragen, wenn Atemschutz im Einsatz tatsächlich angelegt wurde (nur Kurzüberprüfung nicht eintragen).</p>
