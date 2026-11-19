# Chronothek ⌚

Ein Sammelspiel für Uhren im Stil von Apple-Webseiten um 2010: glänzende Leisten, Aqua-Knöpfe, Produktbilder mit Spiegelung und eine Uhrenbox aus Leder.
Du startest mit **3.000 € Spielgeld** und baust dir eine Sammlung auf, von der Casio F-91W bis zur Patek Philippe Nautilus.
Alles läuft im Browser und offline (PWA). Der Spielstand liegt nur auf deinem Gerät.

> **Nur ein Spiel:** Alle Beträge sind Spielgeld. Uhrennamen und Referenzen dienen nur zur Beschreibung. Es gibt keine Verbindung zu den Herstellern oder zu echten Händlern, und es werden keine Logos verwendet. Die Uhrenbilder werden im Spiel selbst gezeichnet. Die Startpreise sind **grobe Schätzungen** für den Gebrauchtmarkt und ändern sich im Spiel zufällig.

## Seiten (wie eine Händler-Webseite)
| Seite | Was du dort machst |
|---|---|
| **Start** | Kontostand, Sammlungswert, Stufe, Tagesbonus, Nebenjob, neue Angebote, Marktbewegungen, Uhren-News |
| **Marktplatz** | Angebote mit Filtern (Marke, Kategorie, Preis, Zustand, Box & Papiere), Sortierung, Suche. Grünes Schild = unter Marktwert |
| **Angebot** | Großes Produktbild, Daten, Händler, Echtheitsprüfung, **Kaufen** (Kasse) oder **Preisvorschlag** (Annahme, Gegenangebot oder Absage) |
| **Modell** | Marktwert-Verlauf (7 / 30 / 90 Tage), alle aktuellen Angebote des Modells |
| **Auktionen** | 4 Live-Auktionen mit Countdown, andere Bieter, 5 % Aufgeld, Verlängerung bei späten Geboten |
| **Sammlung** | Uhrenbox, Depot-Übersicht mit Gewinn/Verlust; pro Uhr: inserieren, sofort an Händler verkaufen (80 %), Revision |
| **Merkliste** | Gemerkte Modelle mit Preisänderung und Angebotszahl, dazu eine Tabelle aller Modelle |
| **Bot** | Trading-Bot an/aus, Strategie (Vorsichtig / Ausgewogen / Riskant), Budget, Positionen, Protokoll |
| **Profil** | Name, Statistik, Erfolge mit Geld-Belohnung, Spielstand löschen |

## Regeln
- Alle **30 Sekunden** beginnt ein neuer Markttag. Dann ändern sich die Preise und neue Angebote kommen dazu. Deine Inserate können verkauft werden.
  - Ist die App zu, laufen bis zu 40 Markttage nach.
- **Wert einer Uhr** = Marktwert × Zustand (Ungetragen 108 %, Sehr gut 100 %, Gut 90 %, Getragen 80 %, Revisionsbedürftig 62 %) × 88 %, wenn Box & Papiere fehlen.
- **Revision**: kostet etwa 6 % vom Marktwert und dauert 2 Tage. Danach ist die Uhr „Sehr gut“.
- **Verkaufen**:
  - Inserieren: 6 % Gebühr. Je höher der Preis, desto kleiner die Chance pro Tag.
  - Sofortverkauf an einen Händler: 80 % vom Wert.
- **News** wie Preiserhöhungen, Hype oder Zinsen verändern die Preise einzelner Modelle, Marken oder des ganzen Markts.
- **Stufen** nach Sammlungswert: Einsteiger → Sammler (5.000 €) → Kenner (25.000 €) → Connaisseur (100.000 €) → Grand Collector (500.000 €) → Legende (2 Mio. €).

## Trading-Bot
- Der Bot ist **gratis**, behält aber **20 % von jedem Gewinn**. Bei Verlust zahlst du nichts extra. Die 6 % Marktplatz-Gebühr fallen trotzdem an.
- Jeden Markttag kauft er bis zu 2 Schnäppchen unter Marktwert, je nach Strategie. Er inseriert sie mit Aufschlag und senkt den Preis, wenn sie nicht weggehen.
  - Getragene Uhren lässt er vorher revidieren.
- Er steckt höchstens das eingestellte **Budget** gleichzeitig in Uhren. Deine eigenen Uhren fasst er nie an.
  - Bot-Uhren tragen in der Uhrenbox das Schild „Bot“.
  - Mit „Vom Bot übernehmen“ holst du dir eine davon in deine Sammlung.
- Er handelt auch, während die App zu ist (bis zu 40 Markttage).

## Uhren & Daten
44 Modelle von 25 Marken stehen in `MODELS` in `app.js`: Name, Referenz, Startpreis, Kategorie, Durchmesser, Material und Aussehen (Form, Zifferblatt, Lünette, Band).
Neue Modelle trägst du einfach dort ein. Alte Spielstände bekommen sie automatisch dazu.

## Dateien
- `index.html` – Seitengerüst mit Navigation und Fußzeile
- `style.css` – das Design im Stil von 2010
- `app.js` – Daten, Markt, Auktionen, Uhren-Grafik (SVG), Seiten
- `sw.js` – Offline-Cache (`CACHE_VERSION` bei Änderungen hochzählen)
- `manifest.json`, `icons/` – App für den Home-Bildschirm

Das frühere Spiel MetroRush ist gelöscht, bleibt aber in der Git-Historie erhalten.
