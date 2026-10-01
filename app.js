/* =====================================================================
   Meine Handschrift – app.js
   ---------------------------------------------------------------------
   Aufbau der Datei:
     1. Konstanten und Standardwerte
     2. Kleine Hilfsfunktionen (DOM, Zufall, Toast, Dateien)
     3. Speicher (IndexedDB)
     4. Striche zeichnen (gemeinsam für Erfassen, Vorschau und Export)
     5. Glyphen: Zuschneiden, PNG erzeugen, Bild-Cache
     6. Bereich 1: Zeichenfeld und Erfassen
     7. Layout: Text in Zeilen und Seiten zerlegen
     8. Papier und Seiten rendern
     9. Vorschau
    10. Export (PDF, PNG) und Backup (JSON)
    11. Einstellungen-Oberfläche
    12. Start
   ---------------------------------------------------------------------
   Koordinaten: Jedes Zeichen wird in „Einheiten“ (U) gespeichert.
   1 U = Abstand Grundlinie → Oberlinie (Höhe eines Großbuchstabens).
   x/y sind relativ zur Grundlinie (y nach unten positiv). So lassen sich
   die Zeichen später in jeder Größe gestochen scharf neu zeichnen.
   ===================================================================== */
'use strict';

/* =====================================================================
   1. KONSTANTEN
   ===================================================================== */

const CHAR_GROUPS = [
  { title: 'Kleinbuchstaben', chars: [...'abcdefghijklmnopqrstuvwxyz'] },
  { title: 'Großbuchstaben', chars: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] },
  { title: 'Ziffern', chars: [...'0123456789'] },
  { title: 'Umlaute & ß', chars: [...'äöüÄÖÜß'] },
  { title: 'Satzzeichen', chars: [...'.,!?:;-()"\''] },
];
const BASE_CHARS = CHAR_GROUPS.flatMap(g => g.chars);
const MAX_VARIANTS = 3;

/** Lage der Hilfslinien im Zeichenfeld, als Anteil der Feldhöhe. */
const PAD = {
  aspect: 4 / 3,     // Breite : Höhe
  baseline: 0.62,    // Grundlinie
  unit: 0.30,        // 1 U = Abstand Grundlinie → Oberlinie
  xHeight: 0.6,      // Mittellinie (Höhe von a, c, e …) in U
  descender: 0.5,    // Unterlinie in U unter der Grundlinie
};

/** Strichbreite beim Erfassen in U (bei mittlerem Druck). */
const CAPTURE_STROKE = 0.08;
/** Auflösung der gespeicherten PNGs: Pixel pro U. */
const PNG_SCALE = 100;

/** A4-Seite in mm und Ränder. Oben/links sind Vielfache von 5 mm (passt zum Karo). */
const PAGE = { w: 210, h: 297, ml: 25, mr: 15, mt: 20, mb: 15 };
/** Auflösung für PDF/PNG-Export. 200 dpi ist druckscharf und schont den iPad-Speicher. */
const EXPORT_DPI = 200;

const INK = { blue: '#1b3a94', black: '#1c1c1e' };

/** Standard-Einstellungen für Bereich 2. Abstände in U, Schwankungen 0…1. */
const DEFAULT_SETTINGS = {
  color: 'blue',
  customColor: '#7a1fa2',
  thickness: 0.45,       // mm
  fontSize: 4.5,         // mm (Höhe der Großbuchstaben)
  lineSpacing: 9,        // mm
  letterSpacing: 0.12,   // U
  wordSpacing: 0.6,      // U
  randomVariants: true,
  jitterSize: 0.4,
  jitterRotate: 0.4,
  jitterSpacing: 0.4,
  wave: 0.3,
  paper: 'lined',        // white | lined | karo | grid5
  aged: false,
  seed: 1,
};

const DEFAULT_TEXT = 'Liebe Grüße!\n\nDas hier ist meine eigene Handschrift – getippt auf dem iPad.';

/** Ersatzzeichen: typografische Zeichen aus Word & Co. auf erfasste Zeichen abbilden. */
const SIMILAR = {
  '„': '"', '“': '"', '”': '"', '«': '"', '»': '"', '″': '"',
  '‚': "'", '‘': "'", '’': "'", '´': "'", '`': "'", '′': "'",
  '–': '-', '—': '-', '‐': '-', '‑': '-', '−': '-',
};

const CHAR_NAMES = {
  '.': 'Punkt', ',': 'Komma', '!': 'Ausrufezeichen', '?': 'Fragezeichen',
  ':': 'Doppelpunkt', ';': 'Semikolon', '-': 'Bindestrich', '(': 'Klammer auf',
  ')': 'Klammer zu', '"': 'Anführungszeichen', "'": 'Apostroph', 'ß': 'Eszett ß',
};

/* =====================================================================
   2. HILFSFUNKTIONEN
   ===================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const fmtNum = (v, digits = 1) => v.toLocaleString('de-DE', { maximumFractionDigits: digits });

function debounce(fn, ms) {
  let t;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

/**
 * Deterministischer Zufall: gleiche Eingaben → gleiche Zahl (0…1).
 * So „springt“ die Vorschau beim Tippen nicht ständig, und „Neu mischen“
 * ändert nur den Startwert (seed).
 */
function rnd(...keys) {
  let h = 0x9e3779b9;
  for (const k of keys) {
    h = Math.imul(h ^ (k | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}
/** Zufall im Bereich −1 … +1 */
const rnd2 = (...keys) => rnd(...keys) * 2 - 1;

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function showBusy(text) { $('#busy-text').textContent = text; $('#busy').hidden = false; }
function hideBusy() { $('#busy').hidden = true; }

function dateStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatBytes(n) {
  return n > 1e6 ? `${fmtNum(n / 1e6)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`;
}

/** Kann das Gerät diese Dateien über das Teilen-Menü weitergeben? */
function canShareFiles(files) {
  try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files })); }
  catch { return false; }
}

/** Normaler Download als Ersatz für das Teilen-Menü. */
async function downloadFiles(files) {
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (files.length > 1) await new Promise(r => setTimeout(r, 500));
  }
}

/**
 * Zeigt den Dialog „Datei ist fertig“. Das eigentliche Teilen passiert erst
 * beim Tippen auf den Button – Safari erlaubt navigator.share() nur direkt
 * nach einer Berührung, nicht nach einer langen Berechnung.
 */
function openFileDialog({ files, title, text, onSaved }) {
  const dlg = $('#file-dialog');
  $('#file-dialog-title').textContent = title;
  $('#file-dialog-text').textContent = text;
  const shareBtn = $('#file-dialog-share');
  shareBtn.hidden = !canShareFiles(files);

  shareBtn.onclick = async () => {
    try {
      await navigator.share({ files, title });
      onSaved?.();
      dlg.close();
    } catch (err) {
      if (err.name !== 'AbortError') toast('Teilen hat nicht geklappt – nimm „Herunterladen“.');
    }
  };
  $('#file-dialog-download').onclick = async () => {
    await downloadFiles(files);
    onSaved?.();
    dlg.close();
  };
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}

/* =====================================================================
   3. SPEICHER (IndexedDB)
   Stores: „glyphs“ (ein Eintrag pro Zeichen-Variante) und „kv“ (Einstellungen,
   Text, Fortschritt). Alles bleibt lokal im Browser.
   ===================================================================== */

const db = {
  _open: null,

  open() {
    if (!this._open) {
      this._open = new Promise((resolve, reject) => {
        const req = indexedDB.open('meine-handschrift', 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('glyphs')) d.createObjectStore('glyphs', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this._open;
  },

  /** Führt fn(store) in einer Transaktion aus und liefert das Ergebnis der Anfrage. */
  async run(storeName, mode, fn) {
    const d = await this.open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },

  allGlyphs() { return this.run('glyphs', 'readonly', s => s.getAll()); },
  putGlyph(g) { return this.run('glyphs', 'readwrite', s => s.put(g)); },
  deleteGlyph(id) { return this.run('glyphs', 'readwrite', s => s.delete(id)); },
  clearGlyphs() { return this.run('glyphs', 'readwrite', s => s.clear()); },
  get(key) { return this.run('kv', 'readonly', s => s.get(key)); },
  set(key, value) { return this.run('kv', 'readwrite', s => s.put(value, key)); },
};

/* =====================================================================
   Anwendungszustand
   ===================================================================== */

const state = {
  /** Map: Zeichen → Array mit bis zu 3 Varianten (oder null) */
  glyphs: new Map(),
  extraChars: [],          // selbst hinzugefügte Zeichen (z. B. € @ +)
  settings: { ...DEFAULT_SETTINGS },
  text: DEFAULT_TEXT,
  capIndex: 0,             // aktuelles Zeichen beim Erfassen
  capVariant: 0,           // aktuelle Variante (0…2)
  fingerDraws: true,
  lastBackup: 0,
  view: 'capture',
};

const allChars = () => [...BASE_CHARS, ...state.extraChars];
const glyphId = (ch, v) => `${ch.codePointAt(0)}_${v}`;
const variantsOf = ch => (state.glyphs.get(ch) || []).filter(Boolean);

function setGlyph(g) {
  if (!state.glyphs.has(g.char)) state.glyphs.set(g.char, new Array(MAX_VARIANTS).fill(null));
  state.glyphs.get(g.char)[g.variant] = g;
}
function removeGlyph(ch, v) {
  const arr = state.glyphs.get(ch);
  if (arr) arr[v] = null;
}
function glyphCount() {
  let n = 0;
  for (const arr of state.glyphs.values()) n += arr.filter(Boolean).length;
  return n;
}

const saveSettings = debounce(() => db.set('settings', state.settings), 300);
const saveText = debounce(() => db.set('text', state.text), 400);

/* =====================================================================
   4. STRICHE ZEICHNEN
   Ein Strich ist ein flaches Array [x, y, druck, x, y, druck, …] in U.
   Gezeichnet wird mit quadratischen Kurven durch die Mittelpunkte der
   Punkte – das glättet die Linie. Jedes Teilstück bekommt seine eigene
   Breite (Druckstärke); runde Linienenden verbinden die Stücke nahtlos.
   ===================================================================== */

/** Breitenfaktor aus dem Druck (0…1): leicht = dünn, fest = dick. */
const pressureWidth = p => 0.5 + p;

/**
 * Zeichnet Teilstück k eines Strichs.
 * Bei n Punkten gibt es n Teilstücke: 0 = Anfang, n-1 = Ende.
 * @param ctx  Canvas-Kontext
 * @param a    Strich-Array
 * @param k    Index des Teilstücks
 * @param s    Pixel pro U
 * @param ox,oy Pixelposition von (0|0) = Grundlinie
 * @param wBase Strichbreite in Pixeln bei Druckfaktor 1
 */
function drawSegment(ctx, a, k, s, ox, oy, wBase) {
  const n = a.length / 3;
  const X = i => ox + a[3 * i] * s;
  const Y = i => oy + a[3 * i + 1] * s;
  const MX = i => (X(i) + X(i + 1)) / 2;
  const MY = i => (Y(i) + Y(i + 1)) / 2;

  ctx.beginPath();
  if (k === 0) {
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(MX(0), MY(0));
  } else if (k === n - 1) {
    ctx.moveTo(MX(n - 2), MY(n - 2));
    ctx.lineTo(X(n - 1), Y(n - 1));
  } else {
    ctx.moveTo(MX(k - 1), MY(k - 1));
    ctx.quadraticCurveTo(X(k), Y(k), MX(k), MY(k));
  }
  ctx.lineWidth = Math.max(0.6, wBase * pressureWidth(a[3 * k + 2]));
  ctx.stroke();
}

/** Zeichnet einen einzelnen Punkt (Strich mit nur einem Punkt, z. B. i-Punkt). */
function drawDot(ctx, a, s, ox, oy, wBase) {
  ctx.beginPath();
  ctx.arc(ox + a[0] * s, oy + a[1] * s, Math.max(0.5, wBase * pressureWidth(a[2]) / 2), 0, Math.PI * 2);
  ctx.fill();
}

/** Zeichnet alle Striche eines Zeichens. */
function drawStrokes(ctx, strokes, s, ox, oy, wBase, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const a of strokes) {
    const n = a.length / 3;
    if (n === 1) drawDot(ctx, a, s, ox, oy, wBase);
    else for (let k = 0; k < n; k++) drawSegment(ctx, a, k, s, ox, oy, wBase);
  }
  ctx.restore();
}

/* =====================================================================
   5. GLYPHEN
   ===================================================================== */

/** Umriss (Bounding Box) aller Punkte in U. */
function strokesBBox(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const a of strokes) {
    for (let i = 0; i < a.length; i += 3) {
      x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]);
      y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]);
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Baut aus den Strichen einen vollständigen Glyph-Eintrag:
 * Bounding Box, zugeschnittenes transparentes PNG und die Lage der
 * Grundlinie im PNG (pngBaseline), damit g, p, y unter die Zeile ragen.
 */
function buildGlyph(ch, variant, strokes) {
  const bbox = strokesBBox(strokes);
  const S = PNG_SCALE;
  const pad = Math.ceil(CAPTURE_STROKE * S * 1.5 / 2) + 2;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((bbox.x1 - bbox.x0) * S + 2 * pad));
  c.height = Math.max(1, Math.ceil((bbox.y1 - bbox.y0) * S + 2 * pad));
  const ox = pad - bbox.x0 * S;       // Pixel-x von x = 0
  const oy = pad - bbox.y0 * S;       // Pixel-y der Grundlinie
  drawStrokes(c.getContext('2d'), strokes, S, ox, oy, CAPTURE_STROKE * S, '#000');
  return {
    id: glyphId(ch, variant),
    char: ch,
    variant,
    strokes,
    bbox,
    png: c.toDataURL('image/png'),
    pngScale: S,
    pngLeft: pad,                     // Pixel-x der linken Kante der Box
    pngBaseline: oy,                  // Pixel-y der Grundlinie
    updated: Date.now(),
  };
}

/** Lädt das PNG für Glyphen ohne Striche (z. B. aus fremden Backups). */
function loadGlyphImage(g) {
  if (g.strokes?.length || !g.png || g._img) return Promise.resolve();
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { g._img = img; resolve(); };
    img.onerror = () => resolve();
    img.src = g.png;
  });
}

/**
 * Cache für eingefärbte Zeichenbilder in einer bestimmten Größe.
 * Statt für jeden Buchstaben auf der Seite alle Striche neu zu zeichnen,
 * wird jedes Zeichen pro Größe/Farbe/Dicke nur einmal gerendert.
 */
const glyphCache = new Map();

function glyphImage(g, pxPerU, color, lineW) {
  const key = `${g.id}|${g.updated}|${pxPerU.toFixed(2)}|${color}|${lineW.toFixed(2)}`;
  let hit = glyphCache.get(key);
  if (hit) return hit;
  if (glyphCache.size > 900) glyphCache.clear();

  const b = g.bbox;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  let ox, oy;

  if (g.strokes?.length) {
    const pad = Math.ceil(lineW * 1.5 / 2) + 2;
    c.width = Math.max(1, Math.ceil((b.x1 - b.x0) * pxPerU + 2 * pad));
    c.height = Math.max(1, Math.ceil((b.y1 - b.y0) * pxPerU + 2 * pad));
    ox = pad;
    oy = pad - b.y0 * pxPerU;
    drawStrokes(ctx, g.strokes, pxPerU, pad - b.x0 * pxPerU, oy, lineW, color);
  } else if (g._img) {
    // Nur PNG vorhanden: skalieren und einfärben
    const k = pxPerU / g.pngScale;
    c.width = Math.max(1, Math.ceil(g._img.width * k));
    c.height = Math.max(1, Math.ceil(g._img.height * k));
    ctx.drawImage(g._img, 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    ox = g.pngLeft * k;
    oy = g.pngBaseline * k;
  } else {
    return null;
  }

  hit = { canvas: c, ox, oy, w: (b.x1 - b.x0) * pxPerU };
  glyphCache.set(key, hit);
  return hit;
}

/* =====================================================================
   6. BEREICH 1: ERFASSEN
   ===================================================================== */

const pad = {
  canvas: null,
  ctx: null,
  cssW: 0, cssH: 0, dpr: 1,
  U: 100, baseY: 0, cx: 0,
  strokes: [],          // Striche der aktuellen Variante (in U)
  cur: null,            // Strich, der gerade gezeichnet wird
  pointerId: null,
  rect: null,
  lastP: 0.5,
  dirty: false,         // ungespeicherte Änderungen?
  penSeen: false,

  init() {
    this.canvas = $('#pad');
    this.ctx = this.canvas.getContext('2d');
    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    c.addEventListener('pointerup', e => this.up(e));
    c.addEventListener('pointercancel', e => this.up(e));
    // iOS: Lupe, Markieren und Kontextmenü auf dem Zeichenfeld unterdrücken
    for (const t of ['touchstart', 'touchmove']) c.addEventListener(t, e => e.preventDefault(), { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('selectstart', e => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe($('#pad-wrap'));
  },

  /** Größe an den verfügbaren Platz anpassen (4:3) und für Retina scharf stellen. */
  resize() {
    const wrap = $('#pad-wrap');
    const aw = wrap.clientWidth, ah = wrap.clientHeight;
    if (!aw || !ah) return;
    let w = aw, h = aw / PAD.aspect;
    if (h > ah) { h = ah; w = ah * PAD.aspect; }
    w = Math.floor(w); h = Math.floor(h);
    if (w === this.cssW && h === this.cssH && this.dpr === (window.devicePixelRatio || 1)) return;

    this.cssW = w; this.cssH = h;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.U = h * PAD.unit;
    this.baseY = h * PAD.baseline;
    this.cx = w / 2;
    this.redraw();
  },

  /** Hilfslinien: Oberlinie, Mittellinie (gestrichelt), Grundlinie, Unterlinie. */
  drawGuides() {
    const { ctx, cssW: w, cssH: h, U, baseY } = this;
    ctx.fillStyle = '#fffefb';
    ctx.fillRect(0, 0, w, h);

    const line = (y, color, width, dash, label) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#a3a9b8';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(label, 10, y - 5);
    };
    line(baseY - U, '#c9d3e8', 1.5, [], 'Oberlinie');
    line(baseY - U * PAD.xHeight, '#d5dbe8', 1, [8, 7], 'Mittellinie');
    line(baseY, '#7f97c9', 2, [], 'Grundlinie');
    line(baseY + U * PAD.descender, '#c9d3e8', 1.5, [], 'Unterlinie');
  },

  redraw() {
    if (!this.cssW) return;
    this.drawGuides();
    drawStrokes(this.ctx, this.strokes, this.U, this.cx, this.baseY, CAPTURE_STROKE * this.U, INK.blue);
    this.updateStatus();
  },

  /** Strichstil für das Live-Zeichnen setzen. */
  inkStyle() {
    const ctx = this.ctx;
    ctx.strokeStyle = ctx.fillStyle = INK.blue;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  },

  pressureOf(e) {
    if (e.pointerType !== 'pen') return 0.5;
    const p = e.pressure > 0 ? e.pressure : this.lastP;
    this.lastP = this.lastP * 0.6 + clamp(p, 0.05, 1) * 0.4;   // leicht glätten
    return this.lastP;
  },

  addPoint(e) {
    const x = (e.clientX - this.rect.left - this.cx) / this.U;
    const y = (e.clientY - this.rect.top - this.baseY) / this.U;
    const a = this.cur;
    const n = a.length / 3;
    if (n > 0) {
      // Winzige Bewegungen (< 0,5 px) überspringen
      const dx = (x - a[a.length - 3]) * this.U, dy = (y - a[a.length - 2]) * this.U;
      if (dx * dx + dy * dy < 0.25) return;
    }
    a.push(x, y, this.pressureOf(e));
    // Teilstück zeichnen, sobald der nächste Punkt bekannt ist
    if (a.length / 3 >= 2) {
      this.inkStyle();
      drawSegment(this.ctx, a, a.length / 3 - 2, this.U, this.cx, this.baseY, CAPTURE_STROKE * this.U);
    }
  },

  down(e) {
    if (this.pointerId !== null) return;                       // schon ein Finger/Stift aktiv
    if (e.pointerType === 'pen' && !this.penSeen) {
      this.penSeen = true;
      if (state.fingerDraws) {
        setFingerDraws(false);
        toast('Apple Pencil erkannt – der Finger zeichnet jetzt nicht mehr (Handballen-Schutz).', 3800);
      }
    }
    if (e.pointerType === 'touch' && !state.fingerDraws) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* nicht kritisch */ }
    this.rect = this.canvas.getBoundingClientRect();
    this.lastP = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    this.cur = [];
    this.addPoint(e);
  },

  move(e) {
    if (e.pointerId !== this.pointerId || !this.cur) return;
    e.preventDefault();
    // Coalesced Events: alle Zwischenpunkte, die der Stift seit dem letzten Frame geliefert hat
    const list = e.getCoalescedEvents?.() || [];
    for (const ev of (list.length ? list : [e])) this.addPoint(ev);
  },

  up(e) {
    if (e.pointerId !== this.pointerId) return;
    const a = this.cur;
    this.pointerId = null;
    this.cur = null;
    if (!a || !a.length) return;
    this.inkStyle();
    const n = a.length / 3;
    if (n === 1) drawDot(this.ctx, a, this.U, this.cx, this.baseY, CAPTURE_STROKE * this.U);
    else drawSegment(this.ctx, a, n - 1, this.U, this.cx, this.baseY, CAPTURE_STROKE * this.U);
    this.strokes.push(a.map(v => Math.round(v * 1000) / 1000));
    this.dirty = true;
    scheduleSave();
  },

  updateStatus(text) {
    $('#pad-status').textContent = text ?? (this.strokes.length ? '' : `Variante ${state.capVariant + 1} – noch leer`);
  },
};

function setFingerDraws(on) {
  state.fingerDraws = on;
  $('#chk-finger').checked = on;
  db.set('fingerDraws', on);
}

const scheduleSave = debounce(() => saveCurrentVariant(), 350);

/** Speichert die aktuelle Variante (oder löscht sie, wenn das Feld leer ist). */
async function saveCurrentVariant() {
  scheduleSave.cancel();
  if (!pad.dirty) return;
  pad.dirty = false;
  const ch = allChars()[state.capIndex];
  const v = state.capVariant;
  try {
    if (pad.strokes.length) {
      const g = buildGlyph(ch, v, pad.strokes.map(s => s.slice()));
      setGlyph(g);
      await db.putGlyph(g);
      pad.updateStatus('Gespeichert ✓');
    } else {
      removeGlyph(ch, v);
      await db.deleteGlyph(glyphId(ch, v));
      pad.updateStatus();
    }
  } catch (err) {
    console.error(err);
    toast('Speichern fehlgeschlagen: ' + err.message);
  }
  renderVariantButtons();
  updateCharGrid();
}

/** Wechselt zu Zeichen index / Variante v (speichert vorher). */
async function selectChar(index, v = 0) {
  await saveCurrentVariant();
  const chars = allChars();
  state.capIndex = (index + chars.length) % chars.length;
  state.capVariant = v;
  db.set('capPos', { index: state.capIndex, variant: v });
  loadVariantIntoPad();
  renderCaptureHead();
  renderVariantButtons();
  updateCharGrid(true);
}

async function selectVariant(v) {
  await saveCurrentVariant();
  state.capVariant = v;
  db.set('capPos', { index: state.capIndex, variant: v });
  loadVariantIntoPad();
  renderVariantButtons();
}

function loadVariantIntoPad() {
  const ch = allChars()[state.capIndex];
  const g = (state.glyphs.get(ch) || [])[state.capVariant];
  pad.strokes = g?.strokes ? g.strokes.map(s => s.slice()) : [];
  pad.dirty = false;
  pad.redraw();
}

function charDescription(ch) {
  if (CHAR_NAMES[ch]) return CHAR_NAMES[ch];
  if (/[a-z]/.test(ch)) return `Kleinbuchstabe ${ch}`;
  if (/[A-Z]/.test(ch)) return `Großbuchstabe ${ch}`;
  if (/[0-9]/.test(ch)) return `Ziffer ${ch}`;
  if ('äöü'.includes(ch)) return `Umlaut ${ch}`;
  if ('ÄÖÜ'.includes(ch)) return `Umlaut ${ch} (groß)`;
  return `Zeichen „${ch}“`;
}

function charHint(ch) {
  if ('gjpqy'.includes(ch)) return 'Unterlänge bis zur Unterlinie ziehen.';
  if (ch === 'ß') return 'Oberlänge bis zur Oberlinie, Unterlänge nach Gefühl.';
  if (/[a-zäöü]/.test(ch)) return 'Bauch bis zur gestrichelten Mittellinie, Oberlängen bis zur Oberlinie.';
  if (/[A-ZÄÖÜ0-9]/.test(ch)) return 'Von der Grundlinie bis zur Oberlinie.';
  if ('.,'.includes(ch)) return 'Direkt auf die Grundlinie setzen – die Höhe wird übernommen.';
  if ('"\''.includes(ch)) return 'Oben an der Oberlinie – die Höhe wird übernommen.';
  if (ch === '-') return 'Etwa auf Höhe der Mittellinie.';
  return 'An die Stelle schreiben, wo das Zeichen in der Zeile steht.';
}

function renderCaptureHead() {
  const ch = allChars()[state.capIndex];
  $('#cap-char').textContent = ch;
  $('#cap-name').textContent = charDescription(ch);
  $('#cap-hint').textContent = charHint(ch);
}

/** Drei Buttons mit Mini-Vorschau für die Varianten. */
function renderVariantButtons() {
  const box = $('#cap-variants');
  const ch = allChars()[state.capIndex];
  const arr = state.glyphs.get(ch) || [];
  if (box.children.length !== MAX_VARIANTS) {
    box.innerHTML = '';
    for (let v = 0; v < MAX_VARIANTS; v++) {
      const b = document.createElement('button');
      b.className = 'variant';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', `Variante ${v + 1}`);
      b.innerHTML = `<canvas></canvas><span class="v-label">V${v + 1}</span>`;
      b.addEventListener('click', () => selectVariant(v));
      box.appendChild(b);
    }
  }
  [...box.children].forEach((b, v) => {
    const g = arr[v];
    b.classList.toggle('is-active', v === state.capVariant);
    b.classList.toggle('has-data', !!g);
    b.setAttribute('aria-checked', v === state.capVariant);
    const c = b.querySelector('canvas');
    const dpr = window.devicePixelRatio || 1;
    const w = b.clientWidth || 76, h = b.clientHeight || 64;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const U = h * PAD.unit * 0.95, by = h * PAD.baseline;
    ctx.strokeStyle = '#d5dbe8';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(w, by); ctx.stroke();
    if (g?.strokes) drawStrokes(ctx, g.strokes, U, w / 2, by, CAPTURE_STROKE * U, INK.blue);
  });
}

/** Raster mit allen Zeichen. full=true baut es neu auf (z. B. nach neuen Eigenen Zeichen). */
function updateCharGrid(scrollToCurrent = false) {
  const grid = $('#char-grid');
  const chars = allChars();
  if (grid.dataset.count !== String(chars.length)) {
    grid.innerHTML = '';
    const groups = [...CHAR_GROUPS];
    if (state.extraChars.length) groups.push({ title: 'Eigene Zeichen', chars: state.extraChars });
    for (const grp of groups) {
      const h = document.createElement('h3');
      h.textContent = grp.title;
      grid.appendChild(h);
      for (const ch of grp.chars) {
        const b = document.createElement('button');
        b.className = 'cg';
        b.dataset.index = chars.indexOf(ch);
        b.innerHTML = `<span></span><span class="dots"></span>`;
        b.firstChild.textContent = ch;
        b.setAttribute('aria-label', charDescription(ch));
        b.addEventListener('click', () => selectChar(+b.dataset.index));
        grid.appendChild(b);
      }
    }
    grid.dataset.count = chars.length;
  }

  let done = 0;
  for (const b of $$('.cg', grid)) {
    const i = +b.dataset.index;
    const n = variantsOf(chars[i]).length;
    if (n) done++;
    b.classList.toggle('done', n > 0);
    b.classList.toggle('current', i === state.capIndex);
    b.lastChild.textContent = '●'.repeat(n);
  }
  $('#progress-text').textContent = `${done} von ${chars.length} Zeichen`;
  $('#progress-variants').textContent = `${glyphCount()} Varianten`;
  $('#progress-bar').style.width = `${(done / chars.length) * 100}%`;

  if (scrollToCurrent) {
    $(`.cg[data-index="${state.capIndex}"]`, grid)?.scrollIntoView({ block: 'nearest' });
  }
  updateBackupNote();
}

function updateBackupNote() {
  const el = $('#backup-note');
  const n = glyphCount();
  const days = state.lastBackup ? Math.floor((Date.now() - state.lastBackup) / 864e5) : null;
  if (n > 0 && (days === null || days >= 7)) {
    el.textContent = days === null
      ? 'Noch kein Backup! Safari kann Website-Daten löschen – sichere deine Handschrift als Datei.'
      : `Letztes Backup vor ${days} Tagen – Zeit für ein neues.`;
    el.classList.add('warn');
  } else {
    el.textContent = days === null
      ? 'Tipp: Sichere deine Handschrift regelmäßig als Datei.'
      : `Letztes Backup: ${days === 0 ? 'heute' : `vor ${days} Tag${days === 1 ? '' : 'en'}`}.`;
    el.classList.remove('warn');
  }
}

/* =====================================================================
   7. LAYOUT
   Wandelt den Text in eine Liste von Seiten um. Jede Seite enthält
   platzierte Zeichen { g, x, y, sc, rot } in mm (x = linke Kante,
   y = Grundlinie). Alles ist unabhängig von der Bildschirmauflösung.
   ===================================================================== */

/** Auf Karo-Papier liegt jede Zeile auf einer Karolinie (Vielfaches von 5 mm). */
function effectiveLineSpacing(s) {
  if (s.paper === 'karo' || s.paper === 'grid5') return Math.max(5, Math.round(s.lineSpacing / 5) * 5);
  return s.lineSpacing;
}

function normalizeText(t) {
  return t.normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ');
}

/** Liefert das passende erfasste Zeichen (oder ein ähnliches Ersatzzeichen). */
function resolveChar(ch) {
  if (variantsOf(ch).length) return ch;
  const alt = SIMILAR[ch];
  if (alt && variantsOf(alt).length) return alt;
  return null;
}

function computeLayout(rawText, s) {
  const text = normalizeText(rawText);
  const U = s.fontSize;
  const ls = effectiveLineSpacing(s);
  const left = PAGE.ml;
  const right = PAGE.w - PAGE.mr;
  const firstBase = PAGE.mt + ls;
  const lastBase = PAGE.h - PAGE.mb;
  const seed = s.seed | 0;

  const pages = [[]];
  const missing = new Set();
  let page = pages[0];
  let y = firstBase;
  let lineNo = 0;
  let line;            // Zufallsparameter der aktuellen Zeile
  let x;

  function startLine() {
    line = {
      x0: left + rnd2(seed, lineNo, 11) * 1.2 * s.wave,              // Zeilenanfang leicht versetzt
      phase: rnd(seed, lineNo, 12) * Math.PI * 2,
      period: 70 + rnd(seed, lineNo, 13) * 90,                        // mm
      amp: s.wave * 0.13 * U * (0.6 + 0.4 * rnd(seed, lineNo, 14)),   // mm
      slope: rnd2(seed, lineNo, 15) * s.wave * 0.006,                 // leichtes Ansteigen/Abfallen
    };
    x = line.x0;
  }
  function newLine() {
    y += ls;
    lineNo++;
    if (y > lastBase + 0.01) {
      page = [];
      pages.push(page);
      y = firstBase;
    }
    startLine();
  }
  /** y-Versatz durch wellige Zeilen an Position xx */
  const waveAt = xx => line.amp * Math.sin(line.phase + (xx - left) / line.period * Math.PI * 2) + line.slope * (xx - left);

  /** Misst ein Wort und bereitet die Zeichen vor (Positionen relativ zum Wortanfang). */
  function measureWord(word, pi, wi) {
    const items = [];
    let dx = 0;
    const lastVariant = {};
    [...word].forEach((ch, ci) => {
      const key = resolveChar(ch);
      const gap = s.letterSpacing * U + rnd2(seed, pi, wi, ci, 4) * 0.12 * U * s.jitterSpacing;
      if (!key) {
        if (ch.trim()) missing.add(ch);
        items.push({ g: null, dx, w: 0.5 * U });
        dx += 0.5 * U + gap;
        return;
      }
      const vars = variantsOf(key);
      let vi = 0;
      if (s.randomVariants && vars.length > 1) {
        vi = Math.floor(rnd(seed, pi, wi, ci, 7) * vars.length);
        if (lastVariant[key] === vi) vi = (vi + 1) % vars.length;   // „ll“, „ss“ sehen verschieden aus
        lastVariant[key] = vi;
      }
      const g = vars[vi];
      const sc = 1 + rnd2(seed, pi, wi, ci, 1) * 0.08 * s.jitterSize;
      const rot = rnd2(seed, pi, wi, ci, 2) * (5 * Math.PI / 180) * s.jitterRotate;
      const dy = rnd2(seed, pi, wi, ci, 3) * 0.04 * U * s.jitterSize;
      const w = (g.bbox.x1 - g.bbox.x0) * U * sc;
      items.push({ g, dx, w, sc, rot, dy });
      dx += w + gap;
    });
    const last = items[items.length - 1];
    return { items, width: last ? last.dx + last.w : 0 };
  }

  function place(items, offset) {
    for (const it of items) {
      const gx = x + it.dx - offset;
      page.push({ g: it.g, x: gx, y: y + (it.dy || 0) + waveAt(gx + it.w / 2), sc: it.sc || 1, rot: it.rot || 0, w: it.w });
    }
  }

  startLine();
  text.split('\n').forEach((para, pi) => {
    if (pi > 0) newLine();
    let pendingSpace = 0;
    para.split(' ').forEach((word, wi) => {
      if (wi > 0) pendingSpace += s.wordSpacing * U * (1 + rnd2(seed, pi, wi, 9) * 0.25 * s.jitterSpacing);
      if (!word) return;                                 // mehrere Leerzeichen hintereinander
      const m = measureWord(word, pi, wi);
      const atLineStart = x === line.x0;
      if (!atLineStart && x + pendingSpace + m.width > right) {
        newLine();                                       // Wort passt nicht mehr → neue Zeile
      } else if (!atLineStart) {
        x += pendingSpace;
      }
      pendingSpace = 0;

      if (x + m.width <= right || m.width <= 0) {
        place(m.items, 0);
        x += m.width;
        return;
      }
      // Wort ist länger als eine ganze Zeile → Zeichen für Zeichen umbrechen
      let offset = 0;
      for (let i = 0; i < m.items.length; i++) {
        const it = m.items[i];
        if (x + it.dx - offset + it.w > right && it.dx - offset > 0) {
          newLine();
          offset = it.dx;
        }
        place([it], offset);
      }
      const lastIt = m.items[m.items.length - 1];
      x += lastIt.dx - offset + lastIt.w;
    });
  });

  return { pages, missing, lineSpacing: ls };
}

/* =====================================================================
   8. PAPIER UND SEITEN RENDERN
   k = Pixel pro mm
   ===================================================================== */

function inkColor(s) {
  return s.color === 'custom' ? s.customColor : INK[s.color] || INK.blue;
}

function drawPaper(ctx, k, s, pageIndex) {
  const W = PAGE.w * k, H = PAGE.h * k;
  ctx.fillStyle = s.aged ? '#f4ecd6' : '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (s.aged) drawAging(ctx, k, pageIndex);

  const hLine = (y, x0, x1) => { ctx.beginPath(); ctx.moveTo(x0 * k, y * k); ctx.lineTo(x1 * k, y * k); ctx.stroke(); };
  const vLine = (x, y0, y1) => { ctx.beginPath(); ctx.moveTo(x * k, y0 * k); ctx.lineTo(x * k, y1 * k); ctx.stroke(); };
  const marginLine = (x, y0, y1) => {
    ctx.strokeStyle = 'rgba(214, 72, 72, 0.55)';
    ctx.lineWidth = Math.max(1, 0.25 * k);
    vLine(x, y0, y1);
  };

  ctx.save();
  if (s.paper === 'lined') {
    const ls = effectiveLineSpacing(s);
    ctx.strokeStyle = 'rgba(70, 110, 180, 0.42)';
    ctx.lineWidth = Math.max(1, 0.2 * k);
    for (let y = PAGE.mt + ls; y <= PAGE.h - PAGE.mb + 0.01; y += ls) hLine(y, 0, PAGE.w);
    marginLine(PAGE.ml - 4, 0, PAGE.h);
  } else if (s.paper === 'karo') {
    // Wie im Schulheft: Karos mit weißem Rand und roter Randlinie
    ctx.strokeStyle = 'rgba(60, 100, 170, 0.30)';
    ctx.lineWidth = Math.max(1, 0.15 * k);
    for (let y = 10; y <= 290; y += 5) hLine(y, 5, 205);
    for (let x = 5; x <= 205; x += 5) vLine(x, 10, 290);
    marginLine(PAGE.ml - 5, 10, 290);
  } else if (s.paper === 'grid5') {
    // Durchgehend kariert, 5 mm, ohne Rand (wie ein Block)
    ctx.strokeStyle = 'rgba(60, 100, 170, 0.30)';
    ctx.lineWidth = Math.max(1, 0.15 * k);
    for (let y = 0; y <= PAGE.h; y += 5) hLine(y, 0, PAGE.w);
    for (let x = 0; x <= PAGE.w; x += 5) vLine(x, 0, PAGE.h);
  }
  ctx.restore();
}

/** Vergilbtes Papier: dunklere Ränder, ein paar Flecken und feine Fasern. */
function drawAging(ctx, k, pageIndex) {
  const W = PAGE.w * k, H = PAGE.h * k;
  ctx.save();
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(160, 120, 50, 0)');
  g.addColorStop(1, 'rgba(160, 120, 50, 0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 4; i++) {
    const cx = rnd(pageIndex, i, 31) * W, cy = rnd(pageIndex, i, 32) * H;
    const r = (20 + rnd(pageIndex, i, 33) * 50) * k;
    const st = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    st.addColorStop(0, 'rgba(170, 130, 60, 0.07)');
    st.addColorStop(1, 'rgba(170, 130, 60, 0)');
    ctx.fillStyle = st;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 1400; i++) {
    const a = 0.03 + rnd(pageIndex, i, 35) * 0.07;
    ctx.fillStyle = `rgba(110, 80, 30, ${a.toFixed(3)})`;
    const r = (0.04 + rnd(pageIndex, i, 36) * 0.12) * k;
    ctx.fillRect(rnd(pageIndex, i, 37) * W, rnd(pageIndex, i, 38) * H, r, r);
  }
  ctx.restore();
}

/** Zeichnet eine komplette Seite (Papier + Schrift) mit k Pixel pro mm. */
function renderPage(ctx, items, pageIndex, k, s) {
  drawPaper(ctx, k, s, pageIndex);
  const color = inkColor(s);
  const pxPerU = s.fontSize * k;
  const lineW = s.thickness * k;
  for (const it of items) {
    if (!it.g) continue;
    const img = glyphImage(it.g, pxPerU, color, lineW);
    if (!img) continue;
    const half = img.w / 2;
    ctx.save();
    // Drehpunkt: Mitte des Zeichens auf der Grundlinie
    ctx.translate(it.x * k + half * it.sc, it.y * k);
    if (it.rot) ctx.rotate(it.rot);
    if (it.sc !== 1) ctx.scale(it.sc, it.sc);
    ctx.drawImage(img.canvas, -img.ox - half, -img.oy);
    ctx.restore();
  }
}

/* =====================================================================
   9. VORSCHAU
   Seiten werden nur gerendert, wenn sie (fast) sichtbar sind, und wieder
   freigegeben, wenn man weit wegscrollt – das schont den iPad-Speicher.
   ===================================================================== */

const preview = {
  layout: null,
  pages: [],        // { el, canvas, visible, dirty }
  io: null,
  queued: false,

  init() {
    this.io = new IntersectionObserver(entries => {
      for (const en of entries) {
        const p = this.pages.find(pg => pg.el === en.target);
        if (!p) continue;
        p.visible = en.isIntersecting;
        if (!p.visible && p.canvas.width > 1) {      // Speicher freigeben
          p.canvas.width = p.canvas.height = 1;
          p.dirty = true;
        }
      }
      this.queue();
    }, { root: $('#preview'), rootMargin: '800px 0px' });

    let lastW = 0;
    new ResizeObserver(() => {
      const w = $('#pages').clientWidth;
      if (w && w !== lastW) { lastW = w; this.invalidate(); }
    }).observe($('#preview'));
  },

  /** Neues Layout berechnen und Seiten anlegen/entfernen. */
  update() {
    const s = state.settings;
    this.layout = computeLayout(state.text, s);
    const n = this.layout.pages.length;
    const box = $('#pages');
    while (this.pages.length < n) {
      const el = document.createElement('div');
      el.className = 'page';
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const no = document.createElement('div');
      no.className = 'page-no';
      el.append(canvas, no);
      box.appendChild(el);
      const p = { el, canvas, no, visible: false, dirty: true };
      this.pages.push(p);
      this.io.observe(el);
    }
    while (this.pages.length > n) {
      const p = this.pages.pop();
      this.io.unobserve(p.el);
      p.el.remove();
    }
    this.pages.forEach((p, i) => { p.no.textContent = `Seite ${i + 1} von ${n}`; });
    $('#preview-empty').hidden = glyphCount() > 0;
    renderMissing(this.layout.missing);
    renderSnapNote(this.layout.lineSpacing);
    this.invalidate();
  },

  invalidate() {
    for (const p of this.pages) p.dirty = true;
    this.queue();
  },

  queue() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.renderNext(); });
  },

  /** Rendert pro Frame eine sichtbare Seite, damit die Oberfläche flüssig bleibt. */
  renderNext() {
    if (state.view !== 'compose' || !this.layout) return;
    const i = this.pages.findIndex(p => p.visible && p.dirty);
    if (i < 0) return;
    const p = this.pages[i];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = p.el.clientWidth;
    if (!cssW) return;
    p.canvas.width = Math.round(cssW * dpr);
    p.canvas.height = Math.round(cssW * dpr * PAGE.h / PAGE.w);
    const k = p.canvas.width / PAGE.w;
    renderPage(p.canvas.getContext('2d'), this.layout.pages[i], i, k, state.settings);
    p.dirty = false;
    this.queue();
  },
};

const schedulePreview = debounce(() => preview.update(), 120);

/** Hinweis auf fehlende Zeichen, mit Sprung zum Erfassen. */
function renderMissing(missing) {
  const box = $('#missing');
  if (!missing.size) { box.hidden = true; box.innerHTML = ''; return; }
  const chars = allChars();
  const known = [...missing].filter(c => chars.includes(c));
  const unknown = [...missing].filter(c => !chars.includes(c));
  box.hidden = false;
  box.innerHTML = '';

  const addRow = (label, list, isNew) => {
    if (!list.length) return;
    const p = document.createElement('div');
    p.textContent = label;
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const ch of list) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = isNew ? `+ ${ch}` : ch;
      b.setAttribute('aria-label', `${ch} erfassen`);
      b.addEventListener('click', async () => {
        if (isNew) {
          state.extraChars.push(ch);
          await db.set('extraChars', state.extraChars);
        }
        switchView('capture');
        selectChar(allChars().indexOf(ch));
      });
      chips.appendChild(b);
    }
    box.append(p, chips);
  };
  addRow('Diese Zeichen fehlen noch (bleiben frei) – zum Erfassen antippen:', known, false);
  addRow('Nicht im Zeichensatz – als eigenes Zeichen hinzufügen:', unknown, true);
}

function renderSnapNote(ls) {
  const note = $('#snap-note');
  const snapped = ls !== state.settings.lineSpacing;
  note.hidden = !snapped;
  if (snapped) note.textContent = `Auf Karopapier liegt jede Zeile auf einer Linie: Zeilenabstand ${fmtNum(ls)} mm.`;
}

/* =====================================================================
   10. EXPORT UND BACKUP
   ===================================================================== */

/** Rendert alle Seiten nacheinander in Exportauflösung und ruft onPage für jede auf. */
async function renderAllPages(kind, onPage) {
  const s = state.settings;
  const layout = computeLayout(state.text, s);
  const k = EXPORT_DPI / 25.4;
  const n = layout.pages.length;
  for (let i = 0; i < n; i++) {
    showBusy(`${kind}: Seite ${i + 1} von ${n} …`);
    await nextFrame();
    const c = document.createElement('canvas');
    c.width = Math.round(PAGE.w * k);
    c.height = Math.round(PAGE.h * k);
    renderPage(c.getContext('2d'), layout.pages[i], i, k, s);
    await onPage(c, i, n);
    c.width = c.height = 0;          // Speicher sofort freigeben (wichtig auf dem iPad)
  }
  return n;
}

function checkReady() {
  if (!glyphCount()) { toast('Erfasse zuerst ein paar Zeichen in Bereich 1.'); return false; }
  if (!normalizeText(state.text).trim()) { toast('Tippe zuerst einen Text ein.'); return false; }
  return true;
}

async function exportPDF() {
  if (!checkReady()) return;
  if (!window.jspdf?.jsPDF) { toast('Die PDF-Bibliothek konnte nicht geladen werden.'); return; }
  try {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    doc.setProperties({ title: 'Handschrift', creator: 'Meine Handschrift' });
    const n = await renderAllPages('PDF', (c, i) => {
      if (i > 0) doc.addPage('a4', 'portrait');
      doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE.w, PAGE.h, undefined, 'FAST');
    });
    showBusy('PDF wird gespeichert …');
    await nextFrame();
    const blob = doc.output('blob');
    const file = new File([blob], `Handschrift_${dateStamp()}.pdf`, { type: 'application/pdf' });
    hideBusy();
    openFileDialog({
      files: [file],
      title: 'PDF ist fertig',
      text: `${n} Seite${n === 1 ? '' : 'n'} · ${formatBytes(file.size)}. Über „Teilen / Sichern“ kannst du sie in „Dateien“ sichern, drucken oder verschicken.`,
    });
  } catch (err) {
    console.error(err);
    hideBusy();
    toast('PDF-Export fehlgeschlagen: ' + err.message);
  }
}

async function exportPNG() {
  if (!checkReady()) return;
  try {
    const files = [];
    const stamp = dateStamp();
    const n = await renderAllPages('PNG', async (c, i, total) => {
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const suffix = total > 1 ? `_Seite-${i + 1}` : '';
      files.push(new File([blob], `Handschrift_${stamp}${suffix}.png`, { type: 'image/png' }));
    });
    hideBusy();
    const size = files.reduce((a, f) => a + f.size, 0);
    openFileDialog({
      files,
      title: n === 1 ? 'Bild ist fertig' : `${n} Bilder sind fertig`,
      text: `${formatBytes(size)}. „Teilen / Sichern“ → „Bild sichern“ legt es in deine Fotos, „In Dateien sichern“ in die Dateien-App.`,
    });
  } catch (err) {
    console.error(err);
    hideBusy();
    toast('PNG-Export fehlgeschlagen: ' + err.message);
  }
}

/** Backup: alle Zeichen (Striche + PNG) und Einstellungen als JSON-Datei. */
async function exportBackup() {
  await saveCurrentVariant();
  const glyphs = [];
  for (const arr of state.glyphs.values()) {
    for (const g of arr) {
      if (!g) continue;
      const { char, variant, strokes, bbox, png, pngScale, pngLeft, pngBaseline } = g;
      glyphs.push({ char, variant, strokes, bbox, png, pngScale, pngLeft, pngBaseline });
    }
  }
  if (!glyphs.length) { toast('Es gibt noch keine Zeichen zum Sichern.'); return; }
  const data = {
    app: 'meine-handschrift',
    format: 1,
    exportedAt: new Date().toISOString(),
    unit: 'Koordinaten in U: 1 U = Grundlinie bis Oberlinie, y nach unten, 0 = Grundlinie',
    extraChars: state.extraChars,
    settings: state.settings,
    glyphs,
  };
  const file = new File([JSON.stringify(data)], `Handschrift-Backup_${dateStamp()}.json`, { type: 'application/json' });
  openFileDialog({
    files: [file],
    title: 'Backup ist fertig',
    text: `${glyphs.length} Varianten · ${formatBytes(file.size)}. Wähle „Teilen / Sichern“ → „In Dateien sichern“ (z. B. iCloud Drive).`,
    onSaved: () => {
      state.lastBackup = Date.now();
      db.set('lastBackup', state.lastBackup);
      updateBackupNote();
    },
  });
}

/** Prüft ein Strich-Array aus einer fremden Datei. */
function cleanStrokes(strokes) {
  if (!Array.isArray(strokes)) return null;
  const out = strokes
    .filter(a => Array.isArray(a) && a.length >= 3 && a.length % 3 === 0 && a.every(Number.isFinite))
    .map(a => a.map((v, i) => (i % 3 === 2 ? clamp(v, 0, 1) : clamp(v, -20, 20))));
  return out.length ? out : null;
}

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('Die Datei ist kein gültiges Backup (kein JSON).');
    return;
  }
  if (data?.app !== 'meine-handschrift' || !Array.isArray(data.glyphs)) {
    toast('Das ist kein Backup von „Meine Handschrift“.');
    return;
  }

  const incoming = [];
  for (const raw of data.glyphs) {
    const ch = typeof raw?.char === 'string' ? [...raw.char.normalize('NFC')][0] : null;
    const v = Number(raw?.variant);
    if (!ch || !(v >= 0 && v < MAX_VARIANTS)) continue;
    const strokes = cleanStrokes(raw.strokes);
    if (strokes) {
      incoming.push(buildGlyph(ch, v, strokes));
    } else if (typeof raw.png === 'string' && raw.png.startsWith('data:image/png') && raw.bbox && raw.pngScale > 0) {
      incoming.push({
        id: glyphId(ch, v), char: ch, variant: v, strokes: null, bbox: raw.bbox, png: raw.png,
        pngScale: raw.pngScale, pngLeft: raw.pngLeft || 0, pngBaseline: raw.pngBaseline || 0, updated: Date.now(),
      });
    }
  }
  if (!incoming.length) { toast('Im Backup wurden keine Zeichen gefunden.'); return; }

  const replaceAll = glyphCount() > 0 && confirm(
    `Das Backup enthält ${incoming.length} Varianten.\n\n` +
    `OK = Alles ersetzen (aktuelle Zeichen werden gelöscht)\n` +
    `Abbrechen = Zusammenführen (gleiche Zeichen-Varianten werden überschrieben)`);

  showBusy('Backup wird geladen …');
  try {
    await saveCurrentVariant();
    if (replaceAll) { await db.clearGlyphs(); state.glyphs.clear(); }
    for (const g of incoming) {
      await loadGlyphImage(g);
      setGlyph(g);
      await db.putGlyph(g);
    }
    // Eigene Zeichen aus dem Backup übernehmen
    for (const g of incoming) {
      if (!allChars().includes(g.char)) state.extraChars.push(g.char);
    }
    await db.set('extraChars', state.extraChars);
    glyphCache.clear();
    hideBusy();
    toast(`${incoming.length} Varianten geladen ✓`);
  } catch (err) {
    hideBusy();
    toast('Import fehlgeschlagen: ' + err.message);
  }
  updateCharGrid();
  loadVariantIntoPad();
  renderVariantButtons();
  schedulePreview();
}

async function wipeAll() {
  if (!confirm('Wirklich ALLE erfassten Zeichen löschen? Das kann nicht rückgängig gemacht werden.\n\nTipp: Mach vorher ein Backup.')) return;
  pad.dirty = false;
  await db.clearGlyphs();
  state.glyphs.clear();
  state.extraChars = [];
  await db.set('extraChars', []);
  glyphCache.clear();
  await selectChar(0, 0);
  toast('Alle Zeichen gelöscht.');
}

/* =====================================================================
   11. EINSTELLUNGEN-OBERFLÄCHE
   ===================================================================== */

function formatSetting(el, v) {
  const unit = el.dataset.unit;
  if (unit === '%') return `${Math.round(v * 100)} %`;
  return `${fmtNum(v, 2)} ${unit}`;
}

/** Baut die Schieberegler aus den data-Attributen im HTML. */
function buildRanges() {
  for (const el of $$('.field.range')) {
    const key = el.dataset.key;
    const id = `rng-${key}`;
    el.innerHTML = `
      <label class="field-label" for="${id}">${el.dataset.label}<output></output></label>
      <input type="range" id="${id}" min="${el.dataset.min}" max="${el.dataset.max}" step="${el.dataset.step}">`;
    const input = $('input', el);
    const out = $('output', el);
    input.addEventListener('input', () => {
      state.settings[key] = parseFloat(input.value);
      out.textContent = formatSetting(el, state.settings[key]);
      saveSettings();
      schedulePreview();
    });
  }
}

/** Überträgt die gespeicherten Einstellungen in die Bedienelemente. */
function syncSettingsUI() {
  const s = state.settings;
  for (const el of $$('.field.range')) {
    const input = $('input', el);
    input.value = s[el.dataset.key];
    $('output', el).textContent = formatSetting(el, s[el.dataset.key]);
  }
  for (const b of $$('#seg-color button')) b.classList.toggle('is-active', b.dataset.value === s.color);
  for (const b of $$('#seg-paper button')) b.classList.toggle('is-active', b.dataset.value === s.paper);
  $('#color-custom').value = s.customColor;
  $('#color-custom').hidden = s.color !== 'custom';
  $('#swatch-custom').style.background = s.customColor;
  $('#chk-variants').checked = s.randomVariants;
  $('#chk-aged').checked = s.aged;
}

function changeSetting(key, value) {
  state.settings[key] = value;
  syncSettingsUI();
  saveSettings();
  schedulePreview();
}

function switchView(view) {
  state.view = view;
  for (const t of $$('.tab')) {
    const on = t.dataset.view === view;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on);
  }
  $('#view-capture').classList.toggle('is-active', view === 'capture');
  $('#view-compose').classList.toggle('is-active', view === 'compose');
  if (view === 'capture') {
    requestAnimationFrame(() => { pad.resize(); renderVariantButtons(); });
  } else {
    saveCurrentVariant().then(() => preview.update());
  }
}

function bindUI() {
  // Bereiche wechseln
  for (const t of $$('.tab')) t.addEventListener('click', () => switchView(t.dataset.view));

  // Erfassen
  $('#btn-next').addEventListener('click', () => selectChar(state.capIndex + 1));
  $('#btn-prev').addEventListener('click', () => selectChar(state.capIndex - 1));
  $('#btn-undo').addEventListener('click', () => {
    if (!pad.strokes.length) return;
    pad.strokes.pop();
    pad.dirty = true;
    pad.redraw();
    scheduleSave();
  });
  $('#btn-clear').addEventListener('click', () => {
    if (!pad.strokes.length) return;
    pad.strokes = [];
    pad.dirty = true;
    pad.redraw();
    saveCurrentVariant();
  });
  $('#chk-finger').addEventListener('change', e => setFingerDraws(e.target.checked));

  // Backup
  $('#btn-export-json').addEventListener('click', exportBackup);
  $('#btn-import-json').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) importBackup(f);
  });
  $('#btn-wipe').addEventListener('click', wipeAll);

  // Text
  const ta = $('#text-input');
  ta.value = state.text;
  ta.addEventListener('input', () => {
    state.text = ta.value;
    saveText();
    schedulePreview();
  });

  // Einstellungen
  buildRanges();
  for (const b of $$('#seg-color button')) b.addEventListener('click', () => changeSetting('color', b.dataset.value));
  for (const b of $$('#seg-paper button')) b.addEventListener('click', () => changeSetting('paper', b.dataset.value));
  $('#color-custom').addEventListener('input', e => changeSetting('customColor', e.target.value));
  $('#chk-variants').addEventListener('change', e => changeSetting('randomVariants', e.target.checked));
  $('#chk-aged').addEventListener('change', e => changeSetting('aged', e.target.checked));
  $('#btn-reseed').addEventListener('click', () => changeSetting('seed', Math.floor(Math.random() * 1e9)));
  $('#btn-reset-settings').addEventListener('click', () => {
    if (!confirm('Alle Einstellungen auf Standard zurücksetzen? (Text und Zeichen bleiben erhalten.)')) return;
    state.settings = { ...DEFAULT_SETTINGS };
    syncSettingsUI();
    saveSettings();
    schedulePreview();
  });

  // Export
  $('#btn-pdf').addEventListener('click', exportPDF);
  $('#btn-png').addEventListener('click', exportPNG);

  // Vor dem Schließen/Wechseln der App ungespeicherte Striche sichern
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveCurrentVariant(); });
  window.addEventListener('pagehide', () => saveCurrentVariant());

  // iOS: Pinch-Zoom der ganzen Seite verhindern
  document.addEventListener('gesturestart', e => e.preventDefault());
}

/* =====================================================================
   12. START
   ===================================================================== */

async function loadState() {
  const [glyphs, settings, text, capPos, extra, finger, lastBackup] = await Promise.all([
    db.allGlyphs(), db.get('settings'), db.get('text'), db.get('capPos'),
    db.get('extraChars'), db.get('fingerDraws'), db.get('lastBackup'),
  ]);
  state.extraChars = Array.isArray(extra) ? extra : [];
  for (const g of glyphs) {
    await loadGlyphImage(g);
    setGlyph(g);
  }
  state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  if (typeof text === 'string') state.text = text;
  if (typeof finger === 'boolean') state.fingerDraws = finger;
  if (lastBackup) state.lastBackup = lastBackup;
  if (capPos) {
    state.capIndex = clamp(capPos.index | 0, 0, allChars().length - 1);
    state.capVariant = clamp(capPos.variant | 0, 0, MAX_VARIANTS - 1);
  }
}

async function start() {
  try {
    await loadState();
  } catch (err) {
    console.error(err);
    toast('Speicher nicht verfügbar – Daten werden nicht gesichert. (Privater Modus?)', 5000);
  }

  // Den Browser bitten, die Daten nicht automatisch zu löschen
  navigator.storage?.persist?.().catch(() => {});

  bindUI();
  syncSettingsUI();
  $('#chk-finger').checked = state.fingerDraws;
  pad.init();
  preview.init();
  renderCaptureHead();
  loadVariantIntoPad();
  renderVariantButtons();
  updateCharGrid(true);
  preview.update();

  // Service Worker für Offline-Nutzung (nur über https oder localhost)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker:', err));
  }
}

// Schnittstelle für automatische Tests (wird von der App selbst nicht benutzt)
window.__handschrift = { state, buildGlyph, setGlyph, db, computeLayout, preview, selectChar, glyphCount };

start();
