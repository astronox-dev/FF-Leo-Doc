import { error } from '@sveltejs/kit';
import { abonnieren, CODE, einsatzVorhanden, ereignisseNach } from '$lib/server/asue';
import type { RequestHandler } from './$types';

/** Server-Sent Events: neue Ereignisse gehen sofort an alle Geräte dieser Überwachung */
export const GET: RequestHandler = async ({ params, url, request }) => {
	if (!CODE.test(params.code)) error(404, 'Nicht gefunden');
	if (!(await einsatzVorhanden(params.code))) error(404, 'Überwachung unbekannt');
	const nach = Number(request.headers.get('last-event-id') ?? url.searchParams.get('nach')) || 0;
	const verpasst = await ereignisseNach(params.code, nach);
	const enc = new TextEncoder();

	let abmelden = () => {};
	let puls: ReturnType<typeof setInterval> | undefined;
	const stream = new ReadableStream({
		start(controller) {
			const senden = (text: string) => {
				try {
					controller.enqueue(enc.encode(text));
				} catch {
					aufraeumen();
				}
			};
			const aufraeumen = () => {
				clearInterval(puls);
				abmelden();
			};
			senden('retry: 3000\n\n');
			for (const e of verpasst) senden(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
			abmelden = abonnieren(params.code, { senden });
			// Hält die Verbindung durch Proxys und Cloudflare offen
			puls = setInterval(() => senden(': da\n\n'), 25000);
			request.signal.addEventListener('abort', () => {
				aufraeumen();
				try {
					controller.close();
				} catch {
					/* schon zu */
				}
			});
		},
		cancel() {
			clearInterval(puls);
			abmelden();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Accel-Buffering': 'no',
			Connection: 'keep-alive'
		}
	});
};
