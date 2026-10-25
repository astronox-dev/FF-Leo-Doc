<script lang="ts">
	import { enhance } from '$app/forms';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { pageTitle } from '$lib/app';
	import { relativ } from '$lib/format';

	let { data, form } = $props();
	let offen = $state<number | null>(null);
</script>

<svelte:head><title>{pageTitle('Benutzer')}</title></svelte:head>

{#if form?.fehler}
	<div class="mb-5 flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert"><CircleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" /><p class="font-medium">{form.fehler}</p></div>
{:else if form?.erfolg}
	<div class="mb-5 rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status">
		<p class="flex gap-2 font-medium"><CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" />{form.erfolg}</p>
		{#if form.zugang}
			<div class="mt-3 rounded-lg bg-surface p-3 text-ink">
				<p class="text-sm text-ink-2">Zugangsdaten jetzt weitergeben, das Passwort wird nur einmal angezeigt. Beim ersten Anmelden muss ein eigenes gesetzt werden.</p>
				<p class="mt-2 font-mono text-lg">Benutzername: <strong>{form.zugang.username}</strong></p>
				<p class="font-mono text-lg">Einmal-Passwort: <strong>{form.zugang.passwort}</strong></p>
			</div>
		{/if}
	</div>
{/if}

<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
	<section aria-labelledby="liste">
		<h2 id="liste" class="text-lg font-bold">Benutzer</h2>
		<ul class="mt-3 divide-y divide-line card overflow-hidden">
			{#each data.liste as u (u.id)}
				<li>
					<button class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2" aria-expanded={offen === u.id} onclick={() => (offen = offen === u.id ? null : u.id)}>
						<span class="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 font-bold">{u.name.slice(0, 1).toUpperCase()}</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{u.name}{u.id === data.user.id ? ' (du)' : ''}</span>
							<span class="block text-sm text-ink-3">{u.username}, {u.lastLoginAt ? `zuletzt angemeldet ${relativ(u.lastLoginAt)}` : 'noch nie angemeldet'}</span>
						</span>
						{#if !u.active}<span class="rounded-md bg-surface-3 px-2 py-0.5 text-xs font-bold text-ink-2">Gesperrt</span>{/if}
						<span class="rounded-md px-2 py-0.5 text-xs font-bold" class:bg-red-soft={u.role === 'admin'} class:text-red={u.role === 'admin'} class:bg-surface-3={u.role !== 'admin'}>{u.role === 'admin' ? 'Admin' : 'Nutzer'}</span>
					</button>
					{#if offen === u.id}
						<div class="border-t border-line bg-surface-2 px-4 py-4">
							<form method="POST" action="?/aendern" use:enhance class="grid gap-3 sm:grid-cols-2">
								<input type="hidden" name="id" value={u.id} />
								<label><span class="field-label">Name</span><input class="input" name="name" value={u.name} required /></label>
								<label><span class="field-label">Berechtigung</span>
									<select class="input" name="role" value={u.role}><option value="nutzer">Nutzer</option><option value="admin">Admin</option></select>
								</label>
								<label class="kreuz w-fit"><input type="checkbox" name="active" checked={u.active} />Darf sich anmelden</label>
								<div class="flex justify-end sm:col-span-2"><button class="btn btn-primary">Speichern</button></div>
							</form>
							<div class="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
								<form method="POST" action="?/passwort" use:enhance={({ cancel }) => { if (!confirm(`Neues Einmal-Passwort für ${u.name}? Alle Geräte werden abgemeldet.`)) cancel(); }}>
									<input type="hidden" name="id" value={u.id} />
									<button class="btn"><KeyRound size={18} aria-hidden="true" />Passwort zurücksetzen</button>
								</form>
								{#if u.id !== data.user.id}
									<form method="POST" action="?/loeschen" use:enhance={({ cancel }) => { if (!confirm(`${u.name} löschen?`)) cancel(); }}>
										<input type="hidden" name="id" value={u.id} />
										<button class="btn btn-gefahr">Löschen</button>
									</form>
								{/if}
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		<p class="hinweis mt-3">Angemeldete Geräte bleiben ohne Ablauf angemeldet. Sperren oder ein neues Passwort meldet alle Geräte dieses Benutzers ab.</p>
	</section>

	<form method="POST" action="?/anlegen" use:enhance class="card space-y-4 p-5">
		<h2 class="text-lg font-bold">Neuer Benutzer</h2>
		<label class="block"><span class="field-label">Name</span><input class="input" name="name" required placeholder="Vorname Nachname" /></label>
		<label class="block"><span class="field-label">Benutzername</span><input class="input" name="username" required autocapitalize="none" spellcheck="false" placeholder="z. B. m.streicher" /></label>
		<label class="block"><span class="field-label">Berechtigung</span>
			<select class="input" name="role"><option value="nutzer">Nutzer</option><option value="admin">Admin</option></select>
		</label>
		<p class="hinweis">Nutzer schreiben Berichte und überwachen Atemschutz. Admins verwalten zusätzlich Benutzer, Mannschaft, Einstellungen und sehen eingereichte Berichte.</p>
		<button class="btn btn-primary w-full">Anlegen und Passwort erzeugen</button>
	</form>
</div>
