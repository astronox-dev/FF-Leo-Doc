# FF-Leo Doc

**Feuerwehr Leopoldsdorf Dokumentation:** Einsatzberichte digital ausfüllen, unterschreiben und einreichen, dazu Atemschutzüberwachung und Einsatztagebuch für mehrere Geräte gleichzeitig.

## Bereiche

### Anmeldung und Berechtigungen
- Ohne Anmeldung ist nichts erreichbar. Konten legt ein Admin an, es gibt keine Selbstregistrierung.
- Zwei Berechtigungen: **Nutzer** (Berichte, Atemschutz) und **Admin** (zusätzlich Benutzer, Mannschaft, Einstellungen, eingereichte Berichte).
- Sitzungen laufen nie ab, damit im Einsatz niemand neu anmelden muss. Sie enden nur durch „Abmelden“, durch Sperren des Kontos oder durch ein neues Passwort.
- Neue Konten und zurückgesetzte Passwörter bekommen ein Einmal-Passwort. Beim ersten Anmelden muss ein eigenes gesetzt werden.

### Einsatzberichte
- Vier Aufnahmeblätter wie auf Papier (Stand April 2026), mit der Kopffarbe des Originals:
  - **Brandeinsatz** (rot)
  - **Technischer Einsatz** (blau)
  - **Schadstoffeinsatz** (grün)
  - **TUS-Brandeinsatz** (weiß)
- Alle Felder digital ausfüllbar; Ankreuzfelder erlauben immer Mehrfachauswahl.
- Teilnahmeliste aus der Mannschaft: Anwesend, Fahrzeug, Maschinist, ATS.
- **Skizze** (Brand, Technik, Schadstoff):
  - Kartenausschnitt auf basemap.at wählen, mit Adresssuche und Luftbild.
  - Gebäude, Straßen, Gewässer und Bahn werden aus OpenStreetMap als Strichzeichnung ins Skizzenfeld übernommen.
  - Darauf die taktischen Zeichen der Legende (ÖBFV RL E-27) per Drag-and-drop setzen, drehen und vergrößern; dazu Stift und Text.
- Vorschau, Drucken und PDF-Download im Layout des Originals. Zugeordnete Atemschutzprotokolle werden angehängt, weitere Geschädigte bekommen ein Sonderblatt.
- **Einreichen** mit Standesbuchnummer und Unterschrift von Ausfüllendem und Einsatzleiter. Danach ist der Bericht nicht mehr änderbar und nur noch für Admins im Archiv sichtbar. Ein Admin kann ihn bei Bedarf wieder öffnen.
- Alle Angemeldeten können offene Berichte bearbeiten. Es wird automatisch gespeichert, und gleichzeitige Änderungen von zwei Geräten werden erkannt.

### Atemschutzüberwachung
- Überwachung anlegen (Datum, Adresse, optional Einsatzstufe und Einsatzbericht). Die Standard-Trupps stehen danach bereit.
- Andere Geräte treten mit dem 6-stelligen Code bei. Alle Änderungen erscheinen sofort überall (Server-Sent Events).
- Status je Trupp:
  - Einsatzbereit (grün)
  - Im Einsatz (blau)
  - Zurück (rot)
  - Nicht einsatzbereit (orange)
- Zeitgrenze mit Vorwarnung und Alarm, Notfall-Knopf.
- Bei Funkloch arbeitet das Gerät weiter, Änderungen werden nachgeschickt.
- Protokoll mit CSV-Export und Druck. Zuordnung zu einem Einsatzbericht, dessen PDF das Protokoll dann enthält.

### Einsatztagebuch
- Tagebuch anlegen (Datum, Feuerwehr, Einsatzort, Bearbeiter, optional Einsatzbericht). Andere Geräte schreiben mit dem 6-stelligen Code mit, Einträge erscheinen sofort überall; bei Funkloch werden sie nachgeschickt.
- Eintrag mit Uhrzeit (läuft mit, bis man sie ändert), An, Von und Inhalt. Laufende Nummern richten sich nach der Reihenfolge am Server und sind auf allen Geräten gleich.
- Einträge können als **Auftrag** markiert werden. Wer die Erledigung einträgt, wählt den Auftrag aus; „Auftrag unter“ und „Erledigung unter“ füllen sich dann von selbst. Offene Aufträge stehen in einer eigenen Liste.
- Korrekturen wie auf Papier: Einträge werden durchgestrichen und bleiben sichtbar; Tippfehler lassen sich bis zum Abschluss ausbessern. Häkchen „Kontrolle“ mit dem Kürzel der Person.
- Druck und PDF im Layout des NÖ-LFV-Formulars (A4 quer, zehn Zeilen je Blatt). Einem Einsatzbericht zugeordnete Tagebücher werden an dessen PDF angehängt.

### Admin
- Benutzer
- Mannschaft (Teilnahmeliste, inklusive „Stand“), Import und Export als CSV
- Atemschutz-Einstellungen: Zeitgrenze, Vorwarnung, Standard-Trupps
- Eingereichte Berichte

## Technik

- SvelteKit 2 / Svelte 5, Tailwind 4, SQLite über libsql und Drizzle (wie die FF-Webseite)
- Berichte werden als JSON pro Bericht gespeichert; die Felder aller vier Blätter sind in `src/lib/berichte/typen.ts` beschrieben, die Legende in `src/lib/berichte/legende.ts`.
- Die Atemschutzüberwachung speichert jede Aktion als Ereignis. Browser und Server berechnen den Zustand daraus mit `src/lib/asue/kern.ts`.
- PDF: ein kopfloses Chromium (lokal Edge oder Chrome) druckt die Druckansicht, daher ist das PDF identisch mit der Vorschau.
- Karten: basemap.at (Kacheln), Nominatim (Adresssuche), Overpass-API (Gebäude und Straßen, © OpenStreetMap-Mitwirkende).

## Entwicklung

```
npm install
npm run dev
```

Läuft auf http://localhost:5240. Beim ersten Start wird das Konto `admin` angelegt. Das Passwort steht in `.env` (`ADMIN_PASSWORT`); ohne diesen Eintrag wird ein Einmal-Passwort ins Log geschrieben. Die Datenbank liegt in `data/` und wird nicht eingecheckt.

Datenbank-Änderungen: Schema in `src/lib/server/db/schema.ts` anpassen, dann `npm run db:generate`. Die Migrationen laufen beim Start automatisch.

## Betrieb (Docker / Portainer)

Jeder Push auf `main` baut über GitHub Actions das Image `ghcr.io/mstreicher98/ff-leo-doc:latest` (amd64 und arm64). Das Repository ist privat, das Image öffentlich: Es enthält keine personenbezogenen Daten. Die Mannschaftsliste liegt nur in der Datenbank und wird im Admin-Bereich importiert.

Am Server läuft die App als Portainer-Stack hinter einem Cloudflare Tunnel, ohne offene Ports. Die Anleitung steht oben in `portainer-stack.yml`:

1. Stack anlegen, Inhalt von `portainer-stack.yml` einfügen, `DOMAIN` (und beim ersten Start `ADMIN_PASSWORT`) setzen.
2. Im Cloudflare-Tunnel die Domain auf `<Server>:3001` (oder `app:3000` mit cloudflared im Stack) zeigen lassen.
3. Als Admin anmelden, unter Admin → Mannschaft die Teilnahmeliste importieren (CSV: `Stbnr;Nachname;Vorname;Gruppe`, Gruppe `aktiv` oder `reserve`). „Als Datei herunterladen“ liefert dasselbe Format zum Sichern.
4. Updates: Stack → „Update the stack“ mit „Re-pull image and redeploy“.

Keine Namen oder Standesbuchnummern in den Code schreiben: Alles im Repository landet im öffentlichen Image.

Lokal ohne Registry geht es mit `docker compose up -d --build` (baut aus dem Quellcode).

Wichtige Umgebungsvariablen:

| Variable | Zweck |
| --- | --- |
| `ORIGIN` | Öffentliche Adresse, z. B. `https://doc.ff-leopoldsdorf.net` |
| `ADMIN_PASSWORT` | Nur beim allerersten Start: Passwort für `admin` |
| `ADDRESS_HEADER` | Hinter Cloudflare Tunnel `CF-Connecting-IP` |
| `DATA_DIR` | Datenordner, im Container `/data` (Volume sichern!) |
| `CHROME_PATH` | Browser für PDFs, im Container schon gesetzt |

Das Image enthält Chromium und die Schrift Liberation Sans (Arial-kompatibel) für die PDFs.

Zugang verloren? In Portainer beim Container „Console“ öffnen (`/bin/sh`) und ein neues Einmal-Passwort setzen:

```
node scripts/zugang.mjs admin
```

Mit `docker compose` lokal: `docker exec -it ff-leo-doc node scripts/zugang.mjs admin`.
