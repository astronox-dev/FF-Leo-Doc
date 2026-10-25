import { asueDruckFuerBericht } from './asue';
import { berichtLaden, mannschaftFuer, teilnahmeStandFuer } from './berichte';
import type { SessionUser } from './auth';
import { TYPEN } from '$lib/berichte/typen';
import { datumZeit } from '$lib/format';

/** Alles, was die Druckansicht eines Berichts braucht */
export async function druckdaten(id: number, user: SessionUser | null, druck = false) {
	const bericht = await berichtLaden(id, user, { druck });
	const fuss =
		bericht.status === 'eingereicht'
			? `FF-Leo Doc · ${TYPEN[bericht.typ].kurz} Nr. ${bericht.id} · eingereicht am ${datumZeit(bericht.eingereichtAm)}`
			: `FF-Leo Doc · ${TYPEN[bericht.typ].kurz} Nr. ${bericht.id} · Entwurf, Stand ${datumZeit(bericht.geaendertAm)}`;
	return {
		bericht,
		mannschaft: await mannschaftFuer(bericht),
		stand: await teilnahmeStandFuer(bericht),
		asue: await asueDruckFuerBericht(id),
		fuss
	};
}
