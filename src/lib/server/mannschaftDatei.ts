/*
 * Teilnahmeliste als Datei: Import und Export im Admin-Bereich.
 * Format je Zeile: Stbnr; Nachname; Vorname; Gruppe (aktiv/reserve); Sichtbar (ja/nein)
 * Getrennt durch Semikolon, Tabulator oder Komma; Gruppe und Sichtbar dürfen fehlen.
 */

export type ListenEintrag = { stbnr: number; nachname: string; vorname: string; gruppe: 'aktiv' | 'reserve'; sichtbar?: boolean };

export function listeLesen(text: string): { eintraege: ListenEintrag[]; fehler: string[] } {
	const eintraege: ListenEintrag[] = [];
	const fehler: string[] = [];
	const gesehen = new Set<number>();
	const zeilen = text.replace(/^﻿/, '').split(/\r?\n/);
	zeilen.forEach((zeile, i) => {
		if (!zeile.trim()) return;
		const trenner = zeile.includes(';') ? ';' : zeile.includes('\t') ? '\t' : ',';
		const [nr, nachname = '', vorname = '', gruppe = '', sichtbar = ''] = zeile.split(trenner).map((s) => s.trim().replace(/^"(.*)"$/, '$1'));
		const stbnr = Number(nr);
		// Kopfzeile oder Überschriften überspringen
		if (!/^\d+$/.test(nr)) {
			if (i > 0 || !/stb/i.test(nr)) fehler.push(`Zeile ${i + 1}: keine Standesbuchnummer`);
			return;
		}
		if (stbnr < 1 || stbnr > 9999) return void fehler.push(`Zeile ${i + 1}: Standesbuchnummer ${nr} ungültig`);
		if (!nachname || !vorname) return void fehler.push(`Zeile ${i + 1}: Vor- oder Nachname fehlt`);
		if (gesehen.has(stbnr)) return void fehler.push(`Zeile ${i + 1}: Standesbuchnummer ${stbnr} doppelt`);
		gesehen.add(stbnr);
		eintraege.push({
			stbnr,
			nachname,
			vorname,
			gruppe: /res/i.test(gruppe) ? 'reserve' : 'aktiv',
			...(sichtbar ? { sichtbar: !/^(nein|n|0|false|aus)$/i.test(sichtbar) } : {})
		});
	});
	return { eintraege, fehler };
}

export function listeAlsCsv(liste: { stbnr: number; nachname: string; vorname: string; gruppe: string; sichtbar: boolean }[]): string {
	const feld = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
	const zeilen = ['Stbnr;Nachname;Vorname;Gruppe;Sichtbar', ...liste.map((m) => [m.stbnr, feld(m.nachname), feld(m.vorname), m.gruppe, m.sichtbar ? 'ja' : 'nein'].join(';'))];
	// BOM, damit Excel die Umlaute richtig liest
	return '﻿' + zeilen.join('\r\n') + '\r\n';
}
