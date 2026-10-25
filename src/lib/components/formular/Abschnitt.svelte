<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Abschnitt wie ein Block des Aufnahmeblatts: Kopf in der Farbe der Berichtsart, darunter Zeilen mit Linien */
	let {
		id,
		titel,
		hinweis,
		farbe = '#e6e6e6',
		children
	}: { id: string; titel: string; hinweis?: string; farbe?: string; children: Snippet } = $props();
</script>

<section {id} class="abschnitt card scroll-mt-40" aria-labelledby="{id}-titel">
	<header style:background={farbe}>
		<h2 id="{id}-titel" class="display text-2xl">{titel}</h2>
		{#if hinweis}<p class="mt-0.5 text-[0.9375rem]">{hinweis}</p>{/if}
	</header>
	<div class="zeilen">
		{@render children()}
	</div>
</section>

<style>
	.abschnitt {
		overflow: hidden;
		border: 1px solid var(--c-line-strong);
		box-shadow: none;
	}
	header {
		padding: 0.7rem 1.1rem;
		color: #111;
		border-bottom: 1px solid var(--c-line-strong);
	}
</style>
