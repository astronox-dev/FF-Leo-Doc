import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * Für die PDF-Erstellung öffnet ein Browser ohne Anmeldung eine Druckansicht (Bericht oder
 * Einsatztagebuch). Dafür gibt es ein kurzlebiges, signiertes Token, das nur für genau diese
 * Ansicht gilt, z. B. „bericht:12“ oder „etb:K7M4QX“.
 */

const SCHLUESSEL = randomBytes(32);
const GUELTIG_MS = 60_000;

const signatur = (ziel: string, bis: number) => createHmac('sha256', SCHLUESSEL).update(`${ziel}:${bis}`).digest('base64url');

export function druckToken(ziel: string): string {
	const bis = Date.now() + GUELTIG_MS;
	return `${bis}.${signatur(ziel, bis)}`;
}

export function druckTokenGueltig(ziel: string, token: string | null): boolean {
	if (!token) return false;
	const [bisText, sig] = token.split('.');
	const bis = Number(bisText);
	if (!Number.isFinite(bis) || bis < Date.now() || !sig) return false;
	const erwartet = Buffer.from(signatur(ziel, bis));
	const erhalten = Buffer.from(sig);
	return erwartet.length === erhalten.length && timingSafeEqual(erwartet, erhalten);
}
