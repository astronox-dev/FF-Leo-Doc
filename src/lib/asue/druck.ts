import { abgeschlosseneEinsaetze, dauer, protokollEintraege, reduziere, type Ereignis } from './kern';

/** Atemschutzprotokoll, aufbereitet für den Anhang im Einsatzbericht */
export type AsueDruck = {
	code: string;
	datum: string;
	adresse: string;
	stufe: string;
	ueberwacher: string;
	einsaetze: { trupp: string; start: number; ende: number | null; dauer: string }[];
	log: { t: number; trupp: string; text: string }[];
};

export function asueDruck(code: string, ereignisse: Ereignis[], now = Date.now()): AsueDruck {
	const z = reduziere(ereignisse);
	const laufend = z.trupps.filter((t) => t.status === 'einsatz' && t.start).map((t) => ({ trupp: t, start: t.start!, ende: null as number | null }));
	return {
		code,
		datum: z.einsatz?.datum ?? '',
		adresse: z.einsatz?.adresse ?? '',
		stufe: z.einsatz?.stufe ?? '',
		ueberwacher: z.einsatz?.ueberwacher ?? '',
		einsaetze: [...abgeschlosseneEinsaetze(z), ...laufend].map((e) => ({
			trupp: e.trupp.name,
			start: e.start,
			ende: e.ende,
			dauer: dauer((e.ende ?? now) - e.start)
		})),
		log: protokollEintraege(z, now).map(({ t, trupp, text }) => ({ t, trupp, text }))
	};
}
