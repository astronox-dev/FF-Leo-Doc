import { error, json } from '@sveltejs/kit';
import { berichtEinreichen } from '$lib/server/berichte';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const res = await berichtEinreichen(Number(params.id), locals.user!);
	if (res.status === 404) error(404, 'Bericht nicht gefunden');
	if (res.status === 423) error(423, 'Der Bericht ist schon eingereicht.');
	if (res.status === 400) return json({ fehlt: res.fehlt }, { status: 400 });
	return json({ ok: true });
};
