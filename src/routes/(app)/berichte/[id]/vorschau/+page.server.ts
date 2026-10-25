import { error } from '@sveltejs/kit';
import { druckdaten } from '$lib/server/druckdaten';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Bericht nicht gefunden');
	return druckdaten(id, locals.user);
};
