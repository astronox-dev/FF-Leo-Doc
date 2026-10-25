<script lang="ts">
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import PasswortFeld from '$lib/components/PasswortFeld.svelte';
	import { pageTitle } from '$lib/app';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{pageTitle('Anmelden')}</title></svelte:head>

<h1 class="display text-4xl">Anmelden</h1>
<p class="mt-2 text-ink-2">Mit deinem Benutzernamen. Auf diesem Gerät bleibst du angemeldet, bis du dich abmeldest.</p>

{#if data.abgemeldet}
	<div class="mt-6 flex gap-2 rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status">
		<CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
		<p class="font-medium">Du bist abgemeldet.</p>
	</div>
{/if}

<form
	method="POST"
	class="mt-8 space-y-5"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	<div>
		<label for="username" class="field-label">Benutzername</label>
		<input
			id="username"
			name="username"
			class="input"
			autocomplete="username"
			autocapitalize="none"
			spellcheck="false"
			required
			value={form?.username ?? ''}
			aria-invalid={form?.message ? true : undefined}
		/>
	</div>
	<div>
		<label for="password" class="field-label">Passwort</label>
		<PasswortFeld id="password" name="password" autocomplete="current-password" required invalid={Boolean(form?.message)} />
	</div>

	{#if form?.message}
		<div class="flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert" in:fly={{ y: -6, duration: 200 }}>
			<CircleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
			<p class="font-medium">{form.message}</p>
		</div>
	{/if}

	<button class="btn btn-primary min-h-12 w-full text-base" disabled={busy}>
		{busy ? 'Wird angemeldet …' : 'Anmelden'}
	</button>
</form>

<p class="mt-6 text-center text-sm text-ink-3">Passwort vergessen? Ein Admin kann es zurücksetzen.</p>
