import { error } from '@sveltejs/kit';
import { CODE } from '$lib/server/asue';
import { berichtListe } from '$lib/server/berichte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!CODE.test(params.code)) error(404, 'Diesen Code gibt es nicht');
	const berichte = await berichtListe('offen');
	return {
		code: params.code,
		berichte: berichte.map((b) => ({ id: b.id, typ: b.typ, einsatzort: b.einsatzort, datum: b.datum }))
	};
};
