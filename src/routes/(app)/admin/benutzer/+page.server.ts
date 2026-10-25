import { fail } from '@sveltejs/kit';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { generatePassword, hashPassword, invalidateUserSessions } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const liste = await db
		.select({ id: users.id, username: users.username, name: users.name, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt, mustChangePassword: users.mustChangePassword })
		.from(users)
		.orderBy(asc(users.name));
	return { liste };
};

const NAME = /^[a-z0-9._-]{2,40}$/;

/** Mindestens ein aktiver Admin muss bleiben */
async function letzterAdmin(id: number) {
	const [{ n }] = await db
		.select({ n: count() })
		.from(users)
		.where(and(eq(users.role, 'admin'), eq(users.active, true), ne(users.id, id)));
	return n === 0;
}

export const actions: Actions = {
	anlegen: async ({ request }) => {
		const f = await request.formData();
		const username = String(f.get('username') ?? '').trim().toLowerCase();
		const name = String(f.get('name') ?? '').trim();
		const role = f.get('role') === 'admin' ? 'admin' : 'nutzer';
		if (!NAME.test(username)) return fail(400, { fehler: 'Benutzername: 2 bis 40 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt, Bindestrich, Unterstrich.' });
		if (!name) return fail(400, { fehler: 'Bitte einen Namen eingeben.' });
		const vorhanden = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.username})`, username)).get();
		if (vorhanden) return fail(400, { fehler: `Den Benutzernamen „${username}“ gibt es schon.` });
		const passwort = generatePassword();
		await db.insert(users).values({ username, name, role, passwordHash: await hashPassword(passwort), mustChangePassword: true });
		return { erfolg: `${name} ist angelegt.`, zugang: { username, passwort } };
	},

	aendern: async ({ request, locals }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		const name = String(f.get('name') ?? '').trim();
		const role = f.get('role') === 'admin' ? 'admin' : 'nutzer';
		const active = f.get('active') === 'on';
		if (!name) return fail(400, { fehler: 'Bitte einen Namen eingeben.' });
		if ((role !== 'admin' || !active) && (await letzterAdmin(id))) return fail(400, { fehler: 'Es muss mindestens ein aktiver Admin bleiben.' });
		if (id === locals.user!.id && !active) return fail(400, { fehler: 'Du kannst dich nicht selbst sperren.' });
		await db.update(users).set({ name, role, active }).where(eq(users.id, id));
		if (!active) await invalidateUserSessions(id);
		return { erfolg: `${name} ist gespeichert.` };
	},

	passwort: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		const u = await db.select().from(users).where(eq(users.id, id)).get();
		if (!u) return fail(404, { fehler: 'Benutzer nicht gefunden.' });
		const passwort = generatePassword();
		await db.update(users).set({ passwordHash: await hashPassword(passwort), mustChangePassword: true }).where(eq(users.id, id));
		await invalidateUserSessions(id);
		return { erfolg: `Neues Einmal-Passwort für ${u.name}. Alle Geräte wurden abgemeldet.`, zugang: { username: u.username, passwort } };
	},

	loeschen: async ({ request, locals }) => {
		const id = Number((await request.formData()).get('id'));
		if (id === locals.user!.id) return fail(400, { fehler: 'Du kannst dich nicht selbst löschen.' });
		if (await letzterAdmin(id)) return fail(400, { fehler: 'Es muss mindestens ein aktiver Admin bleiben.' });
		await db.delete(users).where(eq(users.id, id));
		return { erfolg: 'Benutzer gelöscht. Seine Berichte bleiben erhalten.' };
	}
};
