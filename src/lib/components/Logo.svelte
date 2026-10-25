<script lang="ts">
	import { APP_LANG, APP_NAME } from '$lib/app';

	let { gross = false }: { gross?: boolean } = $props();
</script>

<div class="flex items-center gap-3">
	<img src="/bilder/wappen.webp" alt="" width="189" height="224" class={gross ? 'h-16 w-auto' : 'h-10 w-auto'} />
	<div class="leading-none">
		<p class="display text-ink {gross ? 'text-[2.6rem]' : 'text-2xl'}">{APP_NAME}</p>
		<p class="mt-1.5 text-ink-2 {gross ? 'text-[0.95rem]' : 'text-xs'} font-medium">{APP_LANG}</p>
	</div>
</div>
