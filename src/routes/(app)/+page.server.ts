import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { asueEinsaetze } from '$lib/server/db/schema';
import { berichtListe } from '$lib/server/berichte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const offen = await berichtListe('offen');
	const asue = await db.select().from(asueEinsaetze).where(eq(asueEinsaetze.abgeschlossen, false)).orderBy(desc(asueEinsaetze.erstellt)).limit(5);
	return { offen: offen.slice(0, 5), anzahlOffen: offen.length, asue, passwortGeaendert: url.searchParams.has('passwort') };
};
