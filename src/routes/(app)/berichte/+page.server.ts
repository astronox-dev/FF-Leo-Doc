import { error, redirect } from '@sveltejs/kit';
import { berichtAnlegen, berichtListe } from '$lib/server/berichte';
import { TYPEN, type BerichtTyp } from '$lib/berichte/typen';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return { berichte: await berichtListe('offen'), eingereicht: url.searchParams.has('eingereicht') };
};

export const actions: Actions = {
	neu: async ({ request, locals }) => {
		const typ = String((await request.formData()).get('typ')) as BerichtTyp;
		if (!(typ in TYPEN)) error(400, 'Unbekannte Berichtsart');
		const id = await berichtAnlegen(typ, locals.user!);
		redirect(303, `/berichte/${id}`);
	}
};
