import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { berichte } from '$lib/server/db/schema';
import { asueFuerBericht, berichtLaden, mannschaftFuer } from '$lib/server/berichte';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Bericht nicht gefunden');
	const bericht = await berichtLaden(id, locals.user);
	return {
		bericht,
		mannschaft: await mannschaftFuer(bericht),
		asue: await asueFuerBericht(id),
		darfLoeschen: locals.user!.role === 'admin' || bericht.erstelltVon === locals.user!.id
	};
};

export const actions: Actions = {
	loeschen: async ({ params, locals }) => {
		const id = Number(params.id);
		const b = await db.select().from(berichte).where(eq(berichte.id, id)).get();
		if (!b) error(404, 'Bericht nicht gefunden');
		const user = locals.user!;
		if (b.status !== 'offen') return fail(423, { message: 'Eingereichte Berichte können nicht gelöscht werden.' });
		if (user.role !== 'admin' && b.erstelltVon !== user.id) return fail(403, { message: 'Nur wer den Bericht angelegt hat oder ein Admin kann ihn löschen.' });
		await db.delete(berichte).where(eq(berichte.id, id));
		redirect(303, '/berichte');
	}
};
