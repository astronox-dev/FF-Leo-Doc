<script lang="ts">
	import { TYPEN, type BerichtTyp } from '$lib/berichte/typen';

	let { typ, gross = false }: { typ: BerichtTyp; gross?: boolean } = $props();
</script>

<!-- Farbmarke in der Kopffarbe des jeweiligen Aufnahmeblatts -->
<span
	class="inline-flex items-center rounded-md border font-bold whitespace-nowrap {gross ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'}"
	style:background={TYPEN[typ].farbe}
	style:color={TYPEN[typ].text}
	style:border-color={typ === 'tus' ? 'var(--c-line-strong)' : TYPEN[typ].farbe}
>
	{TYPEN[typ].kurz}
</span>
