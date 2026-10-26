import { error } from '@sveltejs/kit';
import { asueKanal, CODE, einsatzVorhanden, ereignisseNach } from '$lib/server/asue';
import { liveAntwort } from '$lib/server/live';
import type { RequestHandler } from './$types';

/** Server-Sent Events: neue Ereignisse gehen sofort an alle Geräte dieser Überwachung */
export const GET: RequestHandler = async ({ params, url, request }) => {
	if (!CODE.test(params.code)) error(404, 'Nicht gefunden');
	if (!(await einsatzVorhanden(params.code))) error(404, 'Überwachung unbekannt');
	const nach = Number(request.headers.get('last-event-id') ?? url.searchParams.get('nach')) || 0;
	return liveAntwort(asueKanal(params.code), await ereignisseNach(params.code, nach), request);
};
