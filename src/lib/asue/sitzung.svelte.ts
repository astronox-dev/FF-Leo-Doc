import { reduziere, type Ereignis, type EreignisTyp, type Zustand } from './kern';
import { LiveSitzung, offeneSitzungen } from '$lib/live/sitzung.svelte';

/* Eine Atemschutzüberwachung auf diesem Gerät, siehe $lib/live/sitzung.svelte.ts */

export { CODE, codeLesen, neueId, neuerCode } from '$lib/live/sitzung.svelte';

export class Sitzung extends LiveSitzung<EreignisTyp, Ereignis, Zustand> {
	constructor(code: string) {
		super('asue', code, (e) => reduziere(e));
	}
}

/** Offene Änderungen anderer Überwachungen nachschicken */
export async function alleOffenenSenden(ausser?: string) {
	for (const code of offeneSitzungen('asue')) {
		if (code === ausser) continue;
		const s = new Sitzung(code);
		await s.senden();
		s.beenden();
	}
}
