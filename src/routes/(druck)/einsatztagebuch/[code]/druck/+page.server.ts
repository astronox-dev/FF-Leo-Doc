import { error } from '@sveltejs/kit';
import { CODE, etbDruck } from '$lib/server/etb';
import { datumZeit } from '$lib/format';
import type { PageServerLoad } from './$types';

/** Nackte Druckansicht für die PDF-Erstellung (Zugang per Token, siehe hooks.server.ts) */
export const load: PageServerLoad = async ({ params }) => {
	if (!CODE.test(params.code)) error(404, 'Nicht gefunden');
	const etb = await etbDruck(params.code);
	if (!etb) error(404, 'Tagebuch unbekannt');
	return { etb, fuss: `FF-Leo Doc · Einsatztagebuch ${params.code.slice(0, 3)}-${params.code.slice(3)} · Stand ${datumZeit(Date.now())}` };
};
