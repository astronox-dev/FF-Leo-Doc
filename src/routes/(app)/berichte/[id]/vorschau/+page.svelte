<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import FileDown from '@lucide/svelte/icons/file-down';
	import BerichtDruck from '$lib/components/druck/BerichtDruck.svelte';
	import TypMarke from '$lib/components/TypMarke.svelte';
	import { pageTitle } from '$lib/app';

	let { data } = $props();

	let breite = $state(800);
	// 210 mm in CSS-Pixeln (297 mm, wenn ein Tagebuch im Querformat dabei ist); kleinere Bildschirme sehen die Seiten verkleinert
	const zoom = $derived(Math.min(1, (breite - 16) / (data.etb.length ? 1122.5 : 793.7)));
	const zurueck = $derived(data.bericht.status === 'offen' ? `/berichte/${data.bericht.id}` : '/admin/archiv');
</script>

<svelte:head><title>{pageTitle(`Vorschau ${data.bericht.daten.einsatzort}`)}</title></svelte:head>

<div class="sticky top-16 z-30 border-b border-line bg-bg/95 backdrop-blur print:hidden">
	<div class="wrap flex flex-wrap items-center gap-3 py-3">
		<a href={zurueck} class="btn btn-ruhig px-3"><ArrowLeft size={18} aria-hidden="true" />{data.bericht.status === 'offen' ? 'Zum Bericht' : 'Zum Archiv'}</a>
		<TypMarke typ={data.bericht.typ} />
		<h1 class="min-w-0 flex-1 truncate font-bold">{data.bericht.daten.einsatzort || 'Ohne Einsatzort'}</h1>
		{#if data.etb.length}
			<!-- Hoch- und Querformat gemischt druckt der Browser nicht zuverlässig: dann über das PDF drucken -->
			<a href="/berichte/{data.bericht.id}/pdf?ansehen" target="_blank" rel="noopener" class="btn" data-sveltekit-reload><Printer size={18} aria-hidden="true" />Drucken</a>
		{:else}
			<button class="btn" onclick={() => window.print()}><Printer size={18} aria-hidden="true" />Drucken</button>
		{/if}
		<a href="/berichte/{data.bericht.id}/pdf" class="btn btn-primary" data-sveltekit-reload><FileDown size={18} aria-hidden="true" />PDF herunterladen</a>
	</div>
</div>

<div class="vorschau" bind:clientWidth={breite}>
	<div class="seiten" style:zoom>
		<BerichtDruck typ={data.bericht.typ} daten={data.bericht.daten} mannschaft={data.mannschaft} asue={data.asue} etb={data.etb} fuss={data.fuss} stand={data.stand} />
	</div>
</div>

<style>
	.vorschau {
		padding: 1.5rem 0.5rem;
		background: #3a3a3a;
	}
	.seiten {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}
	.seiten :global(.seite),
	.seiten :global(.etb-blatt) {
		box-shadow: 0 0 0 1px rgb(0 0 0 / 0.4);
	}
	@media print {
		.vorschau {
			padding: 0;
			background: none;
		}
		.seiten {
			zoom: 1 !important;
			gap: 0;
		}
		.seiten :global(.seite),
		.seiten :global(.etb-blatt) {
			box-shadow: none;
		}
	}
</style>
