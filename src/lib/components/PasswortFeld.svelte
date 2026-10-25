<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';

	let {
		id,
		name,
		autocomplete,
		required = false,
		invalid = false,
		minlength
	}: { id: string; name: string; autocomplete: 'current-password' | 'new-password'; required?: boolean; invalid?: boolean; minlength?: number } = $props();

	let sichtbar = $state(false);
</script>

<div class="relative">
	<input
		{id}
		{name}
		{autocomplete}
		{required}
		{minlength}
		type={sichtbar ? 'text' : 'password'}
		class="input pr-12"
		aria-invalid={invalid ? true : undefined}
	/>
	<button
		type="button"
		class="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-3 hover:text-ink"
		aria-label={sichtbar ? 'Passwort verbergen' : 'Passwort anzeigen'}
		onclick={() => (sichtbar = !sichtbar)}
	>
		{#if sichtbar}<EyeOff size={20} />{:else}<Eye size={20} />{/if}
	</button>
</div>
