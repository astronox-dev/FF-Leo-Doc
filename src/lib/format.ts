const pad = (n: number) => String(n).padStart(2, '0');

/** JJJJ-MM-TT → TT.MM.JJJJ */
export const datumAusIso = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('.') : '');

export function datumZeit(d: Date | number | null | undefined): string {
	if (!d) return '';
	const x = new Date(d);
	return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}, ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function isoHeute(ts = Date.now()): string {
	const d = new Date(ts);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** „vor 5 min“, „gestern“ … für Listen */
export function relativ(d: Date | number): string {
	const ms = Date.now() - new Date(d).getTime();
	const min = Math.round(ms / 60000);
	if (min < 1) return 'gerade eben';
	if (min < 60) return `vor ${min} min`;
	const std = Math.round(min / 60);
	if (std < 24) return `vor ${std} Std.`;
	const tage = Math.round(std / 24);
	if (tage === 1) return 'gestern';
	if (tage < 7) return `vor ${tage} Tagen`;
	return datumZeit(d).split(',')[0];
}
