<script lang="ts">
	import { enhance } from '$app/forms';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { pageTitle } from '$lib/app';

	let { data, form } = $props();
</script>

<svelte:head><title>{pageTitle('Atemschutz-Einstellungen')}</title></svelte:head>

<form method="POST" use:enhance={() => async ({ update }) => update({ reset: false })} class="card max-w-2xl space-y-5 p-6">
	<h2 class="text-lg font-bold">Atemschutzüberwachung</h2>
	{#if form?.fehler}
		<div class="flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert"><CircleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" /><p class="font-medium">{form.fehler}</p></div>
	{:else if form?.erfolg}
		<div class="flex gap-2 rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status"><CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" /><p class="font-medium">{form.erfolg}</p></div>
	{/if}
	<div class="grid gap-4 sm:grid-cols-2">
		<label><span class="field-label">Alarm nach (min)</span><input class="input" name="zeitGrenze" type="number" min="5" max="120" required value={data.einstellungen.zeitGrenze} /></label>
		<label><span class="field-label">Vorwarnung vorher (min)</span><input class="input" name="vorwarnung" type="number" min="0" max="60" required value={data.einstellungen.vorwarnung} /></label>
	</div>
	<label class="block">
		<span class="field-label">Trupps, die bei jeder neuen Überwachung bereitstehen</span>
		<textarea class="input" name="standardTrupps" rows="5">{data.einstellungen.standardTrupps.join('\n')}</textarea>
		<span class="hinweis mt-1 block">Ein Trupp pro Zeile. Sie starten als „Einsatzbereit“ mit 300-bar-Flaschen.</span>
	</label>
	<p class="hinweis">Die Werte gelten für neue Überwachungen. Laufende behalten die Werte, mit denen sie angelegt wurden.</p>
	<button class="btn btn-primary">Speichern</button>
</form>
