<script lang="ts">
	import { kuerzel, nummerVon, type Eintrag, type Zustand } from '$lib/etb/kern';

	/*
	 * Einsatztagebuch im Layout des NÖ-LFV-Formulars: A4 quer, Kopf mit Blatt-Nr., Feuerwehr,
	 * Datum, Einsatzort und Bearbeiter, darunter die Tabelle. Ein Blatt fasst höchstens zehn Zeilen;
	 * lange Einträge brauchen mehr Höhe, dann kommen entsprechend weniger auf ein Blatt.
	 */
	let { zustand, fuss = '' }: { zustand: Zustand; fuss?: string } = $props();

	const dat = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '');

	/**
	 * Höhe des Tabellenbereichs in mm (mit etwas Reserve zum Blattrand) und Mindesthöhe einer Zeile
	 * wie am Papier. Die Höhe eines Eintrags wird aus der Textlänge geschätzt, damit nichts über das
	 * Blatt hinausläuft.
	 */
	const BEREICH = 118;
	const ZEILE = 11.8;
	const zeilenNoetig = (text: string, zeichen: number) =>
		text.split('\n').reduce((n, teil) => n + Math.max(1, Math.ceil(teil.length / zeichen)), 0);
	const hoehe = (x: Eintrag) => {
		const inhalt = zeilenNoetig(x.inhalt, 95) * 3.9;
		const namen = Math.max(zeilenNoetig(x.an, 13), zeilenNoetig(x.von, 13)) * 3.4;
		return Math.max(ZEILE, Math.max(inhalt, namen) + 3);
	};

	const blaetter = $derived.by(() => {
		const out: Eintrag[][] = [[]];
		let rest = BEREICH;
		for (const x of zustand.eintraege) {
			const h = hoehe(x);
			const blatt = out[out.length - 1];
			if (blatt.length && (blatt.length >= 10 || h > rest + 0.1)) {
				out.push([x]);
				rest = BEREICH - h;
			} else {
				blatt.push(x);
				rest -= h;
			}
		}
		return out;
	});

	/** Leere Zeilen, damit jedes Blatt wie das Formular bis unten liniert ist */
	function leer(blatt: Eintrag[]) {
		const belegt = blatt.reduce((s, x) => s + hoehe(x), 0);
		return Math.max(0, Math.min(10 - blatt.length, Math.floor((BEREICH - belegt + 0.1) / ZEILE)));
	}
</script>

{#each blaetter as blatt, i (i)}
	<section class="etb-blatt">
		<header class="etb-kopf">
			<div class="verband">
				<div class="verband-text">
					<span class="noe">Niederösterreichischer</span>
					<span class="lfv">LANDESFEUERWEHRVERBAND</span>
				</div>
				<img src="/bilder/noe-lfv.png" alt="" width="328" height="328" />
			</div>
			<dl class="angaben">
				<dt>Blatt-Nr.:</dt><dd class="kurz">{i + 1}</dd>
				<dt>Feuerwehr:</dt><dd>{zustand.kopf?.feuerwehr}</dd>
				<dt>Datum:</dt><dd>{dat(zustand.kopf?.datum ?? '')}</dd>
				<dt>Einsatzort:</dt><dd>{zustand.kopf?.einsatzort}</dd>
				<dt>Bearbeiter:</dt><dd>{zustand.kopf?.bearbeiter}</dd>
			</dl>
			<h1 class="titel">Einsatztagebuch</h1>
		</header>

		<table class="etb-tab">
			<colgroup>
				<col style:width="9.2mm" /><col style:width="14.8mm" /><col style:width="21.2mm" /><col style:width="21.2mm" />
				<col /><col style:width="14.8mm" /><col style:width="19mm" /><col style:width="16.9mm" />
			</colgroup>
			<thead>
				<tr><th>Lfd.<br />Nr.</th><th>Uhrzeit</th><th>An</th><th>Von</th><th>Inhalt</th><th>Auftrag<br />unter</th><th>Erledigung<br />unter</th><th>Kontrolle</th></tr>
			</thead>
			<tbody>
				{#each blatt as x (x.eid)}
					<tr class:gestrichen={x.gestrichen} style:height="{hoehe(x)}mm">
						<td class="nr">{x.nr}</td>
						<td class="wert mitte">{x.uhrzeit}</td>
						<td class="wert name">{x.an}</td>
						<td class="wert name">{x.von}</td>
						<td class="wert inhalt">{x.inhalt}{#if x.auftrag}<span class="auftrag"> (Auftrag)</span>{/if}</td>
						<td class="wert mitte">{nummerVon(zustand, x.auftragUnter) ?? ''}</td>
						<td class="wert mitte">{x.erledigungUnter ?? ''}</td>
						<td class="wert mitte">{x.kontrolle ? kuerzel(x.kontrolle) : ''}</td>
					</tr>
				{/each}
				{#each { length: leer(blatt) } as _, j (j)}
					<tr style:height="{ZEILE}mm"><td class="nr leer">{(blatt.length + j + 1) % 10}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
				{/each}
			</tbody>
		</table>
		{#if fuss}<p class="fuss">{fuss}</p>{/if}
	</section>
{/each}

<style>
	/* Querformat nur für diese Blätter, der Bericht bleibt hochkant */
	@page etb {
		size: A4 landscape;
		margin: 0;
	}
	.etb-blatt {
		--tinte: #10204a;
		page: etb;
		position: relative;
		box-sizing: border-box;
		width: 297mm;
		height: 210mm;
		padding: 8mm 9mm 0 6.7mm;
		overflow: hidden;
		background: #fff;
		color: #000;
		font-family: Arial, Helvetica, 'Liberation Sans', sans-serif;
		/* Jedes Blatt auf eine neue Seite, auch direkt nach den Seiten eines Berichts */
		break-before: page;
	}
	.etb-kopf {
		position: relative;
		height: 61mm;
	}
	.verband {
		display: flex;
		align-items: flex-start;
		gap: 3mm;
		margin-left: 2mm;
	}
	.verband-text {
		display: flex;
		flex-direction: column;
		margin-top: 3.5mm;
		padding-bottom: 1mm;
		border-bottom: 0.4mm solid #5b8fd6;
	}
	.noe {
		font-size: 10pt;
		font-weight: 700;
		font-style: italic;
	}
	.lfv {
		color: #555;
		font-size: 14pt;
		font-weight: 300;
		letter-spacing: 0.06em;
	}
	.verband img {
		width: 14mm;
		height: 14mm;
	}
	.titel {
		position: absolute;
		left: 4mm;
		top: 27mm;
		margin: 0;
		font-size: 34pt;
		font-weight: 800;
		letter-spacing: -0.01em;
	}
	.angaben {
		position: absolute;
		top: 0;
		left: 207mm;
		display: grid;
		grid-template-columns: 22mm 63mm;
		row-gap: 4.6mm;
		margin: 0;
		font-size: 12.5pt;
	}
	.angaben dt {
		margin: 0;
	}
	.angaben dd {
		margin: 0;
		padding: 0 1mm;
		border-bottom: 0.3mm solid #000;
		color: var(--tinte);
		font-weight: 700;
		font-size: 11pt;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.angaben dd.kurz {
		width: 17mm;
	}
	.etb-tab {
		width: 277.6mm;
		border-collapse: collapse;
		table-layout: fixed;
		font-size: 9pt;
	}
	.etb-tab th,
	.etb-tab td {
		border: 0.25mm solid #000;
		padding: 0.6mm 1.2mm;
		vertical-align: middle;
	}
	.etb-tab th {
		height: 11mm;
		font-size: 8.5pt;
		font-weight: 400;
		line-height: 1.15;
		text-align: center;
	}
	.nr {
		text-align: center;
		font-size: 9.5pt;
	}
	.nr.leer {
		color: #000;
	}
	.wert {
		color: var(--tinte);
		font-weight: 600;
		/* Erst an Leerzeichen umbrechen, mitten im Wort nur, wenn es gar nicht passt */
		overflow-wrap: break-word;
	}
	/* Funkrufnamen in den schmalen Spalten etwas kleiner, damit „Leopoldsdorf“ in eine Zeile passt */
	.name {
		font-size: 7.5pt;
		line-height: 1.2;
	}
	.mitte {
		text-align: center;
	}
	.inhalt {
		white-space: pre-wrap;
		line-height: 1.3;
	}
	.auftrag {
		font-weight: 400;
		font-style: italic;
	}
	.gestrichen .wert {
		text-decoration: line-through;
		text-decoration-thickness: 0.3mm;
	}
	.fuss {
		position: absolute;
		right: 9mm;
		bottom: 4mm;
		margin: 0;
		color: #555;
		font-size: 7pt;
	}
</style>
