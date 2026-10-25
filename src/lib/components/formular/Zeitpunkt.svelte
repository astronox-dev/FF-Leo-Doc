<script lang="ts">
	import type { Zeitpunkt } from '$lib/berichte/typen';

	let { wert = $bindable(), label, id }: { wert: Zeitpunkt; label: string; id: string } = $props();

	function jetzt() {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		wert.datum = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		wert.zeit = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
</script>

<!-- Die sichtbare Beschriftung steht in der Zeile links -->
<div class="flex max-w-xl gap-2">
	<input id="{id}-datum" type="date" class="input min-w-0 flex-[1.4]" bind:value={wert.datum} aria-label="{label}: Datum" />
	<input id="{id}-zeit" type="time" class="input min-w-0 flex-1" bind:value={wert.zeit} aria-label="{label}: Uhrzeit" />
	<button type="button" class="btn shrink-0 px-3" onclick={jetzt} title="Jetzt eintragen">Jetzt</button>
</div>
