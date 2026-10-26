import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { asueEinsaetze, etbTagebuecher } from '$lib/server/db/schema';
import { berichtListe } from '$lib/server/berichte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const offen = await berichtListe('offen');
	const asue = await db.select().from(asueEinsaetze).where(eq(asueEinsaetze.abgeschlossen, false)).orderBy(desc(asueEinsaetze.erstellt)).limit(5);
	const etb = await db.select().from(etbTagebuecher).where(eq(etbTagebuecher.abgeschlossen, false)).orderBy(desc(etbTagebuecher.erstellt)).limit(5);
	return { offen: offen.slice(0, 5), anzahlOffen: offen.length, asue, etb, passwortGeaendert: url.searchParams.has('passwort') };
};
