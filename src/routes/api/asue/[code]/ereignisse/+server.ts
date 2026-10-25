import { error, json } from '@sveltejs/kit';
import { CODE, einsatzVorhanden, ereignisseNach, ereignisseSpeichern, pruefeEreignis } from '$lib/server/asue';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	if (!CODE.test(params.code)) error(404, 'Nicht gefunden');
	if (!(await einsatzVorhanden(params.code))) error(404, 'Überwachung unbekannt');
	return json(await ereignisseNach(params.code, Number(url.searchParams.get('nach')) || 0));
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!CODE.test(params.code)) error(404, 'Nicht gefunden');
	const text = await request.text();
	if (text.length > 512 * 1024) error(413, 'Zu groß');
	let liste: unknown;
	try {
		liste = JSON.parse(text);
	} catch {
		error(400, 'Kein JSON');
	}
	if (!Array.isArray(liste) || liste.length > 1000 || !liste.every(pruefeEreignis)) error(400, 'Ungültige Ereignisse');
	const res = await ereignisseSpeichern(params.code, liste, locals.user!);
	if (res.status === 404) error(404, 'Überwachung unbekannt');
	return json({ ereignisse: res.ereignisse });
};
