import { count } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './index';
import { users } from './schema';
import { generatePassword, hashPassword } from '../auth';

/**
 * Beim ersten Start ein Admin-Konto anlegen.
 * Die Mannschaft steht bewusst nicht im Code (das Image ist öffentlich): sie wird im Admin-Bereich importiert.
 */
export async function bootstrap() {
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
