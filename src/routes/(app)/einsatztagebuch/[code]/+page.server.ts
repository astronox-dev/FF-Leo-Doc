import { error } from '@sveltejs/kit';
import { CODE } from '$lib/server/etb';
import { berichtListe } from '$lib/server/berichte';
import { asueEinstellungen } from '$lib/server/einstellungen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!CODE.test(params.code)) error(404, 'Diesen Code gibt es nicht');
	const berichte = await berichtListe('offen');
	return {
		code: params.code,
		ich: locals.user!.name,
		// Funkrufnamen der eigenen Fahrzeuge als Vorschläge für An und Von
		funknamen: (await asueEinstellungen()).standardTrupps,
		berichte: berichte.map((b) => ({ id: b.id, typ: b.typ, einsatzort: b.einsatzort, datum: b.datum }))
	};
};
