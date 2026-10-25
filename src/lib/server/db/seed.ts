import { count } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './index';
import { mannschaft, users } from './schema';
import { generatePassword, hashPassword } from '../auth';

/** Teilnahmeliste aus den Aufnahmeblättern, Stand April 2026: [Stbnr, Nachname, Vorname] */
const AKTIV: [number, string, string][] = [];
const RESERVE: [number, string, string][] = [];

/** Beim ersten Start: Mannschaft eintragen und ein Admin-Konto anlegen */
export async function bootstrap() {
	const [{ n: mitglieder }] = await db.select({ n: count() }).from(mannschaft);
	if (mitglieder === 0) {
		await db.insert(mannschaft).values([
			...AKTIV.map(([stbnr, nachname, vorname]) => ({ stbnr, nachname, vorname, gruppe: 'aktiv' as const })),
			...RESERVE.map(([stbnr, nachname, vorname]) => ({ stbnr, nachname, vorname, gruppe: 'reserve' as const }))
		]);
	}

	const [{ n: konten }] = await db.select({ n: count() }).from(users);
	if (konten === 0) {
		const passwort = env.ADMIN_PASSWORT || generatePassword();
		await db.insert(users).values({
			username: 'admin',
			name: 'Administrator',
			passwordHash: await hashPassword(passwort),
			role: 'admin',
			mustChangePassword: !env.ADMIN_PASSWORT
		});
		if (!env.ADMIN_PASSWORT) {
			console.log('------------------------------------------------------------');
			console.log('Erstes Admin-Konto angelegt. Benutzername: admin');
			console.log(`Einmal-Passwort: ${passwort}`);
			console.log('Beim ersten Anmelden muss ein eigenes Passwort gesetzt werden.');
			console.log('------------------------------------------------------------');
		}
	}
}
