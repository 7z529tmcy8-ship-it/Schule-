# Heft-Metro 🚇

Ein Verkehrs-Planungsspiel im Schulheft-Look – gemacht **nur für das iPad** (Safari / Home-Bildschirm, Apple Pencil und Finger).
Inspiriert vom Spielprinzip von Mini Metro, aber mit eigener Grafik und eigenem Namen. Alles läuft im Browser und offline, nichts wird hochgeladen.

## Anleitung (Tutorial)
Beim allerersten Spiel startet automatisch eine **Anleitung in 9 Schritten**: Du baust deine erste Bus- und Zuglinie selbst, die richtige Stelle leuchtet jeweils gelb auf, und ein gestrichelter Pfeil zeigt, wohin du ziehen sollst. Währenddessen gibt es keinen Zeitdruck.
Später kannst du sie jederzeit über **„Anleitung“** auf dem Startzettel wiederholen oder mit „Überspringen“ abbrechen.

## Zwei Spielwelten
Auf dem Startzettel wählst du die Spielwelt. Beide funktionieren nach derselben Logik (Drehkreuz, Netzgrößen, Reichweiten, Stationsarten, Ausbau, Upgrades, Ereignisse).

| | Hannover | Europa |
|---|---|---|
| Drehkreuz | Hauptbahnhof | Flughafen Frankfurt |
| Stationen | 42 Stadtteile | ~60 Städte mit Flughafen |
| Karte | Leine, Ihme, Maschsee, Kanal, Eilenriede | Küsten, Nordsee, Ostsee, Mittelmeer, Schwarzes Meer |
| großes Netz, kurze Wege | Bus (max. ~2,7 km) | Propellermaschine (max. ~600 km) |
| mittel | Tram, U-Bahn | Regionaljet (~1.100 km), Mittelstrecke (~2.200 km) |
| klein, weit | S-Bahn, Zug (mind. ~3 km) | Großraumjet, Jumbo (mind. ~1.500 km) |
| Stationsarten | Haltestelle · T · U · S | Flugplatz · R · F · G |
| Ereignisse | 96-Spiel, Messe, Maschseefest, Zoo-Tag | Oktoberfest, Sommerferien, CL-Finale, Hannover Messe, Karneval |

Es gibt **einen** Spielstand (die zuletzt gespielte Welt) und einen Rekord pro Welt. Die Anleitung spielt in Hannover. Auch die Europa-Karte ist **grob aus dem Gedächtnis** gezeichnet (1 Kästchen ≈ 60 km); die Daten stehen in `EUROPA_MAP` in `game.js`.

## Europa: deine eigene Airline
In Europa bist du Unternehmer:in. Die Welt wächst langsamer (längere Wochen, seltener neue Städte), dafür geht es ums Geld:
- **Kontostand** (Start: 4 Mio €) oben im Status. Jeder angekommene Fluggast-Block bringt **Ticketumsatz** – je größer das Flugzeug, desto mehr. Flugzeuge kosten laufend **Leasing**, Routen **Gebühren**.
- **Firmen-Shop** (Aktenkoffer-Knopf): Flugzeuge kaufen, Routen-Lizenzen, Flughäfen ausbauen, Umsteige-Terminal, großes Terminal, **Werbekampagne** (+40 % Fluggäste für eine Woche).
- **Ticketpreis**: Günstig (mehr Fluggäste, weniger pro Ticket), Normal, Premium (weniger Fluggäste, mehr pro Ticket).
- **Wochenbilanz** am Ende jeder Woche: Umsatz, Kosten, Gewinn, Kontostand, Diagramm der letzten Wochen und ein Tipp.
- **Pleite = Endstation:** Unter dem Kreditrahmen von −2 Mio € ist die Airline insolvent.
- Flugzeuge steigen nach dem Start auf und sinken vor der Landung – mit Schatten und Kondensstreifen. Verkäufe steigen als „+55.000 €“ über den Flughäfen auf.

Alle Zahlen stehen gesammelt in `EUROPA.business` in `game.js`.

## Hannover
Gespielt wird auf einer **grob skizzierten Karte von Hannover**: Leine, Ihme, Maschsee, Mittellandkanal, Eilenriede, Herrenhäuser Gärten und ein paar Orientierungspunkte (Rathaus, Zoo, Stadion, Messe).
Neue Stationen entstehen in echten **Stadtteilen** – von innen (Oststadt, Nordstadt, Linden) nach außen (Misburg, Wettbergen, Lahe). Noch nicht erschlossene Stadtteile stehen blass auf der Karte.
Die Lage ist aus dem Gedächtnis eingetragen und **nicht kartengenau** (1 Kästchen ≈ 300 m). Korrigieren lässt sich alles in `HANNOVER` am Anfang von `game.js` (Angaben in km vom Hauptbahnhof aus, x nach Osten, y nach Süden).

## So spielst du
- In der Mitte steht der **Hauptbahnhof** (Haus mit „H“). Viele Fahrgäste wollen dorthin, und dort steigen auch die meisten ein.
- Wähle unten ein Verkehrsmittel und zieh mit Stift oder Finger von Station zu Station – so entsteht eine Linie.
- Fahrgäste (kleine Formen) wollen zu einer Station mit ihrer Form. Umstiege – auch zwischen Bus, Tram, U-Bahn und Zug – passieren automatisch.
- Am Linienende („Stiftkappe“) ziehst du die Linie weiter oder zurück.
- Einfacher: An der **Endstation** einer Linie ansetzen und weiterziehen – das verlängert die Linie (am Hauptbahnhof nur, wenn keine neue Linie mehr frei ist).
- **Station einfügen:** Mitten auf einen Linienabschnitt tippen und zu einer Station ziehen – sie wird zwischen den beiden Halten eingefügt.
- Unten auf einen bunten Stift tippen → Zug hinzufügen/abziehen oder Linie löschen.
- Jede Woche gibt es einen Zug und eine Wahl: neue Linie, Extra-Zug oder großer Bahnhof.
- Ist eine Station zu lange überfüllt (roter Kreis), ist Endstation. Dein Rekord wird gespeichert.
- Oben rechts: Pause, normal, schnell. Verlässt du die App, pausiert das Spiel automatisch.

## Die Verkehrsmittel

| | Bus | Tram | U-Bahn | S-Bahn | Zug |
|---|---|---|---|---|---|
| Netz | groß (bis 5 Linien) | mittel | mittel | klein | sehr klein |
| Abstand zwischen Halten | max. ~2,7 km | max. ~3,3 km | max. ~4,5 km | beliebig | **mind. ~3 km** |
| Hält an | allen Stationen | Tram-Halt, U-Bahn, Bahnhof | U-Bahn-Station, Bahnhof | nur Bahnhof | nur Bahnhof |
| Tempo / Plätze | langsam / 4 | mittel / 6 | schnell / 6 | schnell / 8 | sehr schnell / 10 |
| Besonderheit | hält überall, kurze Wege | schnelles Einsteigen | – | Linie über den Hauptbahnhof | nur lange Strecken ab Hauptbahnhof |

## Stationsarten und Ausbau
- **Bushaltestelle** (klein, ohne Abzeichen) – nur Busse
- **Tram-Halt** („T“) – Bus und Tram
- **U-Bahn-Station** (blaues „U“) – Bus, Tram, U-Bahn
- **Bahnhof** (grünes „S“) – alles, auch S-Bahn und Zug
- **Hauptbahnhof** – alles

Welche Art ein Stadtteil hat, ist grob an Hannovers echtes Netz angelehnt, aber vereinfacht.
Wählst du ein Verkehrsmittel, werden Stationen blass, an denen es nicht halten kann.
**Ausbau:** Wöchentliche Upgrades wie „Tram-Gleise legen“, „U-Bahn-Station bauen“ oder „Bahnhof bauen“ machen eine Station eine Stufe größer – einfach danach auf die Station tippen.

Jede Woche werden drei Upgrades ausgelost: neue Linien, zusätzliche Fahrzeuge, Ausbau oder ein großer Bahnhof.

## Karte zoomen und verschieben
- **Zwei Finger** auseinander/zusammen: rein- und rauszoomen.
- **Ein Finger auf leerer Fläche** (nicht auf einer Station): Karte verschieben.
- Rechts am Rand: **+**, **−** und **◎** (zurück zur automatischen Ansicht, die immer die ganze Stadt zeigt).
- Rausgezoomt siehst du ganz Hannover mit Umland (Langenhagen, Garbsen, Seelze, Laatzen, Hemmingen …).

## Fokus zu Beginn
Bei „Losfahren“ wählst du, worauf du setzt – davon hast du am Anfang mehr Linien:

| Fokus (Hannover / Europa) | Linien am Start: Bus/Propeller · Tram/Regionaljet · U-Bahn/Mittelstrecke · S-Bahn/Großraumjet · Zug/Jumbo |
|---|---|
| Busnetz / Kurzstrecke | 4 · 1 · 1 · – · – |
| Stadtbahn / Mittelstrecke | 1 · 2 · 2 · 1 · – |
| Schiene / Langstrecke | 1 · – · 1 · 2 · 2 |
| Ausgewogen | 2 · 1 · 1 · 1 · 1 |

## Fahrzeuge und Wochen-Meilensteine
- **Fahrzeuge kommen automatisch:** Jede neue Linie hat sofort ein Fahrzeug. Jede Woche kommt ein weiteres dazu und fährt direkt auf der Linie mit, die es am dringendsten braucht.
- **Am Ende jeder Woche wählst du eine neue Linie** – für jedes Verkehrsmittel, das noch wachsen kann, gibt es eine Karte (bevorzugt die, mit denen du Stationen ohne Anschluss erreichst) – oder einen Ausbau (Station ausbauen, Umsteigeknoten, großer Bahnhof).

## Liniennamen, Umsteigeknoten und Ereignisse
- **Liniennamen:** Jede Linie bekommt automatisch einen Namen wie in Hannover – Busse 100, 121, 128 …, Trams 10, 17, 11, U-Bahn U1–U3, S-Bahn S1/S5, Züge RE2/RE3. Der Name steht am Stift und als Schild an der Linie. Im Linien-Menü kannst du ihn mit **„Name ändern“** umbenennen (max. 6 Zeichen).
- **Umsteigeknoten** (Upgrade, Abzeichen ⇄): Ein- und Umsteigen geht dort deutlich schneller, und es passen 6 Fahrgäste mehr hin.
- **Ereignisse** (ab Woche 2): 96-Spiel im Stadion, Messe, Maschseefest oder Zoo-Tag. Die Station nahe dem Ort bekommt ein rotes Fähnchen, viele Fahrgäste wollen dorthin. Am Ende reisen alle auf einmal ab.

## Ladebildschirm
Beim Öffnen erscheint kurz ein Zettel mit dem Logo, drumherum fahren Bus, U-Bahn, S-Bahn und Zug. Antippen überspringt ihn.

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
Nach Änderungen am Code in `sw.js` die Zahl in `CACHE_VERSION` (z. B. `heftmetro-v5` → `heftmetro-v6`) hochzählen.
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
