import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { mannschaft } from '$lib/server/db/schema';
import { listeAlsCsv } from '$lib/server/mannschaftDatei';
import type { RequestHandler } from './$types';

/** Teilnahmeliste als CSV zum Sichern oder Bearbeiten in Excel (nur Admin, siehe hooks) */
export const GET: RequestHandler = async () => {
	const liste = await db.select().from(mannschaft).orderBy(asc(mannschaft.gruppe), asc(mannschaft.nachname), asc(mannschaft.vorname));
	return new Response(listeAlsCsv(liste), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="mannschaft.csv"',
			'Cache-Control': 'no-store'
		}
	});
};
