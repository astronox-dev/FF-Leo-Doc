/*
 * Schlauchleitung als frei gelegte Linie: weiche Kurve durch alle Punkte (Catmull-Rom),
 * ohne Querstriche an den Enden. Punkte als flache Liste [x, y, x, y …].
 */

const r = (v: number) => Math.round(v * 10) / 10;

/** Bézier-Abschnitte der Kurve: je Abschnitt Start, zwei Stützpunkte, Ende */
function abschnitte(p: number[]): number[][] {
	const n = p.length / 2;
	const P = (i: number) => {
		const k = Math.max(0, Math.min(n - 1, i));
		return [p[k * 2], p[k * 2 + 1]];
	};
	const out: number[][] = [];
	for (let i = 0; i < n - 1; i++) {
		const [x0, y0] = P(i - 1), [x1, y1] = P(i), [x2, y2] = P(i + 1), [x3, y3] = P(i + 2);
		out.push([x1, y1, x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2]);
	}
	return out;
}

/** SVG-Pfad der Kurve durch alle Punkte */
export function schlauchPfad(p: number[]): string {
	const n = p.length / 2;
	if (n < 2) return '';
	if (n === 2) return `M${p[0]} ${p[1]} L${p[2]} ${p[3]}`;
	let d = `M${p[0]} ${p[1]}`;
	for (const [, , a, b, c, e, x, y] of abschnitte(p)) d += ` C${r(a)} ${r(b)} ${r(c)} ${r(e)} ${x} ${y}`;
	return d;
}

/** Die Kurve als feine Punktfolge, damit Beschriftung und Griff wirklich auf der Linie liegen */
function kurvenPunkte(p: number[]): number[] {
	if (p.length <= 4) return p;
	const out = [p[0], p[1]];
	for (const [x0, y0, a, b, c, e, x1, y1] of abschnitte(p)) {
		for (let k = 1; k <= 12; k++) {
			const t = k / 12, u = 1 - t;
			out.push(
				u * u * u * x0 + 3 * u * u * t * a + 3 * u * t * t * c + t * t * t * x1,
				u * u * u * y0 + 3 * u * u * t * b + 3 * u * t * t * e + t * t * t * y1
			);
		}
	}
	return out;
}

/**
 * Punkt auf halber Länge der Kurve mit Richtungswinkel (für die Beschriftung B oder C).
 * Der Winkel ist auf −90° bis 90° gebracht, damit Text daran nie auf dem Kopf steht.
 */
export function schlauchMitte(punkte: number[]): { x: number; y: number; winkel: number } {
	const p = kurvenPunkte(punkte);
	const m = mitteDerFolge(p);
	if (m.winkel > 90) m.winkel -= 180;
	else if (m.winkel < -90) m.winkel += 180;
	return m;
}

function mitteDerFolge(p: number[]): { x: number; y: number; winkel: number } {
	const n = p.length / 2;
	let gesamt = 0;
	for (let i = 0; i < n - 1; i++) gesamt += Math.hypot(p[i * 2 + 2] - p[i * 2], p[i * 2 + 3] - p[i * 2 + 1]);
	let rest = gesamt / 2;
	for (let i = 0; i < n - 1; i++) {
		const dx = p[i * 2 + 2] - p[i * 2], dy = p[i * 2 + 3] - p[i * 2 + 1];
		const l = Math.hypot(dx, dy);
		if (rest <= l || i === n - 2) {
			const t = l ? Math.min(1, rest / l) : 0;
			return { x: p[i * 2] + dx * t, y: p[i * 2 + 1] + dy * t, winkel: (Math.atan2(dy, dx) * 180) / Math.PI };
		}
		rest -= l;
	}
	return { x: p[0], y: p[1], winkel: 0 };
}

/** Abschnitt, dem ein Punkt am nächsten liegt: dort wird beim Biegen ein neuer Punkt eingefügt */
export function naechsterAbschnitt(p: number[], x: number, y: number): number {
	let best = 0, abstand = Infinity;
	for (let i = 0; i < p.length / 2 - 1; i++) {
		const ax = p[i * 2], ay = p[i * 2 + 1], bx = p[i * 2 + 2], by = p[i * 2 + 3];
		const dx = bx - ax, dy = by - ay;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
		const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
		if (d < abstand) {
			abstand = d;
			best = i;
		}
	}
	return best;
}
