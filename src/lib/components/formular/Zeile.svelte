<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Eine Zeile des Aufnahmeblatts: Beschriftung links, Felder rechts, Linie dazwischen */
	let {
		label,
		hinweis,
		voll = false,
		aktion,
		children
	}: { label?: string; hinweis?: string; voll?: boolean; aktion?: Snippet; children: Snippet } = $props();

	const uid = $props.id();
</script>

<div class="zeile" class:voll role={label ? 'group' : undefined} aria-labelledby={label ? `${uid}-l` : undefined}>
	{#if label && !voll}
		<div class="z-label">
			<span id="{uid}-l">{label}</span>
			{#if hinweis}<span class="z-hinweis">{hinweis}</span>{/if}
			{@render aktion?.()}
		</div>
	{/if}
	<div class="z-inhalt">
		{@render children()}
	</div>
</div>

<style>
	.zeile {
		display: grid;
		grid-template-columns: minmax(9rem, 13rem) minmax(0, 1fr);
		border-top: 1px solid var(--c-line-strong);
	}
	.zeile:first-child {
		border-top: 0;
	}
	.zeile.voll {
		grid-template-columns: minmax(0, 1fr);
	}
	.z-label {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		padding: 0.85rem 1rem;
		background: var(--c-surface-2);
		border-right: 1px solid var(--c-line-strong);
		font-weight: 700;
		line-height: 1.3;
	}
	.z-hinweis {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--c-ink-3);
	}
	.z-inhalt {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
		padding: 0.75rem 1rem;
	}
	@media (max-width: 639px) {
		.zeile {
			grid-template-columns: minmax(0, 1fr);
		}
		.z-label {
			flex-direction: row;
			flex-wrap: wrap;
			align-items: baseline;
			column-gap: 0.6rem;
			padding: 0.5rem 1rem;
			border-right: 0;
			border-bottom: 1px solid var(--c-line);
		}
	}
</style>
