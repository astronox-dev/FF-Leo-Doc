import { eq } from 'drizzle-orm';
import { db } from './db';
import { einstellungen } from './db/schema';

export type AsueEinstellungen = {
	/** Alarm nach so vielen Minuten unter Atemschutz */
	zeitGrenze: number;
	/** Vorwarnung so viele Minuten vor der Grenze */
	vorwarnung: number;
	/** Trupps, die bei jeder neuen Atemschutzüberwachung schon bereitstehen */
	standardTrupps: string[];
};

export const ASUE_STANDARD: AsueEinstellungen = {
	zeitGrenze: 30,
	vorwarnung: 5,
	standardTrupps: ['Tank 1 Leopoldsdorf', 'Tank 2 Leopoldsdorf', 'Pumpe Leopoldsdorf']
};

async function lesen<T extends object>(key: string, standard: T): Promise<T> {
	const row = await db.select().from(einstellungen).where(eq(einstellungen.key, key)).get();
	if (!row) return standard;
	try {
		return { ...standard, ...JSON.parse(row.value) };
	} catch {
		return standard;
	}
}

async function schreiben(key: string, wert: object) {
	const value = JSON.stringify(wert);
	await db.insert(einstellungen).values({ key, value }).onConflictDoUpdate({ target: einstellungen.key, set: { value } });
}

export const asueEinstellungen = () => lesen('asue', ASUE_STANDARD);
export const asueEinstellungenSpeichern = (wert: AsueEinstellungen) => schreiben('asue', wert);

/** „Stand“ der Teilnahmeliste, steht auf der Teilnahme-Seite jedes Berichts */
export const teilnahmeStand = async () => (await lesen('teilnahme', { stand: 'April 2026' })).stand;
export const teilnahmeStandSpeichern = (stand: string) => schreiben('teilnahme', { stand });
