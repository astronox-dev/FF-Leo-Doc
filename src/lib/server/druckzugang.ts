import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * Für die PDF-Erstellung öffnet ein Browser ohne Anmeldung die Druckansicht eines Berichts.
 * Dafür gibt es ein kurzlebiges, signiertes Token, das nur für genau diesen Bericht gilt.
 */

const SCHLUESSEL = randomBytes(32);
const GUELTIG_MS = 60_000;

const signatur = (id: number, bis: number) => createHmac('sha256', SCHLUESSEL).update(`${id}:${bis}`).digest('base64url');

export function druckToken(id: number): string {
	const bis = Date.now() + GUELTIG_MS;
	return `${bis}.${signatur(id, bis)}`;
}

export function druckTokenGueltig(id: number, token: string | null): boolean {
	if (!token) return false;
	const [bisText, sig] = token.split('.');
	const bis = Number(bisText);
	if (!Number.isFinite(bis) || bis < Date.now() || !sig) return false;
	const erwartet = Buffer.from(signatur(id, bis));
	const erhalten = Buffer.from(sig);
	return erwartet.length === erhalten.length && timingSafeEqual(erwartet, erhalten);
}
