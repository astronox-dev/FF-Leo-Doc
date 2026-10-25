import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { mannschaft } from '$lib/server/db/schema';
import { teilnahmeStand, teilnahmeStandSpeichern } from '$lib/server/einstellungen';
import { listeLesen } from '$lib/server/mannschaftDatei';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	liste: await db.select().from(mannschaft).orderBy(asc(mannschaft.gruppe), asc(mannschaft.nachname), asc(mannschaft.vorname)),
	stand: await teilnahmeStand()
});

function lesen(f: FormData) {
	return {
		stbnr: Number(f.get('stbnr')),
		nachname: String(f.get('nachname') ?? '').trim(),
		vorname: String(f.get('vorname') ?? '').trim(),
		gruppe: f.get('gruppe') === 'reserve' ? ('reserve' as const) : ('aktiv' as const),
		sichtbar: f.get('sichtbar') !== 'aus'
	};
}

async function pruefen(m: ReturnType<typeof lesen>, id?: number) {
	if (!Number.isInteger(m.stbnr) || m.stbnr < 1 || m.stbnr > 9999) return 'Bitte eine gültige Standesbuchnummer eingeben.';
	if (!m.nachname || !m.vorname) return 'Bitte Vor- und Nachname eingeben.';
	const gleich = await db.select({ id: mannschaft.id }).from(mannschaft).where(eq(mannschaft.stbnr, m.stbnr)).get();
	if (gleich && gleich.id !== id) return `Die Standesbuchnummer ${m.stbnr} ist schon vergeben.`;
	return null;
}

export const actions: Actions = {
	anlegen: async ({ request }) => {
		const m = lesen(await request.formData());
		const fehler = await pruefen(m);
		if (fehler) return fail(400, { fehler });
		await db.insert(mannschaft).values(m);
		return { erfolg: `${m.vorname} ${m.nachname} ist eingetragen.` };
	},
	aendern: async ({ request }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		const m = lesen(f);
		const fehler = await pruefen(m, id);
		if (fehler) return fail(400, { fehler });
		await db.update(mannschaft).set(m).where(eq(mannschaft.id, id));
		return { erfolg: `${m.vorname} ${m.nachname} ist gespeichert.` };
	},
	/** Liste aus einer Datei oder eingefügtem Text: neue Nummern eintragen, bekannte aktualisieren, nichts löschen */
	importieren: async ({ request }) => {
		const f = await request.formData();
		const datei = f.get('datei');
		const text = datei instanceof File && datei.size > 0 ? await datei.text() : String(f.get('text') ?? '');
		const { eintraege, fehler } = listeLesen(text);
		if (eintraege.length === 0) return fail(400, { fehler: fehler[0] ?? 'Die Liste ist leer. Bitte eine Datei wählen oder Zeilen einfügen.' });

		const vorhanden = new Map((await db.select().from(mannschaft)).map((m) => [m.stbnr, m]));
		let neu = 0, geaendert = 0;
		for (const e of eintraege) {
			const alt = vorhanden.get(e.stbnr);
			if (!alt) {
				await db.insert(mannschaft).values({ ...e, sichtbar: e.sichtbar ?? true });
				neu++;
			} else if (alt.nachname !== e.nachname || alt.vorname !== e.vorname || alt.gruppe !== e.gruppe || (e.sichtbar !== undefined && alt.sichtbar !== e.sichtbar)) {
				await db.update(mannschaft).set({ ...e, sichtbar: e.sichtbar ?? alt.sichtbar }).where(eq(mannschaft.id, alt.id));
				geaendert++;
			}
		}
		const teile = [`${neu} neu eingetragen`, `${geaendert} aktualisiert`, `${eintraege.length - neu - geaendert} unverändert`];
		const hinweis = fehler.length ? ` ${fehler.length} Zeile${fehler.length === 1 ? '' : 'n'} übersprungen (${fehler.slice(0, 3).join('; ')}${fehler.length > 3 ? ' …' : ''}).` : '';
		return { erfolg: `Import fertig: ${teile.join(', ')}.${hinweis}` };
	},
	stand: async ({ request }) => {
		const stand = String((await request.formData()).get('stand') ?? '').trim().slice(0, 40);
		await teilnahmeStandSpeichern(stand);
		return { erfolg: 'Stand der Liste gespeichert.' };
	}
};
