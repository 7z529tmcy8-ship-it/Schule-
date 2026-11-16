---
name: heft-metro-design
description: UI- und Design-System für „Heft-Metro“ (das Spiel in diesem Repository) – Schulheft-Look mit Karopapier, Filzstift-Linien, gekritzelten Formen und Zettel-UI, nur für iPad. Nutzen, bevor du im Spiel etwas gestaltest, eine neue UI-Komponente, einen Bildschirm, ein Icon oder eine Spielgrafik baust, und vor jeder Abgabe zum Prüfen.
---

# Heft-Metro – UI & Design

Das Spiel sieht aus, als hätte jemand ein Verkehrsnetz (Bus, Tram, U-Bahn, Zug rund um einen Hauptbahnhof) **mit Stiften in ein kariertes Schulheft** gezeichnet.
Alles wirkt handgemacht, aber aufgeräumt: wenige Farben, klare Formen, viel Papier.
Gerät: **nur iPad** (Safari / Home-Bildschirm-App), Bedienung mit Apple Pencil und Finger.

## 1. Leitsätze

1. **Papier zuerst.** Hintergrund ist immer Karopapier. Keine Verläufe, keine Glas-Effekte, keine harten Schatten.
2. **Alles ist gezeichnet.** Linien, Formen und Rahmen wackeln leicht (siehe 4). Nie perfekt gerade Vektorlinien für Spielobjekte.
3. **Ruhig wackeln.** Das Wackeln ist *fest pro Objekt* (Seed), es zittert nie von Bild zu Bild.
4. **Farbe = Information.** Bunte Farben nur für U-Bahn-Linien. Stationen und Fahrgäste sind Bleistift-Schwarz. Rot ist für Gefahr reserviert.
5. **Spielfeld frei halten.** Bedienelemente liegen am Rand (oben Status, unten Linien-Stifte). Dialoge sind Zettel, die über dem Spiel liegen.
6. **Ein Blick reicht.** Formen statt Text, wo es geht. Text ist kurz, Deutsch, per Du.

## 2. Farb-Tokens

Als CSS-Variablen in `style.css` (`:root`) und als `COLORS` in `game.js`. Werte nur von dort nehmen.

| Token | Wert | Verwendung |
|---|---|---|
| `--paper` | `#fbfaf6` | Papier |
| `--grid` | `rgba(60,100,170,.16)` | Karolinien (alle 5 mm = 1 Einheit) |
| `--margin` | `rgba(214,72,72,.45)` | rote Randlinie (Deko auf Zetteln) |
| `--pencil` | `#2b2b2b` | Stationen, Fahrgäste, Text |
| `--pencil-soft` | `#6b6b6b` | Nebentext, gesperrte Elemente |
| `--danger` | `#d0342c` | Überfüllung, Game Over (Rotstift) |
| `--marker` | `#ffe83d` | Textmarker-Hervorhebung (mit `multiply`) |
| `--note` | `#fffdf3` | Zettel/Dialog-Fläche |
| `--tape` | `rgba(240,225,170,.75)` | Klebestreifen auf Zetteln |

**Linienfarben (Filzstifte)**, feste Reihenfolge:
Rot `#d23b2f` · Blau `#2456c9` · Grün `#2f9e4f` · Orange `#ef8a17` · Lila `#8a3fb8` · Türkis `#1199a8` · Braun `#8b5a2b` · Pink `#d81b7a` · Oliv `#6d7f12` · Dunkelblau `#1f3a7a`

Dark Mode gibt es bewusst nicht: Ein Heft ist hell.

## 3. Schrift

- **Handschrift-Look** (Titel, Zahlen, Zettel-Überschriften): `"Noteworthy", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive`. Auf dem iPad ist Noteworthy vorinstalliert, also keine Web-Fonts laden (offline!).
- **Fließtext/Erklärungen**: `-apple-system, "SF Pro Text", sans-serif`, mindestens 15 px.
- Zahlen im Status (Punkte, Woche) groß: 26–32 px Handschrift.

## 4. Zeichen-Stil (Canvas)

Einheit `U` = 1 Karokästchen in Weltkoordinaten. Alle Maße in U, damit sie beim Zoomen mitwachsen.

| Objekt | Stil |
|---|---|
| U-Bahn-Linie | Filzstift: Breite 0,30 U, Linienfarbe, `lineCap/lineJoin = round`, Alpha 0,92. Wackel-Amplitude 0,05 U, an den Enden 0. Parallele Linien 0,32 U versetzt. |
| Linienende | „Stiftkappe“: 0,9 U Verlängerung + Querstrich 0,55 U. Gleichzeitig Griff zum Verlängern. |
| Station | Weiß gefüllt, Bleistift-Kontur 0,11 U, Radius 0,55 U. Kontur doppelt gezeichnet (2. Strich 0,03 U versetzt, Alpha 0,35) = Skizzen-Look. Kreise überschießen leicht (Anfang ≠ Ende). |
| Großer Bahnhof | Zweite Kontur außen (Radius +0,22 U). |
| Fahrgast | Kleine, gefüllte Bleistift-Form, Radius 0,16 U, ohne Wackeln. |
| Zug | Abgerundetes Rechteck 1,0 × 0,5 U in Linienfarbe, Fahrgäste als weiße Mini-Formen. |
| Überfüllung | Rotstift-Bogen um die Station (Radius 1,05 U, Breite 0,12 U) + rote Füllung Alpha 0,12. |
| Vorschau beim Ziehen | gestrichelter Stift (Strich 0,35 U, Lücke 0,25 U) in der Linienfarbe. |

Wackeln immer über `wobble(seed, i)` (deterministisch), nie `Math.random()` beim Zeichnen.

**Verkehrsmittel** – jedes hat einen eigenen Strich, damit man sie ohne Legende unterscheidet:

| Verkehrsmittel | Strecke | Fahrzeug |
|---|---|---|
| Bus | gestrichelter Marker, 0,20 U, Strich 0,55 / Lücke 0,32 U | ein kurzer Wagen 0,8 × 0,46 U, eckiger |
| Tram | helles Band (Alpha 0,22, 0,34 U) + zwei dünne Schienen ±0,11 U | zwei Glieder, 1,35 × 0,36 U |
| U-Bahn | dicker Filzstift 0,30 U | ein Wagen 1,0 × 0,5 U |
| Zug | Gleis: Schwellen alle 0,45 U (0,44 U breit) + zwei Schienen ±0,12 U | zwei Wagen, 1,75 × 0,46 U |

Symbole (SVG, 24er-Raster) stehen in `MODES[…].icon` in `game.js` und werden überall wiederverwendet.

**Hauptbahnhof:** Hausform (Radius 0,9 U) mit Bleistift-„H“; Fahrgäste mit Ziel Hauptbahnhof sind kleine gefüllte Häuser.

**Stationsformen:** Kreis ●, Dreieck ▲, Quadrat ■ (häufig) – Stern ★, Raute ◆, Kreuz ✚ (selten, je max. eine Station).

## 5. UI-Komponenten (HTML über dem Canvas)

- **Zettel** (`.note`): `--note`-Fläche, Radius 6 px, leichte Drehung (−1,5° … 1,5°), weicher Schatten `0 6px 18px rgba(0,0,0,.12)`, oben ein Klebestreifen (`.note::before`). Für Dialoge, Start, Upgrade, Game Over.
- **Stift-Knopf** (`.pen-btn`): Text in Handschrift, Rahmen als gezeichneter Kringel (SVG oder `border-radius` 255px 15px 225px 15px/15px 225px 15px 255px), 2 px Bleistift. Primär: Textmarker-Hinterlegung.
- **Leiste unten** (`.pens`): pro Verkehrsmittel eine Gruppe (`.mode-group`) aus Reiter (`.mode-tab`: Symbol, Name, Zahl freier Fahrzeuge) und Linien-Stiften (44 px). Benutzt = gefüllt in Linienfarbe; frei = gestrichelte Kontur. Die gewählte Gruppe ist ein Zettel mit Kringel-Rahmen, ihr Name ist mit Textmarker hinterlegt.
- **Status** (oben): links Fahrgäste-Zähler, rechts Woche + Wochenuhr + Tempo (Pause / 1× / 2×).
- **Tutorial-Zettel** (`.coach`): Zettel über der Leiste unten mit gelbem Rand links, „Anleitung x / 9“, Text in Handschrift 21 px, „Überspringen“ (leise) und „Weiter“ (Textmarker). Hervorhebung: auf dem Canvas gelber Textmarker-Kreis hinter dem Ziel und gestrichelter Bleistift-Pfeil mit wanderndem Stiftpunkt; in der Leiste pulsierender Textmarker-Rahmen (`.tut-focus`). Die Kamera hält die Stadt über dem Zettel.
- **Toast**: kleiner Zettel unten mittig, verschwindet nach 2,5 s.
- Icons: einfache SVG-Striche (`stroke: currentColor; stroke-width: 2.2; stroke-linecap: round`), nie Emoji in Bedienelementen.

## 6. iPad-Regeln (Pflicht)

- Touch-Ziele **≥ 44 px**; auf dem Spielfeld Trefferradius `max(0,9 U, 28 px)`.
- `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none` auf dem Spielfeld; `gesturestart` unterbinden.
- Pointer Events mit `pointerType`; während ein Stift zeichnet, Finger-Berührungen ignorieren (Handballen).
- Canvas mit `devicePixelRatio` (max. 2) scharf rendern.
- Safe Areas: `env(safe-area-inset-*)` für Status und Linien-Stifte.
- Quer- **und** Hochformat: Kamera passt die Stadt automatisch in den freien Bereich ein.
- PWA: `sw.js` und `manifest.json` im Hauptordner, alles offline. Nach Änderungen `CACHE_VERSION` in `sw.js` hochzählen.

## 7. Bewegung

- Kamera zoomt weich heraus, wenn die Stadt wächst (Interpolation ~1,5 s).
- Neue Station „ploppt“ auf (Skalierung 0 → 1,15 → 1 in 0,35 s).
- Zettel fallen leicht gedreht ein (0,25 s). Keine Effekte über 0,4 s außer dem Zoom.

## 8. Prüfliste vor der Abgabe

- [ ] Nur Tokens aus Abschnitt 2 benutzt? Rot nur für Gefahr?
- [ ] Wackeln stabil (kein Flimmern beim Stillstand)?
- [ ] Alle Knöpfe ≥ 44 px, Text ≥ 15 px?
- [ ] Im Hochformat (820 × 1180) und Querformat (1180 × 820) getestet, nichts verdeckt?
- [ ] Safe Areas beachtet, kein Scrollen/Zoomen der Seite?
- [ ] Funktioniert offline (Service Worker cached alle Dateien)?
