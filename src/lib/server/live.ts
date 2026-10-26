/*
 * Server-Seite der Live-Werkzeuge (Atemschutzüberwachung, Einsatztagebuch):
 * Prüfung eingehender Ereignisse und Verteilung an alle offenen Verbindungen per Server-Sent Events.
 */

export const CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const EREIGNIS_ID = /^[a-z0-9]{8,40}$/;

export type Gesendet = { id: string; t: number; typ: string; daten: Record<string, unknown>; geraet?: string; seq?: number; von?: string };

/** Grundform eines Ereignisses prüfen; der Typ muss zum Werkzeug gehören */
export function istEreignis(e: unknown, typen: ReadonlySet<string>): e is Gesendet {
	if (!e || typeof e !== 'object') return false;
	const x = e as Record<string, unknown>;
	return (
		typeof x.id === 'string' &&
		EREIGNIS_ID.test(x.id) &&
		typeof x.t === 'number' &&
		Number.isFinite(x.t) &&
		x.t > 0 &&
		typeof x.typ === 'string' &&
		typen.has(x.typ) &&
		!!x.daten &&
		typeof x.daten === 'object' &&
		!Array.isArray(x.daten) &&
		JSON.stringify(x.daten).length <= 8000
	);
}

type Zuhoerer = { senden: (text: string) => void };
const zuhoerer = new Map<string, Set<Zuhoerer>>();

export function abonnieren(kanal: string, z: Zuhoerer) {
	if (!zuhoerer.has(kanal)) zuhoerer.set(kanal, new Set());
	zuhoerer.get(kanal)!.add(z);
	return () => {
		zuhoerer.get(kanal)?.delete(z);
		if (!zuhoerer.get(kanal)?.size) zuhoerer.delete(kanal);
	};
}

export function verteilen(kanal: string, ereignisse: { seq?: number }[]) {
	for (const z of zuhoerer.get(kanal) ?? []) {
		for (const e of ereignisse) z.senden(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
	}
}

/** Antwort für eine Live-Verbindung: zuerst verpasste Ereignisse, dann alles Neue */
export function liveAntwort(kanal: string, verpasst: { seq?: number }[], request: Request): Response {
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
			abmelden = abonnieren(kanal, { senden });
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
}
