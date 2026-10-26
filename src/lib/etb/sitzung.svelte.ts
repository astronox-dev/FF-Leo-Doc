import { reduziere, type Ereignis, type EreignisTyp, type Zustand } from './kern';
import { LiveSitzung, offeneSitzungen } from '$lib/live/sitzung.svelte';

/* Ein Einsatztagebuch auf diesem Gerät, siehe $lib/live/sitzung.svelte.ts */

export class TagebuchSitzung extends LiveSitzung<EreignisTyp, Ereignis, Zustand> {
	constructor(code: string) {
		super('etb', code, reduziere);
	}
}

/** Offene Änderungen anderer Tagebücher nachschicken */
export async function alleOffenenSenden(ausser?: string) {
	for (const code of offeneSitzungen('etb')) {
		if (code === ausser) continue;
		const s = new TagebuchSitzung(code);
		await s.senden();
		s.beenden();
	}
}
