import { fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import {
	clearFailures,
	createSession,
	hashPassword,
	isRateLimited,
	registerFailure,
	setSessionCookie,
	verifyPassword
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

function sichererWeiter(weiter: string | null): string {
	if (!weiter || !weiter.startsWith('/') || weiter.startsWith('//')) return '/';
	return weiter;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, sichererWeiter(url.searchParams.get('weiter')));
	return { abgemeldet: url.searchParams.has('abgemeldet') };
};

let dummyHash: Promise<string> | null = null;

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!username || !password) return fail(400, { username, message: 'Bitte Benutzername und Passwort eingeben.' });

		const ip = getClientAddress();
		const key = `login:${ip}:${username.toLowerCase()}`;
		const ipKey = `login-ip:${ip}`;
		if (isRateLimited(key, 8) || isRateLimited(ipKey, 40)) {
			return fail(429, { username, message: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' });
		}

		const user = await db.select().from(users).where(eq(sql`lower(${users.username})`, username.toLowerCase())).get();
		let ok = false;
		if (user) {
			ok = user.active && (await verifyPassword(user.passwordHash, password));
		} else {
			// Gleiche Rechenzeit wie bei existierenden Konten
			dummyHash ??= hashPassword('dummy-password');
			await verifyPassword(await dummyHash, password);
		}

		if (!user || !ok) {
			registerFailure(key);
			registerFailure(ipKey);
			const message = user && !user.active ? 'Dieses Konto ist deaktiviert. Bitte an einen Admin wenden.' : 'Benutzername oder Passwort stimmt nicht.';
			return fail(400, { username, message });
		}

		clearFailures(key);
		const token = await createSession(user.id, request.headers.get('user-agent'));
		setSessionCookie(cookies, token);
		redirect(303, user.mustChangePassword ? '/passwort' : sichererWeiter(url.searchParams.get('weiter')));
	}
};
