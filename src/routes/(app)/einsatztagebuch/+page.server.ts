import { tagebuchListe } from '$lib/server/etb';
import { berichtListe } from '$lib/server/berichte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const berichte = await berichtListe('offen');
	return {
		liste: await tagebuchListe(),
		berichte: berichte.map((b) => ({ id: b.id, typ: b.typ, einsatzort: b.einsatzort, datum: b.datum }))
	};
};
