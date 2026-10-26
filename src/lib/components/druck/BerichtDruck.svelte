<script lang="ts">
	import K from './K.svelte';
	import SkizzeSvg from '$lib/components/skizze/SkizzeSvg.svelte';
	import {
		ALARMIERUNG_DURCH, ANWESEND, BRANDSCHUTZ, GEFAHRENKLASSE, KM_ZUSATZ, LOESCHWASSER, MELDUNG_DURCH, SONDERGERAETE,
		STRAHLROHRE, TAETIGKEIT, TEILNAHME_FAHRZEUGE, TUS_OBJEKTE, TYPEN, WETTER, WLFK,
		type BerichtDaten, type BerichtTyp, type MitgliedKurz, type Zelle
	} from '$lib/berichte/typen';
	import type { AsueDruck } from '$lib/asue/druck';
	import type { Zustand as EtbZustand } from '$lib/etb/kern';
	import EtbDruck from './EtbDruck.svelte';
	import { datumAusIso } from '$lib/format';

	let {
		typ,
		daten: d,
		mannschaft,
		asue = [],
		etb = [],
		fuss = '',
		stand = ''
	}: {
		typ: BerichtTyp;
		daten: BerichtDaten;
		mannschaft: MitgliedKurz[];
		asue?: AsueDruck[];
		etb?: { code: string; zustand: EtbZustand }[];
		fuss?: string;
		stand?: string;
	} = $props();

	const T = $derived(TYPEN[typ]);
	const leer = (s: string | undefined | null) => !s || !s.trim();
	const dat = (iso: string) => (iso ? datumAusIso(iso) : '');
	const uhr = (ts: number) => {
		const x = new Date(ts);
		return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
	};

	const geschaedigteWeitere = $derived(d.geschaedigte.slice(1).filter((g) => Object.values(g).some((v) => !leer(v))));
	const aktiv = $derived(mannschaft.filter((m) => m.gruppe === 'aktiv'));
	const reserve = $derived(mannschaft.filter((m) => m.gruppe === 'reserve'));
	const LINKS = 50;
	const fahrzeugKurz = (w: string) => TEILNAHME_FAHRZEUGE.find((f) => f.wert === w)?.wert ?? w;
</script>

{#snippet kopf()}
	<div class="kopfzeile" style:background={T.farbe}><b>AUFNAHMEBLATT</b> für {T.titel}</div>
{/snippet}

{#snippet raster(zeilen: Zelle[][], gewaehlt: string[], extra?: Record<string, string>, spalten = 6, anhang?: import('svelte').Snippet)}
	<div class="raster" class:vier={spalten === 4}>
		{#each zeilen as zeile, i (i)}
			{#each zeile as zelle, j (j)}
				{#if zelle}
					<span style:grid-column="span {zelle[1]}"
						><K an={gewaehlt.includes(zelle[0])} text={zelle[0]} />{#if extra?.[zelle[0]] !== undefined}<span class="wert">: {extra[zelle[0]] || '..................'}</span>{/if}</span
					>
				{:else}
					<span></span>
				{/if}
			{/each}
		{/each}
		{@render anhang?.()}
	</div>
{/snippet}

{#snippet wert(text: string, min = '18mm')}
	<span class="feld" style:min-width={min}>{text}</span>
{/snippet}

{#snippet linien(text: string, zeilen: number, oben?: import('svelte').Snippet)}
	<div class="linienbereich" style:--zeilen={zeilen}>
		{@render oben?.()}
		<div class="linien">{text}</div>
	</div>
{/snippet}

<!-- ============================================================ Seite 1 -->
<section class="seite">
	<div class="blatt">
		{@render kopf()}

		<div class="z alarm">
			<div class="l">Alarmierung:</div>
			<div class="zelle">Datum: {@render wert(dat(d.alarmierung.datum))} Zeit: {@render wert(d.alarmierung.zeit, '12mm')}</div>
			<div class="l rahmen-l">Ausfahrt:</div>
			<div class="zelle">Datum: {@render wert(dat(d.ausfahrt.datum))} Zeit: {@render wert(d.ausfahrt.zeit, '12mm')}</div>
		</div>
		<div class="z oben"><div class="l">Alarmierung durch:</div>{@render raster(ALARMIERUNG_DURCH(typ), d.alarmierungDurch, typ === 'brand' ? { TUS: d.tusText } : undefined)}</div>
		<div class="z oben"><div class="l">Meldung durch:</div>{@render raster(MELDUNG_DURCH, d.meldungDurch)}</div>
		<div class="z oben"><div class="l">Anwesend:</div>{@render raster(ANWESEND, d.anwesend)}</div>
		<div class="z oben"><div class="l">Wetter:</div>{@render raster(WETTER, d.wetter)}</div>
		<div class="z ort">
			<div class="l">Einsatzort:</div>
			<div class="zelle klein-oben"><span class="mini">Ort; Straße; Hausnummer / KM</span><span class="wert gross">{d.einsatzort}</span></div>
			<div class="zelle rahmen-l gebiet">
				<span class="mini-n">Eigenes Einsatzgebiet</span>
				<span><K an={d.eigenesGebiet.includes('Ja')} text="Ja" /> <K an={d.eigenesGebiet.includes('Nein')} text="Nein" /></span>
			</div>
		</div>

		{#if typ === 'tus'}
			<div class="z oben"><div class="l">Geschädigter:</div>{@render raster(TUS_OBJEKTE, d.tusObjekte)}</div>
		{:else}
			{@const g = d.geschaedigte[0]}
			<div class="z geschaedigt">
				<div class="l">Geschädigter 1:</div>
				<div class="zelle">
					<div class="mini">(Sonderblatt für weitere Geschädigte)</div>
					<div class="g-zeile">Vorname, Zunamme: <span class="mini">(Zulassungsschein)</span> <span class="unterstrich">{g.name}</span></div>
					<div class="g-zeile">Anschrift: <span class="mini">(Zulassungsschein)</span> <span class="unterstrich">{g.anschrift}</span></div>
					<div class="g-zeile">Kfz-Kennzeichen: <span class="unterstrich">{g.kennzeichen}</span> Marke / Type: <span class="unterstrich">{g.marke}</span></div>
					<div class="g-zeile">Name Fahrer: <span class="unterstrich">{g.fahrer}</span> Geb. Datum: <span class="unterstrich kurz">{g.gebDatum}</span></div>
					<div class="g-zeile">Anschrift Fahrer: <span class="unterstrich">{g.fahrerAnschrift}</span></div>
				</div>
				<div class="anz">Anz. Geschädigte: <span class="wert">{d.anzGeschaedigte}</span></div>
			</div>
		{/if}

		<div class="z breit-l">
			<div class="l">Eingesetzte Geräte:</div>
			<div class="zelle rahmen-l">
				{#snippet wbk()}{#if typ === 'tus'}<div class="vor"><K an={d.wbk} text="WBK" /></div>{/if}{/snippet}
				{@render linien(d.geraete, typ === 'tus' ? 3 : 5, wbk)}
			</div>
		</div>
		{#if typ !== 'tus'}
			<div class="z breit-l">
				<div class="l">Sondergeräte:</div>
				<div class="zelle rahmen-l">
					{#snippet schutzstufe()}
						{#if typ === 'brand'}
							<span style:grid-column="span 2">Schutzstufe: {#each ['1', '2', '3'] as s (s)}<K an={d.schutzstufe.includes(s)} text={s} />{' '}{/each}</span>
						{/if}
					{/snippet}
					{@render raster(SONDERGERAETE[typ], d.sondergeraete, typ === 'schadstoff' ? { Auffangwannen: d.auffangwannenLiter ? `${d.auffangwannenLiter} Liter` : '' } : undefined, 4, schutzstufe)}
				</div>
			</div>
		{/if}
		<div class="z breit-l">
			<div class="l">Fremde Feuerwehren:<span class="mini-l">Hilfebericht Anfordern!<br />Mannschaftsstärke (MS) , Dauer (D)</span></div>
			<div class="zelle rahmen-l">
				<div class="ff">
					<span><K an={d.fremdeFF.mariaLanzendorf.an} text="FF Maria-Lanzendorf:" /> <span class="wert">{d.fremdeFF.mariaLanzendorf.ms}</span> (MS) <span class="wert">{d.fremdeFF.mariaLanzendorf.d}</span> (D)</span>
					<span><K an={d.fremdeFF.lanzendorf.an} text="FF Lanzendorf:" /> <span class="wert">{d.fremdeFF.lanzendorf.ms}</span> (MS) <span class="wert">{d.fremdeFF.lanzendorf.d}</span> (D)</span>
				</div>
				{@render linien(d.fremdeFF.text, 1)}
			</div>
		</div>
		<div class="z breit-l">
			<div class="l">Verletzte Personen:<span class="mini-l">Zivil (Z); FF (F)<br />Name; Feuerwehr</span></div>
			<div class="zelle rahmen-l">{@render linien(d.verletzte, 2)}</div>
		</div>
		<div class="z breit-l">
			<div class="l">Verbrauchsmaterialien:{#if typ !== 'tus'}<span class="mini-l">Mengenangabe (zb. Ölbindem. Kanister -<br />gelb 6kg / blau 12kg)</span>{/if}</div>
			<div class="zelle rahmen-l">
				{#if typ !== 'tus'}
					<div class="ff">
						<span><K an={d.verbrauch.schaummittel} text="Schaummittel:" /> <span class="wert">{d.verbrauch.schaummittelMenge}</span> Liter / Kanister</span>
						<span><K an={d.verbrauch.oelbindemittel} text="Ölbindemittel:" /> <span class="wert">{d.verbrauch.oelbindemittelMenge}</span> kg / Kanister</span>
					</div>
				{/if}
				{@render linien(d.verbrauch.text, typ === 'tus' ? 1 : 2)}
			</div>
		</div>
		<div class="z breit-l">
			<div class="l">Löschwasserversorgung:</div>
			<div class="zelle rahmen-l lw">{#each LOESCHWASSER as o (o)}<K an={d.loeschwasser.includes(o)} text={o} />{/each}</div>
		</div>
		<div class="z breit-l" class:wachsen={typ !== 'tus'}>
			<div class="l mitte">Situation bei der Ankunft:<span class="mini-l">kurze Beschreibung der Situation</span></div>
			<div class="zelle rahmen-l">
				{#snippet melder()}{#if typ === 'tus'}<div class="vor">TUS- Brandmeldealarm ; Melder <span class="wert">{d.melder[0] || '.....'}</span> / <span class="wert">{d.melder[1] || '.....'}</span></div>{/if}{/snippet}
				{@render linien(d.situation, typ === 'tus' ? 4 : 16, melder)}
			</div>
		</div>
		{#if typ === 'tus'}{@render seiteZwei()}{/if}
	</div>
	{#if fuss}<p class="fuss">{fuss}</p>{/if}
</section>

<!-- ============================================================ Seite 2 (beim TUS-Blatt auf Seite 1) -->
{#snippet seiteZwei()}
	<div class="z breit-l wachsen">
		<div class="l mitte">Tätigkeit am Einsatzort:{#if typ !== 'tus'}<span class="mini-l">kurze Beschreibung der Tätigkeit</span>{/if}</div>
		<div class="zelle rahmen-l">
			{#snippet checks()}
				<div class="vor taetigkeit">
					{#if typ === 'tus'}
						<div>Aufsuchen des ausgelösten Melders ; Kontrolle des Bereichs mittels WBK</div>
						<div class="zwei"><span>Bandmeldeanlage zurückgestellt</span><K an={d.taetigkeitChecks.includes('Keine Gefahr feststellbar')} text="Keine Gefahr feststellbar" /></div>
						<div class="zwei">
							<span>{#each ['Brandalarm', 'Fehlalarm', 'Täuschungsalarm'] as o (o)}<K an={d.taetigkeitChecks.includes(o)} text={o} />{' '}{/each}</span>
							<K an={d.taetigkeitChecks.includes('BSB verständigt')} text="BSB verständigt" />
						</div>
						<div class="zwei"><span></span><K an={d.taetigkeitChecks.includes('BSB vor Ort')} text="BSB vor Ort" /></div>
					{:else}
						{#each TAETIGKEIT[typ] as o (o)}<K an={d.taetigkeitChecks.includes(o)} text={o} />{' '}
							{#if typ === 'technik' && o === 'Absichern der Einsatzstelle'}
								<span>Brandschutz: {#each BRANDSCHUTZ as b (b)}<K an={d.brandschutz.includes(b)} text={b} />{' '}{/each}</span>
							{/if}
						{/each}
					{/if}
				</div>
			{/snippet}
			{@render linien(d.taetigkeit, typ === 'tus' ? 5 : typ === 'brand' ? 34 : 20, checks)}
		</div>
	</div>
	{#if typ === 'technik'}
		<div class="z breit-l">
			<div class="l">Tätigkeiten WLF-K:</div>
			<div class="zelle rahmen-l">
				{#snippet wlf()}<div class="vor">{#each WLFK as o (o)}<K an={d.wlfk.includes(o)} text={o} />{' '}{/each}</div>{/snippet}
				{@render linien(d.wlfkText, 3, wlf)}
			</div>
		</div>
	{/if}
	{#if typ === 'schadstoff'}
		<div class="z breit-l">
			<div class="l">Gefahrenklasse</div>
			<div class="zelle rahmen-l">{@render raster(GEFAHRENKLASSE, d.gefahrenklasse)}</div>
		</div>
	{/if}
	{#if typ === 'brand' || typ === 'schadstoff'}
		<div class="z brandwache">
			<div class="l">Brandwache:</div>
			<div class="zelle">Datum: {@render wert(dat(d.brandwache.datum))}</div>
			<div class="zelle zeit2">Zeit: <span>von {@render wert(d.brandwache.von, '11mm')}<br />bis {@render wert(d.brandwache.bis, '11mm')}</span></div>
			<div class="l rahmen-l fav">Anzahl der Strahlrohre (FAV):</div>
			<div class="zelle rahmen-l rohre">{#each STRAHLROHRE as o (o)}<K an={d.strahlrohre.includes(o)} text={o} />{/each}</div>
		</div>
	{/if}
	<div class="z alarm">
		<div class="l">{typ === 'technik' ? 'Rückkehr:' : 'Brand Aus:'}</div>
		{#if typ === 'technik'}
			<div class="zelle">Datum: {@render wert(dat(d.rueckkehr.datum))} Zeit: {@render wert(d.rueckkehr.zeit, '12mm')}</div>
			<div class="l rahmen-l"></div><div class="zelle"></div>
		{:else}
			<div class="zelle">Datum: {@render wert(dat(d.brandAus.datum))} Zeit: {@render wert(d.brandAus.zeit, '12mm')}</div>
			<div class="l rahmen-l">Rückkehr:</div>
			<div class="zelle">Datum: {@render wert(dat(d.rueckkehr.datum))} Zeit: {@render wert(d.rueckkehr.zeit, '12mm')}</div>
		{/if}
	</div>
	<div class="z km">
		<div class="l mitte">Gefahrene Kilometer:</div>
		<div class="km-raster">
			<div>HLF-3<br />(Tank 1) {@render wert(d.km.hlf3 ?? '', '8mm')}</div>
			<div>HLF-2<br />(Tank 2) {@render wert(d.km.hlf2 ?? '', '8mm')}</div>
			<div>HLF-1<br />(Pumpe) {@render wert(d.km.hlf1 ?? '', '8mm')}</div>
			<div>VF<br />(Last) {@render wert(d.km.vf ?? '', '8mm')}</div>
			<div class="spalte5">WLF-K (Kran) {@render wert(d.km.wlfk ?? '', '8mm')}<br /><K an={d.kmZusatz.includes('WLA-Bergung')} text="WLA-Bergung" /><br /><K an={d.kmZusatz.includes('WLA-Mulde (leer)')} text="WLA-Mulde (leer)" /></div>
			<div>Kommando 1<br />(KDO 1) {@render wert(d.km.kdo1 ?? '', '8mm')}</div>
			<div>Kommando 2<br />(KDO 2) {@render wert(d.km.kdo2 ?? '', '8mm')}</div>
			<div>MTF<br />(BUS) {@render wert(d.km.mtf ?? '', '8mm')}</div>
			<div><K an={d.kmZusatz.includes('Abschleppachse')} text="Abschlepp-" /><br />&nbsp;&nbsp;&nbsp;achse</div>
			<div class="spalte5">Boot {@render wert(d.km.boot ?? '', '8mm')}</div>
		</div>
	</div>
	<div class="z breit-l">
		<div class="l mitte">Einsatzmängel / Anmerkungen:</div>
		<div class="zelle rahmen-l">{@render linien(d.maengel, 2)}</div>
	</div>
	<div class="z unterschrift">
		<div class="l">Einsatzleiter:</div>
		<div class="zelle">
			<span class="wert">{d.unterschriften.einsatzleiter.name || '..................'}</span>
			{#if d.unterschriften.einsatzleiter.stbnr}<span class="mini">Stbnr. {d.unterschriften.einsatzleiter.stbnr}</span>{/if}
		</div>
		<div class="zelle rahmen-l sig">{#if d.unterschriften.einsatzleiter.bild}<img src={d.unterschriften.einsatzleiter.bild} alt="Unterschrift Einsatzleiter" />{/if}</div>
		<div class="l rahmen-l">Ausfüllender:</div>
		<div class="zelle">
			<span class="wert">{d.unterschriften.ausfuellender.name || '..................'}</span>
			{#if d.unterschriften.ausfuellender.stbnr}<span class="mini">Stbnr. {d.unterschriften.ausfuellender.stbnr}</span>{/if}
		</div>
		<div class="zelle rahmen-l sig">{#if d.unterschriften.ausfuellender.bild}<img src={d.unterschriften.ausfuellender.bild} alt="Unterschrift Ausfüllender" />{/if}</div>
	</div>
{/snippet}

<!-- Das TUS-Blatt ist einseitig, die anderen haben Seite 2 und die Skizze -->
{#if typ !== 'tus'}
	<section class="seite">
		<div class="blatt">
			{@render kopf()}
			{@render seiteZwei()}
		</div>
		{#if fuss}<p class="fuss">{fuss}</p>{/if}
	</section>

	<!-- ============================================================ Skizze -->
	<section class="seite">
		<div class="blatt skizze-blatt">
			<div class="kopfzeile" style:background={T.farbe}>SKIZZE</div>
			<div class="skizze"><SkizzeSvg skizze={d.skizze} modus="druck" /></div>
		</div>
		{#if fuss}<p class="fuss">{fuss}</p>{/if}
	</section>
{/if}

<!-- ============================================================ Teilnahme -->
{#snippet tabelle(liste: MitgliedKurz[], zeilenMin: number, fussnoten: boolean)}
	<table class="teilnahme">
		<thead>
			<tr><th>Stbnr.</th><th>Nachname</th><th>Vorname</th><th>Anw.</th><th>Fahrzeug{fussnoten ? ' 1)' : ''}</th><th>MA</th><th>ATS{fussnoten ? ' 2)' : ''}</th></tr>
		</thead>
		<tbody>
			{#each liste as m (m.stbnr)}
				{@const t = d.teilnahme[m.stbnr]}
				<tr>
					<td class="r">{m.stbnr}</td><td>{m.nachname}</td><td>{m.vorname}</td>
					<td class="c wert">{t?.anw ? 'X' : ''}</td><td class="c wert">{t?.fahrzeug ? fahrzeugKurz(t.fahrzeug) : ''}</td>
					<td class="c wert">{t?.ma ? 'X' : ''}</td><td class="c wert">{t?.ats ? 'X' : ''}</td>
				</tr>
			{/each}
			{#each Array(Math.max(0, zeilenMin - liste.length)) as _, i (i)}
				<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<section class="seite">
	<div class="teilnahme-seite">
		<h2 class="t-titel">TEILNAHME Einsatz {#if stand}<small>Stand: {stand}</small>{/if}</h2>
		<div class="t-spalten">
			<div>
				<h3>AKTIVE MANNSCHAFT</h3>
				{@render tabelle(aktiv.slice(0, LINKS), 0, true)}
			</div>
			<div>
				<div class="h3-platz" aria-hidden="true">&nbsp;</div>
				{@render tabelle(aktiv.slice(LINKS), 28, true)}
				<h3 class="reserve">RESERVE MANNSCHAFT</h3>
				{@render tabelle(reserve, 0, false)}
				<p class="fussnote">1) HLF-3/Tank1, HLF-2/TLF2000/Tank2, HLF1/Pumpe, VF/Last, KDO, MTF/Bus, WLF-K/Kran, Abschleppachse</p>
				<p class="fussnote">2) ATS nur eintragen, wenn ATS im Einsatz tatsächlich angelegt wurde (nur Kurzüberprüf. nicht eintragen)</p>
			</div>
		</div>
	</div>
	{#if fuss}<p class="fuss">{fuss}</p>{/if}
</section>

<!-- ============================================================ Sonderblatt Geschädigte -->
{#if geschaedigteWeitere.length}
	<section class="seite">
		<div class="blatt">
			<div class="kopfzeile" style:background={T.farbe}><b>SONDERBLATT</b> weitere Geschädigte</div>
			{#each geschaedigteWeitere as g, i (i)}
				<div class="z geschaedigt">
					<div class="l">Geschädigter {i + 2}:</div>
					<div class="zelle">
						<div class="g-zeile">Vorname, Zunamme: <span class="mini">(Zulassungsschein)</span> <span class="unterstrich">{g.name}</span></div>
						<div class="g-zeile">Anschrift: <span class="mini">(Zulassungsschein)</span> <span class="unterstrich">{g.anschrift}</span></div>
						<div class="g-zeile">Kfz-Kennzeichen: <span class="unterstrich">{g.kennzeichen}</span> Marke / Type: <span class="unterstrich">{g.marke}</span></div>
						<div class="g-zeile">Name Fahrer: <span class="unterstrich">{g.fahrer}</span> Geb. Datum: <span class="unterstrich kurz">{g.gebDatum}</span></div>
						<div class="g-zeile">Anschrift Fahrer: <span class="unterstrich">{g.fahrerAnschrift}</span></div>
					</div>
				</div>
			{/each}
		</div>
		{#if fuss}<p class="fuss">{fuss}</p>{/if}
	</section>
{/if}

<!-- ============================================================ Atemschutzüberwachung -->
{#each asue as a (a.code)}
	<section class="seite">
		<div class="blatt asue">
			<div class="kopfzeile" style:background={T.farbe}><b>ATEMSCHUTZÜBERWACHUNG</b> Code {a.code.slice(0, 3)}-{a.code.slice(3)}</div>
			<div class="asue-kopf">
				<span>Datum: <span class="wert">{dat(a.datum)}</span></span>
				<span>Adresse: <span class="wert">{a.adresse}</span></span>
				<span>Einsatzstufe: <span class="wert">{a.stufe || '–'}</span></span>
				<span>Atemschutzüberwacher: <span class="wert">{a.ueberwacher || '–'}</span></span>
			</div>
			<h3 class="asue-titel">Atemschutzeinsätze</h3>
			<table class="asue-tab">
				<thead><tr><th>Trupp</th><th>Beginn</th><th>Ende</th><th>Dauer</th></tr></thead>
				<tbody>
					{#each a.einsaetze as e, i (i)}
						<tr><td>{e.trupp}</td><td class="wert">{uhr(e.start)}</td><td class="wert">{e.ende ? uhr(e.ende) : 'läuft'}</td><td class="wert">{e.dauer}</td></tr>
					{:else}
						<tr><td colspan="4">Kein Trupp war unter Atemschutz.</td></tr>
					{/each}
				</tbody>
			</table>
			<h3 class="asue-titel">Protokoll</h3>
			<table class="asue-tab">
				<thead><tr><th>Uhrzeit</th><th>Trupp</th><th>Ereignis</th></tr></thead>
				<tbody>
					{#each a.log as l, i (i)}
						<tr><td class="wert">{uhr(l.t)}</td><td>{l.trupp}</td><td>{l.text}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if fuss}<p class="fuss">{fuss}</p>{/if}
	</section>
{/each}

<!-- ============================================================ Einsatztagebuch (Querformat) -->
{#each etb as t (t.code)}
	<EtbDruck zustand={t.zustand} {fuss} />
{/each}

<style>
	/* A4 wie das Papierblatt; Werte in Kugelschreiber-Blau */
	.seite {
		--tinte: #10204a;
		--strich: 0.6pt solid #000;
		position: relative;
		box-sizing: border-box;
		width: 210mm;
		min-height: 296.5mm;
		padding: 7mm 9mm 9mm;
		display: flex;
		flex-direction: column;
		background: #fff;
		color: #000;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 9.6pt;
		line-height: 1.25;
	}
	/* Umbruch nur zwischen den Seiten, sonst hängt am Ende ein leeres Blatt */
	.seite + .seite {
		break-before: page;
	}
	.blatt {
		flex: 1;
		display: flex;
		flex-direction: column;
		border: var(--strich);
	}
	.kopfzeile {
		padding: 0.6mm 2mm;
		text-align: center;
		font-size: 11.5pt;
		border-bottom: var(--strich);
	}
	.z {
		display: grid;
		grid-template-columns: 17.5% 1fr;
		border-bottom: var(--strich);
	}
	.z:last-child {
		border-bottom: 0;
	}
	.l {
		padding: 0.8mm 1.2mm;
		font-weight: 700;
		font-size: 9.8pt;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.l.mitte {
		justify-content: center;
	}
	.zelle {
		padding: 0.8mm 1.2mm;
		min-width: 0;
	}
	.rahmen-l {
		border-left: var(--strich);
	}
	.wert {
		color: var(--tinte);
		font-weight: 600;
	}
	.feld {
		display: inline-block;
		color: var(--tinte);
		font-weight: 600;
		border-bottom: 0.6pt dotted #000;
		padding: 0 0.5mm;
		margin-right: 1.5mm;
		text-align: center;
	}
	.mini {
		font-size: 6.6pt;
		font-weight: 400;
	}
	.mini-l {
		font-size: 6.6pt;
		font-weight: 400;
		margin-top: 0.4mm;
	}
	.mini-n {
		font-size: 8pt;
	}

	.alarm {
		grid-template-columns: 17.5% 34% 13.5% 1fr;
		align-items: center;
	}
	.oben .raster {
		padding: 0.6mm 1mm;
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(5, 1fr) 1.45fr;
		row-gap: 0.4mm;
		column-gap: 1mm;
	}
	.raster.vier {
		grid-template-columns: repeat(4, 1fr);
		padding: 0.4mm 0;
	}
	.raster > span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: clip;
	}

	.ort {
		grid-template-columns: 17.5% 1fr 20%;
		min-height: 10mm;
	}
	.klein-oben {
		display: flex;
		flex-direction: column;
	}
	.gross {
		font-size: 10.5pt;
		padding-top: 0.5mm;
	}
	.gebiet {
		display: flex;
		flex-direction: column;
		gap: 0.5mm;
	}

	.geschaedigt {
		grid-template-columns: 17.5% 1fr;
		position: relative;
	}
	.g-zeile {
		display: flex;
		align-items: baseline;
		gap: 1mm;
		margin-top: 0.8mm;
		white-space: nowrap;
	}
	.unterstrich {
		flex: 1;
		min-width: 10mm;
		color: var(--tinte);
		font-weight: 600;
		border-bottom: 0.5pt dashed #444;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.unterstrich.kurz {
		flex: 0 0 22mm;
	}
	.anz {
		position: absolute;
		top: 0;
		right: 0;
		width: 20%;
		padding: 0.8mm 1.2mm;
		border-left: var(--strich);
		border-bottom: var(--strich);
		font-size: 8.5pt;
	}

	.breit-l {
		grid-template-columns: 30% 1fr;
	}
	.wachsen {
		flex: 1;
	}
	.breit-l > .zelle {
		display: flex;
		flex-direction: column;
	}
	.linienbereich {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.vor {
		padding: 0.3mm 1mm 0.6mm;
	}
	.linien {
		--zeile: 5.05mm;
		flex: 1;
		min-height: calc(var(--zeilen) * var(--zeile));
		padding: 0 2mm;
		line-height: var(--zeile);
		color: var(--tinte);
		font-weight: 600;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='19.1'%3E%3Cline x1='0' y1='18.6' x2='3.4' y2='18.6' stroke='%23555' stroke-width='0.7'/%3E%3C/svg%3E");
		background-size: 1.6mm var(--zeile);
		background-repeat: repeat;
		background-origin: content-box;
		background-clip: content-box;
	}
	.ff {
		display: flex;
		flex-wrap: wrap;
		gap: 1mm 6mm;
		padding: 0.4mm 1mm;
	}
	.breit-l > .zelle.lw {
		flex-direction: row;
		gap: 7mm;
		align-items: center;
	}
	.taetigkeit {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6mm 5mm;
	}
	.taetigkeit .zwei {
		width: 100%;
		display: grid;
		grid-template-columns: 1fr 34%;
	}

	.brandwache {
		grid-template-columns: 17.5% 19% 14% 21% 1fr;
		align-items: center;
	}
	.zeit2 {
		display: flex;
		gap: 1.5mm;
		align-items: center;
	}
	.fav {
		font-size: 9pt;
	}
	.rohre {
		display: flex;
		flex-direction: column;
		font-size: 7.5pt;
	}

	.km {
		grid-template-columns: 30% 1fr;
	}
	.km-raster {
		display: grid;
		grid-template-columns: repeat(4, 1fr) 1.35fr;
		border-left: var(--strich);
	}
	.km-raster > div {
		padding: 0.7mm 1mm;
		border-right: var(--strich);
		border-bottom: var(--strich);
		font-size: 9pt;
	}
	.km-raster > div:nth-child(5n) {
		border-right: 0;
	}
	.km-raster > div:nth-child(n + 6) {
		border-bottom: 0;
	}

	.unterschrift {
		grid-template-columns: 17.5% 15% 1fr 14.5% 15% 1fr;
		align-items: stretch;
		min-height: 12mm;
	}
	.unterschrift .zelle {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.sig {
		padding: 0.5mm;
	}
	.sig img {
		max-height: 11mm;
		width: 100%;
		object-fit: contain;
	}

	.skizze-blatt {
		padding: 0;
	}
	.skizze {
		flex: 1;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 4mm 5mm 5mm;
	}
	.skizze :global(svg) {
		width: auto !important;
		height: 100% !important;
		max-height: 266mm;
		max-width: 100%;
	}

	.teilnahme-seite {
		flex: 1;
		padding: 0 1mm;
	}
	.t-titel {
		margin: 6mm 0 3mm;
		text-align: center;
		font-size: 15pt;
		font-weight: 700;
	}
	.t-titel small {
		font-size: 7.5pt;
	}
	.t-spalten {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3mm;
		align-items: start;
	}
	h3 {
		margin: 0 0 0.6mm;
		font-size: 9.5pt;
		font-weight: 700;
	}
	.h3-platz {
		margin: 0 0 0.6mm;
		font-size: 9.5pt;
	}
	h3.reserve {
		margin-top: 4mm;
	}
	.teilnahme {
		width: 100%;
		border-collapse: collapse;
		font-size: 7.6pt;
		table-layout: fixed;
	}
	.teilnahme th,
	.teilnahme td {
		border: 0.5pt solid #000;
		padding: 0.15mm 0.8mm;
		height: 3.85mm;
		white-space: nowrap;
		overflow: hidden;
	}
	.teilnahme th {
		font-weight: 400;
		font-size: 6.6pt;
	}
	.teilnahme th:nth-child(1) { width: 9%; }
	.teilnahme th:nth-child(2) { width: 27%; }
	.teilnahme th:nth-child(3) { width: 22%; }
	.teilnahme th:nth-child(4) { width: 9%; }
	.teilnahme th:nth-child(5) { width: 15%; }
	.teilnahme th:nth-child(6) { width: 7%; }
	.teilnahme th:nth-child(7) { width: 11%; }
	.teilnahme .r {
		text-align: right;
	}
	.teilnahme .c {
		text-align: center;
	}
	.fussnote {
		margin: 3mm 0 0;
		font-size: 7.6pt;
	}

	.asue-kopf {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1mm 4mm;
		padding: 2mm;
		border-bottom: var(--strich);
	}
	.asue-titel {
		margin: 3mm 2mm 1mm;
	}
	.asue-tab {
		margin: 0 2mm 2mm;
		width: calc(100% - 4mm);
		border-collapse: collapse;
		font-size: 8.5pt;
	}
	.asue-tab th,
	.asue-tab td {
		border: 0.5pt solid #000;
		padding: 0.6mm 1.2mm;
		text-align: left;
	}

	.fuss {
		position: absolute;
		bottom: 3mm;
		left: 9mm;
		right: 9mm;
		margin: 0;
		font-size: 6.5pt;
		color: #555;
	}
</style>
