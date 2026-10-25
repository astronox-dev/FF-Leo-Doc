<script lang="ts">
	import { enhance } from '$app/forms';
	import Eye from '@lucide/svelte/icons/eye';
	import FileDown from '@lucide/svelte/icons/file-down';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TypMarke from '$lib/components/TypMarke.svelte';
	import { pageTitle } from '$lib/app';
	import { datumAusIso, datumZeit } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>{pageTitle('Eingereichte Berichte')}</title></svelte:head>

{#if form?.erfolg}
	<div class="mb-5 flex gap-2 rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status"><CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" /><p class="font-medium">{form.erfolg}</p></div>
{/if}

<p class="hinweis">Eingereichte Berichte sind nur hier sichtbar und nicht mehr änderbar.</p>
{#if data.berichte.length === 0}
	<p class="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-ink-2">Noch kein Bericht eingereicht.</p>
{:else}
	<ul class="mt-3 divide-y divide-line card overflow-hidden">
		{#each data.berichte as b (b.id)}
			<li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
				<TypMarke typ={b.typ} />
				<span class="min-w-0 flex-1">
					<span class="block truncate font-semibold">{b.einsatzort || 'Ohne Einsatzort'}</span>
					<span class="block text-sm text-ink-3">Einsatz {datumAusIso(b.datum)}, eingereicht {datumZeit(b.eingereichtAm)}, angelegt von {b.erstelltVon ?? 'unbekannt'}</span>
				</span>
				<a href="/berichte/{b.id}/vorschau" class="btn min-h-10"><Eye size={18} aria-hidden="true" />Ansehen</a>
				<a href="/berichte/{b.id}/pdf" class="btn min-h-10" data-sveltekit-reload><FileDown size={18} aria-hidden="true" />PDF</a>
				<form method="POST" action="?/oeffnen" use:enhance={({ cancel }) => { if (!confirm('Bericht wieder öffnen? Er erscheint dann wieder bei den offenen Berichten und die Unterschriften bleiben, bis jemand sie ändert.')) cancel(); }}>
					<input type="hidden" name="id" value={b.id} />
					<button class="btn btn-ruhig min-h-10">Wieder öffnen</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}
