import { json, redirect, type Handle, type HandleServerError, type ServerInit } from '@sveltejs/kit';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie, validateSession } from '$lib/server/auth';
import { ensureDatabase } from '$lib/server/db';
import { druckTokenGueltig } from '$lib/server/druckzugang';

export const init: ServerInit = async () => {
	await ensureDatabase();
};

/** Ohne Anmeldung erreichbar */
const OFFEN = ['/login', '/healthz'];
const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

export const handle: Handle = async ({ event, resolve }) => {
	await ensureDatabase();
	const path = event.url.pathname;

	event.locals.user = null;
	event.locals.sessionToken = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const user = await validateSession(token);
		if (user) {
			event.locals.user = user;
			event.locals.sessionToken = token;
			// Cookie bei jeder Seite erneuern: angemeldet bleibt man, solange das Gerät die App benutzt
			if (event.request.method === 'GET' && !path.startsWith('/api/')) setSessionCookie(event.cookies, token);
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	const theme = event.cookies.get('theme');
	event.locals.theme = theme === 'light' || theme === 'dark' ? theme : 'system';

	// Druckansicht für die PDF-Erstellung: kurzlebiges Token statt Anmeldung
	const zugang = event.url.searchParams.get('zugang');
	const druckBericht = /^\/berichte\/(\d+)\/druck$/.exec(path);
	const druckEtb = /^\/einsatztagebuch\/([A-Z0-9]{6})\/druck$/.exec(path);
	const druckErlaubt =
		(!!druckBericht && druckTokenGueltig(`bericht:${Number(druckBericht[1])}`, zugang)) ||
		(!!druckEtb && druckTokenGueltig(`etb:${druckEtb[1]}`, zugang));

	if (!event.locals.user && !druckErlaubt && !matches(path, OFFEN)) {
		if (path.startsWith('/api/')) return json({ message: 'Nicht angemeldet' }, { status: 401 });
		const weiter = path === '/' ? '' : `?weiter=${encodeURIComponent(path + event.url.search)}`;
		redirect(303, `/login${weiter}`);
	}

	const user = event.locals.user;
	if (user?.mustChangePassword && !matches(path, ['/passwort', '/logout']) && !druckErlaubt) {
		if (path.startsWith('/api/')) return json({ message: 'Bitte zuerst ein eigenes Passwort setzen' }, { status: 403 });
		redirect(303, '/passwort');
	}

	if (path.startsWith('/admin') && user?.role !== 'admin') {
		redirect(303, '/');
	}

	const htmlTheme = event.locals.theme === 'system' ? '' : event.locals.theme;
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%ff.theme%', htmlTheme),
		preload: ({ type, path }) => type === 'js' || type === 'css' || (type === 'font' && path.includes('latin-wdth-normal'))
	});

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'no-store');
	return response;
};

export const handleError: HandleServerError = ({ error, status }) => {
	if (status !== 404) console.error(error);
	return { message: status === 404 ? 'Seite nicht gefunden' : 'Unerwarteter Fehler' };
};
