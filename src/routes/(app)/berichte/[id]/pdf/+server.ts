import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { berichtLaden } from '$lib/server/berichte';
import { druckToken } from '$lib/server/druckzugang';
import { seiteAlsPdf } from '$lib/server/pdf';
import { TYPEN } from '$lib/berichte/typen';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Bericht nicht gefunden');
	// Prüft auch, ob der Benutzer den Bericht sehen darf
	const b = await berichtLaden(id, locals.user);

	// Der Browser für das PDF ruft die Druckansicht intern auf, nicht über Cloudflare
	const basis = env.INTERNAL_URL || (dev ? url.origin : `http://127.0.0.1:${env.PORT || 3000}`);
	let pdf: Uint8Array;
	try {
		pdf = await seiteAlsPdf(`${basis}/berichte/${id}/druck?zugang=${encodeURIComponent(druckToken(id))}`);
	} catch (e) {
		console.error('PDF-Erstellung fehlgeschlagen', e);
		error(500, 'Das PDF konnte nicht erstellt werden.');
	}

	const ort = b.daten.einsatzort.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
	const name = `Einsatzbericht-${TYPEN[b.typ].kurz.replace(/\s+/g, '-')}-${b.daten.alarmierung.datum || 'ohne-Datum'}${ort ? `-${ort}` : ''}.pdf`;
	return new Response(pdf as BodyInit, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			'Cache-Control': 'no-store'
		}
	});
};
