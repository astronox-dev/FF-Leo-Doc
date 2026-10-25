<script lang="ts">
	import { page } from '$app/state';
	import FileText from '@lucide/svelte/icons/file-text';
	import Timer from '@lucide/svelte/icons/timer';
	import Settings from '@lucide/svelte/icons/settings';
	import LogOut from '@lucide/svelte/icons/log-out';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { APP_NAME } from '$lib/app';

	let { data, children } = $props();
	let menue = $state(false);
	let theme = $state(data.theme);

	const navi = $derived([
		{ href: '/berichte', text: 'Einsatzberichte', icon: FileText },
		{ href: '/atemschutz', text: 'Atemschutz', icon: Timer },
		...(data.user.role === 'admin' ? [{ href: '/admin', text: 'Admin', icon: Settings }] : [])
	]);
	const aktiv = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);

	function themaSetzen(neu: 'light' | 'dark' | 'system') {
		theme = neu;
		document.cookie = `theme=${neu}; path=/; max-age=31536000; samesite=lax`;
		if (neu === 'system') delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = neu;
	}
</script>

<svelte:window onclick={(e) => { if (!(e.target as Element).closest('.konto')) menue = false; }} />

<div class="flex min-h-dvh flex-col">
	<!-- Kopfzeile in beiden Darstellungen schwarz; der aktive Bereich ist rot unterstrichen -->
	<header class="kopf sticky top-0 z-40 print:hidden">
		<div class="wrap flex h-16 items-center gap-4">
			<a href="/" class="flex shrink-0 items-center gap-3" aria-label="{APP_NAME}, zur Startseite">
				<img src="/bilder/wappen.webp" alt="" width="189" height="224" class="h-9 w-auto" />
				<img src="/bilder/logo-schriftzug.webp" alt="" width="640" height="122" class="hidden w-32 lg:block" />
				<span class="display border-white/20 text-2xl lg:border-l lg:pl-3">{APP_NAME}</span>
			</a>

			<nav class="ml-auto hidden h-full items-stretch md:flex" aria-label="Bereiche">
				{#each navi as n (n.href)}
					<a href={n.href} class="reiter" aria-current={aktiv(n.href) ? 'page' : undefined}>
						<n.icon size={18} aria-hidden="true" />{n.text}
					</a>
				{/each}
			</nav>

			<div class="konto relative ml-auto md:ml-2">
				<button
					class="flex h-10 items-center gap-2 rounded-lg pr-2 pl-1.5 font-semibold text-white/85 hover:bg-white/10 hover:text-white"
					aria-expanded={menue}
					aria-haspopup="menu"
					onclick={() => (menue = !menue)}
				>
					<span class="grid size-7 place-items-center rounded-full bg-red text-sm font-bold text-white">
						{data.user.name.slice(0, 1).toUpperCase()}
					</span>
					<span class="hidden max-w-32 truncate lg:inline">{data.user.name}</span>
					<ChevronDown size={16} class="opacity-70" aria-hidden="true" />
				</button>
				{#if menue}
					<div class="absolute right-0 mt-2 w-64 rounded-xl bg-surface p-2 text-ink shadow-[var(--shadow-2)]" role="menu">
						<p class="px-3 pt-1 pb-2 text-sm text-ink-3">
							Angemeldet als <strong class="text-ink">{data.user.username}</strong>{data.user.role === 'admin' ? ' (Admin)' : ''}
						</p>
						<div class="mb-1 grid grid-cols-3 gap-1 rounded-lg bg-surface-3 p-1" role="group" aria-label="Darstellung">
							{#each [['light', 'Hell', Sun], ['dark', 'Dunkel', Moon], ['system', 'Gerät', Monitor]] as const as [wert, text, Icon] (wert)}
								<button
									class="flex flex-col items-center gap-0.5 rounded-md py-1.5 text-xs font-semibold"
									class:bg-surface={theme === wert}
									class:text-ink-2={theme !== wert}
									aria-pressed={theme === wert}
									onclick={() => themaSetzen(wert)}
								>
									<Icon size={16} aria-hidden="true" />{text}
								</button>
							{/each}
						</div>
						<a href="/passwort" class="flex items-center gap-2 rounded-lg px-3 py-2.5 font-medium hover:bg-surface-3" role="menuitem">
							<KeyRound size={18} aria-hidden="true" />Passwort ändern
						</a>
						<form method="POST" action="/logout">
							<button class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 font-medium text-danger hover:bg-danger-soft" role="menuitem">
								<LogOut size={18} aria-hidden="true" />Abmelden
							</button>
						</form>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<main class="flex-1 pb-24 md:pb-10">
		{@render children()}
	</main>

	<!-- Am Handy: Bereiche unten erreichbar, ebenfalls schwarz -->
	<nav class="unten fixed inset-x-0 bottom-0 z-40 grid pb-[env(safe-area-inset-bottom)] md:hidden print:hidden" style:grid-template-columns="repeat({navi.length}, 1fr)" aria-label="Bereiche">
		{#each navi as n (n.href)}
			<a href={n.href} class="flex flex-col items-center gap-0.5 py-2 text-xs font-semibold" aria-current={aktiv(n.href) ? 'page' : undefined}>
				<n.icon size={22} aria-hidden="true" />{n.text}
			</a>
		{/each}
	</nav>
</div>

<style>
	.kopf,
	.unten {
		background: var(--c-black);
		color: #fff;
	}
	.kopf {
		border-bottom: 1px solid #262626;
	}
	.unten {
		border-top: 1px solid #262626;
	}
	.reiter {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.85rem;
		color: rgb(255 255 255 / 0.62);
		font-weight: 600;
		transition: color 120ms;
	}
	.reiter:hover,
	.reiter[aria-current='page'] {
		color: #fff;
	}
	.reiter[aria-current='page']::after,
	.unten a[aria-current='page']::before {
		content: '';
		position: absolute;
		left: 0.85rem;
		right: 0.85rem;
		height: 3px;
		background: #e5483a;
	}
	.reiter[aria-current='page']::after {
		bottom: -1px;
	}
	.unten a {
		position: relative;
		color: rgb(255 255 255 / 0.62);
	}
	.unten a[aria-current='page'] {
		color: #fff;
	}
	.unten a[aria-current='page']::before {
		top: -1px;
		left: 30%;
		right: 30%;
	}
</style>
