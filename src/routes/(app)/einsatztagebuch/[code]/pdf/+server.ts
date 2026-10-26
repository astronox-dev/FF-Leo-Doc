import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { CODE, etbDruck } from '$lib/server/etb';
import { druckToken } from '$lib/server/druckzugang';
import { seiteAlsPdf } from '$lib/server/pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	if (!CODE.test(params.code)) error(404, 'Nicht gefunden');
	const etb = await etbDruck(params.code);
	if (!etb) error(404, 'Tagebuch unbekannt');

	// Der Browser für das PDF ruft die Druckansicht intern auf, nicht über Cloudflare
	const basis = env.INTERNAL_URL || (dev ? url.origin : `http://127.0.0.1:${env.PORT || 3000}`);
	let pdf: Uint8Array;
	try {
		pdf = await seiteAlsPdf(`${basis}/einsatztagebuch/${params.code}/druck?zugang=${encodeURIComponent(druckToken(`etb:${params.code}`))}`);
	} catch (e) {
		console.error('PDF-Erstellung fehlgeschlagen', e);
		error(500, 'Das PDF konnte nicht erstellt werden.');
	}

	const ort = (etb.zustand.kopf?.einsatzort ?? '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
	const name = `Einsatztagebuch-${etb.zustand.kopf?.datum || 'ohne-Datum'}${ort ? `-${ort}` : ''}.pdf`;
	return new Response(pdf as BodyInit, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			'Cache-Control': 'no-store'
		}
	});
};
