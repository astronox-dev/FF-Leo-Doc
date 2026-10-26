import { error } from '@sveltejs/kit';
import { CODE, ereignisseNach, etbKanal, tagebuchVorhanden } from '$lib/server/etb';
import { liveAntwort } from '$lib/server/live';
import type { RequestHandler } from './$types';

/** Server-Sent Events: neue Einträge gehen sofort an alle Geräte dieses Tagebuchs */
export const GET: RequestHandler = async ({ params, url, request }) => {
	if (!CODE.test(params.code)) error(404, 'Nicht gefunden');
	if (!(await tagebuchVorhanden(params.code))) error(404, 'Tagebuch unbekannt');
	const nach = Number(request.headers.get('last-event-id') ?? url.searchParams.get('nach')) || 0;
	return liveAntwort(etbKanal(params.code), await ereignisseNach(params.code, nach), request);
};
