// Notfall-Zugang: setzt für ein Konto ein neues Einmal-Passwort und meldet alle Geräte ab.
//
//   node scripts/zugang.mjs admin
//   docker exec -it ff-leo-doc node scripts/zugang.mjs admin
//
// Ohne Benutzernamen werden alle Konten aufgelistet.

import path from 'node:path';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';

const scrypt = promisify(scryptCb);
const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const db = createClient({ url: `file:${path.join(dataDir, 'ffleodoc.db')}` });

async function hash(passwort) {
	const salt = randomBytes(16);
	const h = await scrypt(passwort.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
	return `scrypt$16384$8$1$${salt.toString('base64')}$${h.toString('base64')}`;
}

function passwort(laenge = 12) {
	const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
	return [...randomBytes(laenge)].map((b) => zeichen[b % zeichen.length]).join('');
}

const name = process.argv[2];
if (!name) {
	const { rows } = await db.execute('SELECT username, name, role, active FROM users ORDER BY username');
	console.log('Konten:');
	for (const r of rows) console.log(`  ${r.username}  (${r.name}, ${r.role}${r.active ? '' : ', gesperrt'})`);
	console.log('\nNeues Passwort setzen: node scripts/zugang.mjs <benutzername>');
	process.exit(0);
}

const { rows } = await db.execute({ sql: 'SELECT id FROM users WHERE lower(username) = lower(?)', args: [name] });
if (!rows.length) {
	console.error(`Kein Konto „${name}“ gefunden.`);
	process.exit(1);
}
const neu = passwort();
await db.execute({ sql: 'UPDATE users SET password_hash = ?, must_change_password = 1, active = 1 WHERE id = ?', args: [await hash(neu), rows[0].id] });
await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [rows[0].id] });
console.log(`Neues Einmal-Passwort für ${name}: ${neu}`);
console.log('Das Konto ist entsperrt, alle Geräte sind abgemeldet. Beim Anmelden muss ein eigenes Passwort gesetzt werden.');
