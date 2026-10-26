<script lang="ts">
	import BerichtDruck from '$lib/components/druck/BerichtDruck.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Bericht {data.bericht.id}</title></svelte:head>

<div class="druckseite" data-fertig="ja">
	<BerichtDruck typ={data.bericht.typ} daten={data.bericht.daten} mannschaft={data.mannschaft} asue={data.asue} etb={data.etb} fuss={data.fuss} stand={data.stand} />
</div>

<style>
	:global(body) {
		background: #fff;
	}
</style>
