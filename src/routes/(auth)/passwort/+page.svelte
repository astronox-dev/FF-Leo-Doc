<script lang="ts">
	import { enhance } from '$app/forms';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import PasswortFeld from '$lib/components/PasswortFeld.svelte';
	import { pageTitle } from '$lib/app';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{pageTitle('Passwort ändern')}</title></svelte:head>

<h1 class="display text-4xl">{data.muss ? 'Eigenes Passwort setzen' : 'Passwort ändern'}</h1>
<p class="mt-2 text-ink-2">
	{data.muss ? 'Du hast ein Einmal-Passwort bekommen. Lege jetzt ein eigenes fest.' : 'Andere Geräte werden danach abgemeldet.'}
</p>

<form
	method="POST"
	class="mt-8 space-y-5"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update();
			busy = false;
		};
	}}
>
	<div>
		<label for="alt" class="field-label">Bisheriges Passwort</label>
		<PasswortFeld id="alt" name="alt" autocomplete="current-password" required />
	</div>
	<div>
		<label for="neu" class="field-label">Neues Passwort</label>
		<PasswortFeld id="neu" name="neu" autocomplete="new-password" required minlength={8} />
		<p class="mt-1 text-sm text-ink-3">Mindestens 8 Zeichen.</p>
	</div>
	<div>
		<label for="wiederholung" class="field-label">Neues Passwort wiederholen</label>
		<PasswortFeld id="wiederholung" name="wiederholung" autocomplete="new-password" required minlength={8} />
	</div>

	{#if form?.message}
		<div class="flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert">
			<CircleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
			<p class="font-medium">{form.message}</p>
		</div>
	{/if}

	<button class="btn btn-primary min-h-12 w-full text-base" disabled={busy}>Passwort speichern</button>
	{#if !data.muss}
		<a href="/" class="btn btn-ruhig w-full">Abbrechen</a>
	{/if}
</form>
