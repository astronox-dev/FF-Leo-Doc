import { fail } from '@sveltejs/kit';
import { asueEinstellungen, asueEinstellungenSpeichern } from '$lib/server/einstellungen';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ einstellungen: await asueEinstellungen() });

export const actions: Actions = {
	default: async ({ request }) => {
		const f = await request.formData();
		const zeitGrenze = Number(f.get('zeitGrenze'));
		const vorwarnung = Number(f.get('vorwarnung'));
		const standardTrupps = String(f.get('standardTrupps') ?? '')
			.split(/\r?\n/)
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, 20);
		if (!Number.isInteger(zeitGrenze) || zeitGrenze < 5 || zeitGrenze > 120) return fail(400, { fehler: 'Die Zeitgrenze muss zwischen 5 und 120 Minuten liegen.' });
		if (!Number.isInteger(vorwarnung) || vorwarnung < 0 || vorwarnung >= zeitGrenze) return fail(400, { fehler: 'Die Vorwarnung muss kürzer als die Zeitgrenze sein.' });
		await asueEinstellungenSpeichern({ zeitGrenze, vorwarnung, standardTrupps });
		return { erfolg: 'Gespeichert. Die Werte gelten für neue Überwachungen.' };
	}
};
