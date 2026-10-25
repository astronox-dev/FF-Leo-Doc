<script lang="ts">
	import BerichtFormular from './BerichtFormular.svelte';

	let { data } = $props();
</script>

<!-- Neu aufbauen, wenn direkt zu einem anderen Bericht gewechselt wird -->
{#key data.bericht.id}
	<BerichtFormular {data} />
{/key}
