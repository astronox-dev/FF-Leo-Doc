import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { dev } from '$app/environment';
import { db } from './db';
import { sessions, users, type User } from './db/schema';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT);
	return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
	const [algo, N, r, p, saltB64, hashB64] = stored.split('$');
	if (algo !== 'scrypt') return false;
	const expected = Buffer.from(hashB64, 'base64');
	const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
		N: Number(N),
		r: Number(r),
		p: Number(p),
		maxmem: SCRYPT.maxmem
	});
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Lesbares Einmal-Passwort ohne verwechselbare Zeichen */
export function generatePassword(length = 12): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
	const bytes = randomBytes(length);
	let out = '';
	for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
	return out;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/* ---------------------------------------------------------------- Sitzungen */

export const SESSION_COOKIE = 'ffleodoc_sitzung';
/** Browser begrenzen Cookies auf 400 Tage; das Cookie wird bei jeder Nutzung erneuert */
const COOKIE_MAX_AGE = 400 * 86_400;
/** „Zuletzt gesehen“ höchstens so oft schreiben */
const SEEN_EVERY = 10 * 60_000;

export type SessionUser = Pick<User, 'id' | 'username' | 'name' | 'role' | 'mustChangePassword'>;

export async function createSession(userId: number, userAgent: string | null) {
	const token = randomBytes(32).toString('base64url');
	await db.insert(sessions).values({ id: sha256(token), userId, userAgent: userAgent?.slice(0, 250) ?? null });
	await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
	return token;
}

export function setSessionCookie(cookies: Cookies, token: string) {
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev, maxAge: COOKIE_MAX_AGE });
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Prüft das Cookie. Sitzungen haben kein Ablaufdatum, damit im Einsatz niemand neu anmelden muss. */
export async function validateSession(token: string): Promise<SessionUser | null> {
	const id = sha256(token);
	const row = await db
		.select({
			lastSeenAt: sessions.lastSeenAt,
			id: users.id,
			username: users.username,
			name: users.name,
			role: users.role,
			active: users.active,
			mustChangePassword: users.mustChangePassword
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;
	if (!row.active) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	if (Date.now() - row.lastSeenAt.getTime() > SEEN_EVERY) {
		await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
	}
	const { lastSeenAt: _l, active: _a, ...user } = row;
	return user;
}

export async function invalidateSession(token: string) {
	await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function invalidateUserSessions(userId: number, exceptToken?: string) {
	if (exceptToken) {
		await db.delete(sessions).where(and(eq(sessions.userId, userId), sql`${sessions.id} <> ${sha256(exceptToken)}`));
	} else {
		await db.delete(sessions).where(eq(sessions.userId, userId));
	}
}

/* ---------------------------------------------------------- Rate-Limiting */

const attempts = new Map<string, { count: number; first: number }>();
const LOCK_WINDOW_MS = 15 * 60_000;

/** true = gesperrt. Zählt Fehlversuche je Schlüssel in einem Zeitfenster. */
export function isRateLimited(key: string, max = 6): boolean {
	const a = attempts.get(key);
	if (!a) return false;
	if (Date.now() - a.first > LOCK_WINDOW_MS) {
		attempts.delete(key);
		return false;
	}
	return a.count >= max;
}

export function registerFailure(key: string) {
	const now = Date.now();
	const a = attempts.get(key);
	if (!a || now - a.first > LOCK_WINDOW_MS) attempts.set(key, { count: 1, first: now });
	else a.count++;
	if (attempts.size > 5000) {
		for (const [k, v] of attempts) if (now - v.first > LOCK_WINDOW_MS) attempts.delete(k);
	}
}

export function clearFailures(key: string) {
	attempts.delete(key);
}
