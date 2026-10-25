<script lang="ts">
	import { enhance } from '$app/forms';
	import Search from '@lucide/svelte/icons/search';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Upload from '@lucide/svelte/icons/upload';
	import Download from '@lucide/svelte/icons/download';
	import { pageTitle } from '$lib/app';

	let { data, form } = $props();
	let suche = $state('');
	let offen = $state<number | null>(null);

	const gefiltert = $derived(
		data.liste.filter((m) => {
			const s = suche.trim().toLowerCase();
			return !s || `${m.stbnr} ${m.nachname} ${m.vorname}`.toLowerCase().includes(s);
		})
	);
	const anzahl = $derived({
		aktiv: data.liste.filter((m) => m.gruppe === 'aktiv' && m.sichtbar).length,
		reserve: data.liste.filter((m) => m.gruppe === 'reserve' && m.sichtbar).length
	});
</script>

<svelte:head><title>{pageTitle('Mannschaft')}</title></svelte:head>

{#if form?.fehler}
	<div class="mb-5 flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert"><CircleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" /><p class="font-medium">{form.fehler}</p></div>
{:else if form?.erfolg}
	<div class="mb-5 flex gap-2 rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status"><CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" /><p class="font-medium">{form.erfolg}</p></div>
{/if}

<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
	<section aria-labelledby="liste">
		<div class="flex flex-wrap items-end gap-3">
			<div class="mr-auto">
				<h2 id="liste" class="text-lg font-bold">Teilnahmeliste</h2>
				<p class="hinweis">{anzahl.aktiv} aktiv, {anzahl.reserve} Reserve. Ausgeblendete Mitglieder stehen nicht auf neuen Berichten.</p>
			</div>
			{#if data.liste.length}
				<a href="/admin/mannschaft/export" class="btn" download><Download size={18} aria-hidden="true" />Als Datei herunterladen</a>
			{/if}
			<label class="relative w-full sm:w-64">
				<span class="sr-only">Suchen</span>
				<Search size={18} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden="true" />
				<input class="input pl-10" type="search" placeholder="Name oder Stbnr." bind:value={suche} />
			</label>
		</div>
		{#if data.liste.length === 0}
			<p class="mt-3 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-ink-2">
				Noch keine Mannschaft eingetragen. Rechts die Liste als Datei importieren oder einzelne Mitglieder hinzufügen.
			</p>
		{/if}
		<div class="mt-3 overflow-hidden card" class:hidden={data.liste.length === 0}>
			<table class="w-full text-left text-[0.9375rem]">
				<thead class="bg-surface-2 text-sm text-ink-2"><tr><th class="px-4 py-2">Stbnr.</th><th class="px-4 py-2">Name</th><th class="px-4 py-2">Gruppe</th><th class="px-4 py-2"></th></tr></thead>
				<tbody>
					{#each gefiltert as m (m.id)}
						<tr class="border-t border-line" class:opacity-55={!m.sichtbar}>
							<td class="px-4 py-2 tabular">{m.stbnr}</td>
							<td class="px-4 py-2 font-medium">{m.nachname} {m.vorname}{m.sichtbar ? '' : ' (ausgeblendet)'}</td>
							<td class="px-4 py-2">{m.gruppe === 'aktiv' ? 'Aktiv' : 'Reserve'}</td>
							<td class="px-4 py-1 text-right"><button class="btn btn-ruhig min-h-9 px-3 text-sm" onclick={() => (offen = offen === m.id ? null : m.id)}>{offen === m.id ? 'Schließen' : 'Bearbeiten'}</button></td>
						</tr>
						{#if offen === m.id}
							<tr class="bg-surface-2">
								<td colspan="4" class="px-4 py-3">
									<form method="POST" action="?/aendern" use:enhance={() => async ({ update }) => { await update(); offen = null; }} class="grid gap-3 sm:grid-cols-[6rem_1fr_1fr_8rem]">
										<input type="hidden" name="id" value={m.id} />
										<label><span class="field-label">Stbnr.</span><input class="input" name="stbnr" inputmode="numeric" value={m.stbnr} required /></label>
										<label><span class="field-label">Nachname</span><input class="input" name="nachname" value={m.nachname} required /></label>
										<label><span class="field-label">Vorname</span><input class="input" name="vorname" value={m.vorname} required /></label>
										<label><span class="field-label">Gruppe</span><select class="input" name="gruppe" value={m.gruppe}><option value="aktiv">Aktiv</option><option value="reserve">Reserve</option></select></label>
										<label class="flex items-center gap-2 font-medium sm:col-span-2">
											<select class="input w-auto" name="sichtbar" value={m.sichtbar ? 'an' : 'aus'}><option value="an">Auf der Liste</option><option value="aus">Ausgeblendet</option></select>
										</label>
										<div class="flex justify-end sm:col-span-2"><button class="btn btn-primary">Speichern</button></div>
									</form>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<div class="space-y-6">
		<form method="POST" action="?/importieren" enctype="multipart/form-data" use:enhance class="card space-y-4 p-5">
			<h2 class="text-lg font-bold">Liste importieren</h2>
			<p class="hinweis">
				Eine Zeile je Mitglied: Stbnr; Nachname; Vorname; Gruppe (aktiv oder reserve). Neue Nummern werden eingetragen, bekannte aktualisiert, gelöscht wird nichts.
			</p>
			<label class="block">
				<span class="field-label">Datei (CSV aus Excel)</span>
				<input class="input py-2" type="file" name="datei" accept=".csv,.txt,text/csv,text/plain" />
			</label>
			<label class="block">
				<span class="field-label">Oder Zeilen einfügen</span>
				<textarea class="input font-mono text-sm" name="text" rows="4" placeholder="253;Muster;Max;aktiv"></textarea>
			</label>
			<button class="btn btn-primary w-full"><Upload size={18} aria-hidden="true" />Importieren</button>
		</form>
		<form method="POST" action="?/anlegen" use:enhance class="card space-y-4 p-5">
			<h2 class="text-lg font-bold">Mitglied hinzufügen</h2>
			<label class="block"><span class="field-label">Standesbuchnummer</span><input class="input" name="stbnr" inputmode="numeric" required /></label>
			<label class="block"><span class="field-label">Nachname</span><input class="input" name="nachname" required /></label>
			<label class="block"><span class="field-label">Vorname</span><input class="input" name="vorname" required /></label>
			<label class="block"><span class="field-label">Gruppe</span><select class="input" name="gruppe"><option value="aktiv">Aktive Mannschaft</option><option value="reserve">Reserve Mannschaft</option></select></label>
			<button class="btn btn-primary w-full">Hinzufügen</button>
		</form>
		<form method="POST" action="?/stand" use:enhance class="card space-y-4 p-5">
			<h2 class="text-lg font-bold">Stand der Liste</h2>
			<p class="hinweis">Steht auf der Teilnahme-Seite neben „TEILNAHME Einsatz“.</p>
			<label class="block"><span class="sr-only">Stand</span><input class="input" name="stand" value={data.stand} placeholder="z. B. April 2026" /></label>
			<button class="btn w-full">Speichern</button>
		</form>
	</div>
</div>
