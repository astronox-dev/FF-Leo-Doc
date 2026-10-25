<script lang="ts">
	/** Ankreuzgruppe: immer Mehrfachauswahl, wie auf dem Papierblatt gewünscht */
	let { optionen, wert = $bindable(), label }: { optionen: string[]; wert: string[]; label?: string } = $props();

	function umschalten(o: string, an: boolean) {
		wert = an ? [...wert.filter((x) => x !== o), o] : wert.filter((x) => x !== o);
	}
</script>

<fieldset>
	{#if label}<legend class="field-label">{label}</legend>{/if}
	<div class="flex flex-wrap gap-2">
		{#each optionen as o (o)}
			<label class="kreuz">
				<input type="checkbox" checked={wert.includes(o)} onchange={(e) => umschalten(o, e.currentTarget.checked)} />
				{o}
			</label>
		{/each}
	</div>
</fieldset>
