import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hashPassword, invalidateUserSessions, MIN_PASSWORD_LENGTH, verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	return { muss: locals.user.mustChangePassword };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) redirect(303, '/login');
		const form = await request.formData();
		const alt = String(form.get('alt') ?? '');
		const neu = String(form.get('neu') ?? '');
		const wiederholung = String(form.get('wiederholung') ?? '');

		const row = await db.select().from(users).where(eq(users.id, user.id)).get();
		if (!row || !(await verifyPassword(row.passwordHash, alt))) return fail(400, { message: 'Das bisherige Passwort stimmt nicht.' });
		if (neu.length < MIN_PASSWORD_LENGTH) return fail(400, { message: `Das neue Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.` });
		if (neu !== wiederholung) return fail(400, { message: 'Die beiden neuen Passwörter stimmen nicht überein.' });
		if (neu === alt) return fail(400, { message: 'Das neue Passwort muss sich vom bisherigen unterscheiden.' });

		await db.update(users).set({ passwordHash: await hashPassword(neu), mustChangePassword: false }).where(eq(users.id, user.id));
		// Andere Geräte abmelden, dieses bleibt angemeldet
		await invalidateUserSessions(user.id, locals.sessionToken ?? undefined);
		redirect(303, '/?passwort=geaendert');
	}
};
