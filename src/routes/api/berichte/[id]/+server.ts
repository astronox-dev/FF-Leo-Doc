import { error, json } from '@sveltejs/kit';
import { berichtSpeichern } from '$lib/server/berichte';
import { vollstaendig } from '$lib/berichte/typen';
import type { RequestHandler } from './$types';

const MAX_BYTES = 4 * 1024 * 1024;

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const user = locals.user!;
	const text = await request.text();
	if (text.length > MAX_BYTES) error(413, 'Bericht zu groß (Unterschriften oder Skizze verkleinern)');
	let body: { version?: unknown; daten?: unknown };
	try {
		body = JSON.parse(text);
	} catch {
		error(400, 'Ungültige Daten');
	}
	if (typeof body.version !== 'number') error(400, 'Version fehlt');
	const res = await berichtSpeichern(Number(params.id), body.version, vollstaendig(body.daten), user);
	if (res.status === 404) error(404, 'Bericht nicht gefunden');
	if (res.status === 423) error(423, 'Der Bericht ist eingereicht und kann nicht mehr geändert werden.');
	if (res.status === 409) return json({ konflikt: true }, { status: 409 });
	return json({ version: res.version });
};
