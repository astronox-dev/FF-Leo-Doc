import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { berichte } from '$lib/server/db/schema';
import { berichtListe } from '$lib/server/berichte';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ berichte: await berichtListe('eingereicht') });

export const actions: Actions = {
	/** Versehentlich eingereichte Berichte wieder bearbeitbar machen */
	oeffnen: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		const res = await db
			.update(berichte)
			.set({ status: 'offen', eingereichtAm: null, eingereichtVon: null, mannschaftStand: null })
			.where(and(eq(berichte.id, id), eq(berichte.status, 'eingereicht')));
		if (!res.rowsAffected) return fail(404, { fehler: 'Bericht nicht gefunden.' });
		return { erfolg: 'Der Bericht ist wieder offen und für alle bearbeitbar.' };
	}
};
