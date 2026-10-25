<script lang="ts">
	import Einsatznacht from '$lib/components/Einsatznacht.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { APP_LANG, APP_NAME } from '$lib/app';

	let { children } = $props();
</script>

<div class="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
	<aside class="relative hidden overflow-hidden lg:block" aria-hidden="true">
		<Einsatznacht />
		<div class="absolute inset-x-0 bottom-0 px-12 pb-12 text-white">
			<p class="mb-6 leading-none">
				<span class="display block text-[2.6rem]">{APP_NAME}</span>
				<span class="mt-1.5 block text-[0.95rem] font-medium text-white/75">{APP_LANG}</span>
			</p>
			<p class="display text-6xl">Retten. Schützen.<br />Löschen. Bergen.</p>
			<p class="mt-4 max-w-md text-white/75">
				Einsatzberichte schreiben und Atemschutztrupps überwachen, direkt am Einsatzort und von jedem Gerät.
			</p>
		</div>
	</aside>

	<main class="flex items-center justify-center px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-10">
		<div class="w-full max-w-sm">
			<div class="mb-10">
				<Logo />
				<!-- Am Handy fehlt die linke Spalte mit dem App-Namen -->
				<p class="display mt-4 text-2xl text-ink lg:hidden">{APP_NAME}</p>
			</div>
			{@render children()}
		</div>
	</main>
</div>
