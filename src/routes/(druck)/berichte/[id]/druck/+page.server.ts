import { error } from '@sveltejs/kit';
import { druckdaten } from '$lib/server/druckdaten';
import type { PageServerLoad } from './$types';

/** Nackte Druckansicht für die PDF-Erstellung (Zugang per Token, siehe hooks.server.ts) */
export const load: PageServerLoad = async ({ params, locals }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Bericht nicht gefunden');
	return druckdaten(id, locals.user, !locals.user);
};
