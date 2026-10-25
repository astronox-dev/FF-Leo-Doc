<script lang="ts">
	/** Ankreuzfeld wie auf dem Papierblatt: „o“, angekreuzt mit einem Kreuzerl */
	let { an = false, text }: { an?: boolean; text?: string } = $props();
</script>

<span class="k"
	><svg viewBox="0 0 10 10" aria-hidden="true"
		><circle cx="5" cy="5.4" r="2.6" fill="none" stroke="#111" stroke-width="0.7" />{#if an}<path
				d="M1.6 1.8 L8.6 8.8 M8.4 1.6 L1.8 8.9"
				stroke="#10204a"
				stroke-width="1.5"
				stroke-linecap="round"
			/>{/if}</svg
	>{#if text}<span class="t">{text}</span>{/if}</span
>

<style>
	.k {
		display: inline-flex;
		align-items: baseline;
		gap: 0.6mm;
		white-space: nowrap;
	}
	svg {
		width: 3mm;
		height: 3mm;
		align-self: center;
		flex-shrink: 0;
	}
</style>
