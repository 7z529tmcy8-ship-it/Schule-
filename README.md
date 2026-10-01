# Meine Handschrift ✍️

Eine Web-App für das iPad, die getippten Text in **deine eigene Handschrift** umwandelt – für Briefe, Karten, Notizen und Lernzettel.
Alles läuft im Browser. Nichts wird hochgeladen: Deine Zeichen bleiben im Speicher von Safari auf deinem iPad.

---

## So funktioniert die App

### 1 · Handschrift erfassen
1. Schreib jedes Zeichen mit dem Apple Pencil (oder Finger) in das große Feld.
   Die Hilfslinien helfen, dass alles gleich groß wird:
   - **Oberlinie** – Höhe der Großbuchstaben und Oberlängen (b, d, h, k, l)
   - **Mittellinie** (gestrichelt) – Höhe von a, c, e, m, n …
   - **Grundlinie** – darauf „steht“ die Schrift
   - **Unterlinie** – bis hierher gehen Unterlängen (g, j, p, q, y)
2. Oben rechts gibt es **V1, V2, V3**: Pro Zeichen kannst du bis zu 3 Varianten schreiben. Mehr Varianten = natürlicherer Text.
3. **Nächstes Zeichen ▶** geht weiter. Rechts siehst du alle Zeichen und den Fortschritt; tippe ein Zeichen an, um direkt dorthin zu springen.
4. Gespeichert wird automatisch nach jedem Strich. Du kannst jederzeit aufhören und später weitermachen.

**Buchstabenpaare (optional):** Ganz unten im Raster stehen Paare wie *sch, ch, ck, st, ie, en, er, ll, tt*. Schreib sie verbunden in einem Zug, so wie mitten im Wort.
Die App setzt sie dann automatisch statt der Einzelbuchstaben ein, aber nicht jedes Mal, damit es natürlich bleibt. Fehlende Paare sind kein Problem: Dann nimmt die App die Einzelbuchstaben.

**Apple Pencil:** Sobald die App den Stift erkennt, schaltet sie „Finger zeichnet“ aus, damit dein Handballen keine Striche macht. Mit dem Schalter kannst du das ändern.

### 2 · Text & Export
- Links Text eintippen oder einfügen, rechts siehst du die Live-Vorschau auf A4 (lange Texte → mehrere Seiten).
- Fehlt ein Zeichen, erscheint ein Hinweis. Antippen bringt dich direkt zum Erfassen. Zeichen wie € oder @ kannst du dort als **eigene Zeichen** hinzufügen.
- Einstellungen: Farbe, Strichdicke, Schriftgröße, Zeilen-, Buchstaben- und Wortabstand, Schwankungen (Größe, Neigung, Abstand), wellige Zeilen, Papier (Weiß, Linien, Karo, Kariert 5 mm, vergilbt).
- **Buchstabenpaare verwenden** lässt sich unter „Natürlichkeit“ abschalten.
- **🎲 Neu mischen** würfelt die kleinen Unregelmäßigkeiten neu.
- **PDF erstellen** / **PNG erstellen** → danach **Teilen / Sichern …** (iPad-Teilen-Menü: „In Dateien sichern“, „Drucken“, AirDrop …) oder **Herunterladen**.

### Formatierung (z. B. für Lernzettel)
Text im Textfeld markieren und oben einen Knopf antippen – oder die Zeichen direkt tippen:

| Eingabe | Ergebnis |
|---|---|
| `# Titel` (am Zeilenanfang) | große, unterstrichene Überschrift |
| `## Titel` | kleinere Überschrift |
| `- Punkt` (auch `* ` oder `• `) | Aufzählungspunkt, Folgezeilen eingerückt |
| `==wichtig==` | Textmarker (Gelb, Grün, Pink oder Blau) |
| `**Merke**` | Zweitfarbe (Rot, Grün oder Orange) |
| `__Text__` | unterstrichen |

Die Farben stellst du in der Karte „Formatierung“ ein. Ein Marker ohne Gegenstück (z. B. nur ein `**`) bleibt als normaler Text stehen.

### ⚠️ Backup nicht vergessen!
Safari kann Website-Daten löschen (z. B. wenn der Speicher knapp ist oder du die App lange nicht öffnest).
Tippe deshalb ab und zu auf **Backup sichern** und wähle **In Dateien sichern** (am besten iCloud Drive).
Mit **Backup laden** holst du deine Handschrift aus der Dateien-App zurück – auch auf einem neuen iPad.

---

## Die App aufs iPad bringen (kostenlos)

Die App muss einmal im Internet liegen (über **https**), damit Safari sie installieren kann. Danach funktioniert sie auch **offline**.
Du brauchst dafür keinen Computer – alles geht auf dem iPad.

### Weg A: GitHub Pages (empfohlen, das Projekt liegt schon auf GitHub)
1. Öffne in Safari dein Repository auf **github.com** und melde dich an.
2. Tippe auf **Settings** (Einstellungen). Falls du es nicht siehst: Safari auf „Desktop-Website anfordern“ stellen (**aA**-Symbol in der Adressleiste).
3. Links im Menü: **Pages**.
4. Bei **Source** wähle **Deploy from a branch**, darunter den Branch, in dem die App liegt (z. B. `main` oder `master`) und den Ordner **/ (root)** → **Save**.
5. Nach 1–2 Minuten erscheint oben die Adresse, z. B.
   `https://DEIN-NAME.github.io/Schule-/`
   Hinweis: Bei einem **privaten** Repository geht GitHub Pages nur mit einem bezahlten Konto. Dann das Repository auf „Public“ stellen (deine Handschrift ist dort nicht enthalten – die liegt nur auf deinem iPad) oder Weg B nehmen.

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

> Wichtig: Die App auf dem Home-Bildschirm und die Seite in Safari haben **getrennte Speicher**. Erfasse deine Handschrift also in der installierten App (oder übertrage sie per Backup).

### Updates
Wenn sich am Code etwas ändert: In `sw.js` die Zeile `CACHE_VERSION = 'handschrift-v2'` hochzählen (v3, v4 …) und neu hochladen.
Die App holt sich die neue Version beim nächsten Start mit Internet (eventuell zweimal öffnen).

---

## Technik (für Neugierige)

| Datei | Inhalt |
|---|---|
| `index.html` | Aufbau der Oberfläche |
| `style.css` | Design, Quer-/Hochformat, Safe Areas |
| `app.js` | Zeichnen, Speichern (IndexedDB), Layout, Vorschau, PDF/PNG-Export, Backup |
| `sw.js` | Service Worker für Offline-Nutzung |
| `manifest.json`, `icons/` | PWA-Daten für den Home-Bildschirm |
| `vendor/jspdf.umd.min.js` | jsPDF 4.2.1 (MIT-Lizenz, siehe `vendor/jspdf-LICENSE.txt`), lokal für Offline-PDF |

- Jedes Zeichen wird **als Striche** (Punkte mit Druckstärke) **und** als zugeschnittenes, transparentes **PNG** gespeichert, mit der Lage der Grundlinie. Die Striche erlauben es, Farbe und Strichdicke nachträglich zu ändern und in jeder Größe scharf zu drucken.
- Die Vorschau rendert nur sichtbare Seiten, der Export arbeitet Seite für Seite mit 200 dpi – das schont den iPad-Speicher.
- Typografische Zeichen aus Word (`„ “ ’ – …`) werden automatisch auf deine erfassten `" ' - .` abgebildet.

### Lokal testen (mit Computer, optional)
```bash
npx http-server -p 8080 .
# dann http://localhost:8080 öffnen
```
