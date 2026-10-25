import { einsatzListe } from '$lib/server/asue';
import { berichtListe } from '$lib/server/berichte';
import { asueEinstellungen } from '$lib/server/einstellungen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const berichte = await berichtListe('offen');
	return {
		liste: await einsatzListe(),
		berichte: berichte.map((b) => ({ id: b.id, typ: b.typ, einsatzort: b.einsatzort, datum: b.datum })),
		einstellungen: await asueEinstellungen()
	};
};
