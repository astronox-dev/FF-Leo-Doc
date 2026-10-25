<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	const navi = [
		{ href: '/admin/benutzer', text: 'Benutzer' },
		{ href: '/admin/mannschaft', text: 'Mannschaft' },
		{ href: '/admin/atemschutz', text: 'Atemschutz' },
		{ href: '/admin/archiv', text: 'Eingereichte Berichte' }
	];
</script>

<div class="wrap pt-8">
	<h1 class="display text-4xl sm:text-5xl">Admin</h1>
	<nav class="mt-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Admin-Bereiche">
		{#each navi as n (n.href)}
			{@const aktiv = page.url.pathname.startsWith(n.href)}
			<a
				href={n.href}
				class="-mb-px border-b-[3px] px-4 py-2.5 font-semibold whitespace-nowrap"
				style:border-color={aktiv ? 'var(--c-red)' : 'transparent'}
				class:text-ink={aktiv}
				class:text-ink-2={!aktiv}
				aria-current={aktiv ? 'page' : undefined}>{n.text}</a
			>
		{/each}
	</nav>
	<div class="mt-6">
		{@render children()}
	</div>
</div>
