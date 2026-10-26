<script lang="ts">
	import EtbDruck from '$lib/components/druck/EtbDruck.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Einsatztagebuch {data.etb.code}</title></svelte:head>

<div data-fertig="ja">
	<EtbDruck zustand={data.etb.zustand} fuss={data.fuss} />
</div>

<style>
	:global(body) {
		background: #fff;
	}
</style>
