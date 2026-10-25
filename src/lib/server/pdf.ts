import fs from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import { env } from '$env/dynamic/private';

/*
 * PDF-Erstellung mit einem kopflosen Chrome/Chromium/Edge: dieselbe Druckansicht wie beim
 * Drucken im Browser, daher sieht das PDF genau wie die Vorschau aus.
 */

const KANDIDATEN = [
	'/usr/bin/chromium-browser',
	'/usr/bin/chromium',
	'/usr/bin/google-chrome',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

function browserPfad(): string {
	if (env.CHROME_PATH) return env.CHROME_PATH;
	const gefunden = KANDIDATEN.find((p) => fs.existsSync(p));
	if (!gefunden) throw new Error('Kein Chrome/Chromium/Edge gefunden. Bitte CHROME_PATH setzen.');
	return gefunden;
}

let browser: Promise<Browser> | null = null;

function starten(): Promise<Browser> {
	browser ??= puppeteer
		.launch({
			executablePath: browserPfad(),
			headless: true,
			args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none']
		})
		.then((b) => {
			b.on('disconnected', () => (browser = null));
			return b;
		})
		.catch((e) => {
			browser = null;
			throw e;
		});
	return browser;
}

/** Druckt die übergebene Adresse als A4-PDF */
export async function seiteAlsPdf(url: string): Promise<Uint8Array> {
	const b = await starten();
	const seite = await b.newPage();
	try {
		await seite.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
		await seite.waitForSelector('[data-fertig]', { timeout: 10_000 });
		await seite.evaluate(() => document.fonts.ready);
		return await seite.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
	} finally {
		await seite.close().catch(() => {});
	}
}
