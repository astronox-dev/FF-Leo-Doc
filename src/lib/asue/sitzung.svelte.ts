import { browser } from '$app/environment';
import { reduziere, type Ereignis, type EreignisTyp, type Zustand } from './kern';

/*
 * Eine Atemschutzüberwachung auf diesem Gerät: Ereignisse werden sofort angewendet,
 * lokal gespeichert und an den Server gesendet. Ohne Netz bleiben sie „offen“ und gehen
 * raus, sobald die Verbindung wieder steht. Neue Ereignisse anderer Geräte kommen per
 * Server-Sent Events.
 */

const PREFIX = 'ffleodoc-asue-';
const GERAET_KEY = 'ffleodoc-geraet';

function zufall(laenge: number, zeichen = 'abcdefghijklmnopqrstuvwxyz0123456789') {
	return [...crypto.getRandomValues(new Uint8Array(laenge))].map((b) => zeichen[b % zeichen.length]).join('');
}
export const neueId = (laenge = 10) => zufall(laenge);
/** Codes ohne verwechselbare Zeichen (0/O, 1/I/L) */
export const neuerCode = () => zufall(6, '23456789ABCDEFGHJKMNPQRSTUVWXYZ');
export const CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
export const codeLesen = (text: string) => String(text).toUpperCase().replace(/[^A-Z0-9]/g, '');

function geraetId(): string {
	try {
		let id = localStorage.getItem(GERAET_KEY);
		if (!id) {
			id = zufall(10);
			localStorage.setItem(GERAET_KEY, id);
		}
		return id;
	} catch {
		return 'unbekannt';
	}
}

type Gespeichert = { ereignisse: Ereignis[]; offen: string[] };

function lesen(code: string): Gespeichert {
	try {
		const s = JSON.parse(localStorage.getItem(PREFIX + code) ?? 'null');
		if (s && Array.isArray(s.ereignisse)) return { ereignisse: s.ereignisse, offen: Array.isArray(s.offen) ? s.offen : [] };
	} catch {
		/* leer */
	}
	return { ereignisse: [], offen: [] };
}

/** Überwachungen mit Änderungen, die der Server noch nicht hat (z. B. nach einem Funkloch) */
export function offeneSitzungen(): string[] {
	const codes: string[] = [];
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k?.startsWith(PREFIX) && lesen(k.slice(PREFIX.length)).offen.length) codes.push(k.slice(PREFIX.length));
		}
	} catch {
		/* leer */
	}
	return codes;
}

export class Sitzung {
	code: string;
	ereignisse = $state<Ereignis[]>([]);
	offen = $state<string[]>([]);
	verbunden = $state(false);
	unbekannt = $state(false);
	zustand: Zustand = $derived(reduziere(this.ereignisse));

	#quelle: EventSource | null = null;
	#neuVerbinden: ReturnType<typeof setTimeout> | undefined;
	#sendet = false;
	#beendet = false;
	#geraet = browser ? geraetId() : '';

	constructor(code: string) {
		this.code = code;
		const g = lesen(code);
		this.ereignisse = g.ereignisse;
		this.offen = g.offen;
	}

	#speichern() {
		try {
			localStorage.setItem(PREFIX + this.code, JSON.stringify({ ereignisse: this.ereignisse, offen: this.offen }));
		} catch {
			/* Speicher voll oder gesperrt: bleibt im Arbeitsspeicher */
		}
	}

	/** Neue Aktion auf diesem Gerät */
	aktion(typ: EreignisTyp, daten: Record<string, unknown> = {}) {
		const e: Ereignis = { id: zufall(16), t: Date.now(), typ, daten, geraet: this.#geraet };
		this.ereignisse.push(e);
		this.offen.push(e.id);
		this.#speichern();
		void this.senden();
	}

	#einfuegen(liste: Ereignis[]) {
		if (!liste.length) return;
		const bekannt = new Map(this.ereignisse.map((e) => [e.id, e]));
		const neu: Ereignis[] = [];
		for (const e of liste) {
			const vorhanden = bekannt.get(e.id);
			if (vorhanden) {
				if (vorhanden.seq == null) vorhanden.seq = e.seq;
			} else {
				neu.push(e);
				bekannt.set(e.id, e);
			}
		}
		if (neu.length) this.ereignisse.push(...neu);
		const empfangen = new Set(liste.map((e) => e.id));
		if (this.offen.some((id) => empfangen.has(id))) this.offen = this.offen.filter((id) => !empfangen.has(id));
		this.#speichern();
	}

	#hoechsteSeq() {
		let max = 0;
		for (const e of this.ereignisse) if ((e.seq ?? 0) > max) max = e.seq!;
		return max;
	}

	async senden() {
		if (this.#sendet || !this.offen.length) return;
		this.#sendet = true;
		try {
			while (this.offen.length && !this.#beendet) {
				const offen = this.ereignisse.filter((e) => this.offen.includes(e.id));
				const r = await fetch(`/api/asue/${this.code}/ereignisse`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(offen)
				});
				if (!r.ok) break;
				const { ereignisse } = (await r.json()) as { ereignisse: { id: string; seq: number }[] };
				const seqs = new Map(ereignisse.map((e) => [e.id, e.seq]));
				for (const e of this.ereignisse) if (seqs.has(e.id)) e.seq = seqs.get(e.id);
				this.offen = this.offen.filter((id) => !seqs.has(id));
				this.#speichern();
			}
		} catch {
			// kein Netz: bleibt offen und wird beim nächsten Versuch gesendet
		} finally {
			this.#sendet = false;
		}
	}

	async verbinden() {
		this.#quelle?.close();
		this.#quelle = null;
		this.verbunden = false;
		clearTimeout(this.#neuVerbinden);
		if (this.#beendet) return;

		try {
			const r = await fetch(`/api/asue/${this.code}/ereignisse?nach=${this.#hoechsteSeq()}`);
			if (r.status === 404 && !this.ereignisse.length) {
				this.unbekannt = true;
				return;
			}
			if (r.ok) this.#einfuegen(await r.json());
		} catch {
			/* offline */
		}
		if (this.#beendet) return;
		await this.senden();
		if (this.#beendet) return;

		const quelle = new EventSource(`/api/asue/${this.code}/live?nach=${this.#hoechsteSeq()}`);
		this.#quelle = quelle;
		quelle.onopen = () => {
			this.verbunden = true;
			void this.senden();
		};
		quelle.onmessage = (m) => {
			try {
				this.#einfuegen([JSON.parse(m.data)]);
			} catch {
				/* kaputte Nachricht ignorieren */
			}
		};
		quelle.onerror = () => {
			this.verbunden = false;
			// Bei 404/401 gibt der Browser auf; dann selbst später neu versuchen
			if (quelle.readyState === EventSource.CLOSED) this.#neuVerbinden = setTimeout(() => this.verbinden(), 5000);
		};
	}

	beenden() {
		this.#beendet = true;
		clearTimeout(this.#neuVerbinden);
		this.#quelle?.close();
		this.#quelle = null;
	}
}

/** Offene Änderungen anderer Überwachungen nachschicken */
export async function alleOffenenSenden(ausser?: string) {
	for (const code of offeneSitzungen()) {
		if (code === ausser) continue;
		const s = new Sitzung(code);
		await s.senden();
		s.beenden();
	}
}
