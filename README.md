# Heft-Metro 🚇

Ein Verkehrs-Planungsspiel im Schulheft-Look – gemacht **nur für das iPad** (Safari / Home-Bildschirm, Apple Pencil und Finger).
Inspiriert vom Spielprinzip von Mini Metro, aber mit eigener Grafik und eigenem Namen. Alles läuft im Browser und offline, nichts wird hochgeladen.

## So spielst du
- In der Mitte steht der **Hauptbahnhof** (Haus mit „H“). Viele Fahrgäste wollen dorthin, und dort steigen auch die meisten ein.
- Wähle unten ein Verkehrsmittel und zieh mit Stift oder Finger von Station zu Station – so entsteht eine Linie.
- Fahrgäste (kleine Formen) wollen zu einer Station mit ihrer Form. Umstiege – auch zwischen Bus, Tram, U-Bahn und Zug – passieren automatisch.
- Am Linienende („Stiftkappe“) ziehst du die Linie weiter oder zurück.
- Unten auf einen bunten Stift tippen → Zug hinzufügen/abziehen oder Linie löschen.
- Jede Woche gibt es einen Zug und eine Wahl: neue Linie, Extra-Zug oder großer Bahnhof.
- Ist eine Station zu lange überfüllt (roter Kreis), ist Endstation. Dein Rekord wird gespeichert.
- Oben rechts: Pause, normal, schnell. Verlässt du die App, pausiert das Spiel automatisch.

## Die Verkehrsmittel

| | Bus | Tram | U-Bahn | Zug |
|---|---|---|---|---|
| Tempo | langsam | mittel | schnell | sehr schnell |
| Plätze | 4 | 6 | 6 | 10 |
| Halte pro Linie | max. 6 | max. 8 | beliebig | max. 5 |
| Besonderheit | viele Fahrzeuge, jede Woche ein Bus geschenkt | schnelles Ein- und Aussteigen | – | startet immer am Hauptbahnhof, längere Halte |
| Am Anfang | 2 Linien, 3 Busse | 1 Linie, 1 Tram | 1 Linie, 1 U-Bahn | 1 Strecke, 1 Zug |

Jede Woche werden drei Upgrades ausgelost: neue Linien, zusätzliche Fahrzeuge oder ein großer Bahnhof.

## Speichern
Das Spiel **speichert sich automatisch**: alle 5 Sekunden, beim Pausieren, nach jedem Wochen-Upgrade und sobald du die App verlässt.
Beim nächsten Öffnen tippst du auf **Weiterspielen**. Über den **Menü-Knopf** (☰ oben rechts) speicherst du sofort und kommst zum Startzettel.
„Neues Spiel“ fragt vorher nach, weil es den Spielstand überschreibt. Nach „Endstation“ wird der Stand gelöscht – nur der Rekord bleibt.
Der Spielstand liegt nur auf diesem iPad (im Speicher von Safari bzw. der Home-Bildschirm-App).

## Das Spiel aufs iPad bringen (kostenlos)

Die App muss einmal im Internet liegen (über **https**), damit Safari sie installieren kann. Danach funktioniert sie auch **offline**.
Du brauchst dafür keinen Computer – alles geht auf dem iPad.

### Weg A: GitHub Pages (empfohlen, das Projekt liegt schon auf GitHub)
1. Öffne in Safari dein Repository auf **github.com** und melde dich an.
2. Tippe auf **Settings** (Einstellungen). Falls du es nicht siehst: Safari auf „Desktop-Website anfordern“ stellen (**aA**-Symbol in der Adressleiste).
3. Links im Menü: **Pages**.
4. Bei **Source** wähle **Deploy from a branch**, darunter den Branch, in dem die App liegt (z. B. `main` oder `master`) und den Ordner **/ (root)** → **Save**.
5. Nach 1–2 Minuten erscheint oben die Adresse, z. B.
   `https://DEIN-NAME.github.io/Schule-/`
   Hinweis: Bei einem **privaten** Repository geht GitHub Pages nur mit einem bezahlten Konto. Dann das Repository auf „Public“ stellen oder Weg B nehmen.

### Weg B: Netlify Drop (ohne GitHub)
1. Lade das Projekt als ZIP herunter (auf GitHub: **Code → Download ZIP**). Die Datei landet in der Dateien-App unter „Downloads“.
2. In der **Dateien-App** auf die ZIP tippen → sie wird zu einem Ordner entpackt.
3. Öffne in Safari **https://app.netlify.com/drop** und lege kostenlos ein Konto an (sonst wird die Seite nach einer Stunde gelöscht).
4. Tippe auf „browse to upload“ und wähle den **entpackten Ordner** (der, in dem `index.html` direkt drin liegt).
5. Netlify zeigt dir eine Adresse wie `https://irgendwas-12345.netlify.app`.

### Installieren: „Zum Home-Bildschirm“
1. Öffne die Adresse in **Safari** (nicht in Chrome – nur Safari kann auf dem iPad Web-Apps installieren).
2. Tippe auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben).
3. Wähle **Zum Home-Bildschirm** → **Hinzufügen**.
4. Starte die App ab jetzt immer über das neue Symbol auf dem Home-Bildschirm. Sie läuft dann im Vollbild wie eine echte App und funktioniert offline.

> Hinweis: Die App auf dem Home-Bildschirm und die Seite in Safari haben getrennte Speicher – dein Rekord wird also pro Variante gemerkt.


### Updates
Nach Änderungen am Code in `sw.js` die Zeile `CACHE_VERSION = 'heftmetro-v3'` hochzählen (v4, v5 …).
Das iPad holt sich die neue Version beim nächsten Start mit Internet (eventuell zweimal öffnen).

## Technik

| Datei | Inhalt |
|---|---|
| `index.html` | Aufbau: Spielfeld, Status, Linien-Stifte, Zettel (Start, Upgrade, Game Over) |
| `style.css` | Schulheft-Design, Safe Areas, Quer- und Hochformat |
| `game.js` | Spiellogik, Wegfindung, Zeichnen (Canvas), Pencil-/Finger-Eingabe |
| `sw.js` | Service Worker für Offline-Nutzung |
| `manifest.json`, `icons/` | PWA-Daten für den Home-Bildschirm |
| `.claude/skills/heft-metro-design/SKILL.md` | Design-System (Farben, Schrift, Zeichenstil, iPad-Regeln) |

Spiel-Balance (Tageslänge, Kapazität, Zuggeschwindigkeit …) steht gesammelt in `CFG` oben in `game.js`.

### Lokal testen (mit Computer, optional)
```bash
npx http-server -p 8080 .
# dann http://localhost:8080 öffnen
```
