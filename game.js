/* =====================================================================
   Heft-Metro – game.js
   ---------------------------------------------------------------------
   Ein Verkehrs-Planungsspiel im Schulheft-Look, gemacht für das iPad:
   Vom Hauptbahnhof aus baust du Bus-, Tram-, U-Bahn- und Zugstrecken.
   Design-Regeln: .claude/skills/heft-metro-design/SKILL.md

   Aufbau:
     1. Konstanten
     2. Hilfsfunktionen
     3. Spielzustand
     4. Netz und Wegfindung
     5. Simulation (Zeit, Stationen, Fahrgäste, Züge)
     6. Kamera
     7. Zeichnen
     8. Eingabe (Stift und Finger)
     9. HUD und Bildschirme
        Tutorial
    10. Start

   Koordinaten: Die Spielwelt rechnet in „Kästchen“ (U). (0|0) ist die
   Stadtmitte. Die Kamera rechnet Welt → Bildschirm um.
   ===================================================================== */
'use strict';

/* =====================================================================
   1. KONSTANTEN
   ===================================================================== */

/** Farben – identisch mit den Tokens im Design-Skill */
const COLORS = {
  paper: '#fbfaf6',
  grid: 'rgba(60, 100, 170, 0.16)',
  pencil: '#2b2b2b',
  danger: '#d0342c',
};
/** Filzstift-Farben der Linien, feste Reihenfolge */
const LINE_COLORS = ['#d23b2f', '#2456c9', '#2f9e4f', '#ef8a17', '#8a3fb8', '#1199a8', '#8b5a2b', '#d81b7a', '#6d7f12', '#1f3a7a'];

const COMMON_SHAPES = ['circle', 'triangle', 'square'];
const RARE_SHAPES = ['star', 'diamond', 'cross'];
const ALL_SHAPES = ['hub', ...COMMON_SHAPES, ...RARE_SHAPES];
const SHAPE_NAME = {
  circle: 'Kreis', triangle: 'Dreieck', square: 'Quadrat',
  star: 'Stern', diamond: 'Rauten', cross: 'Kreuz', hub: 'Hauptbahnhof',
};

/**
 * Die vier Verkehrsmittel. Jedes fährt anders:
 *   speed  Tempo in U pro Sekunde     cap      Plätze
 *   dwell  Grund-Haltezeit (s)        perPax   Sekunden pro ein-/aussteigendem Fahrgast
 *   maxStops  Haltestellen pro Linie  maxLines Linien höchstens (durch Upgrades)
 *   needsHub  Linie muss am Hauptbahnhof beginnen
 */
const MODES = {
  bus: {
    name: 'Bus', vehicle: 'Bus', lineName: 'Buslinie', none: 'Kein Bus frei',
    speed: 1.6, cap: 4, dwell: 0.25, perPax: 0.15, maxStops: 6, maxLines: 3, startLines: 2, startVehicles: 3,
    body: { w: 0.8, h: 0.46, parts: 1 },
    icon: '<rect x="4.5" y="4" width="15" height="13" rx="3"/><path d="M4.5 11h15M8 20.5v-3.5M16 20.5v-3.5"/>',
  },
  tram: {
    name: 'Tram', vehicle: 'Tram', lineName: 'Tramlinie', none: 'Keine Tram frei',
    speed: 2.2, cap: 6, dwell: 0.2, perPax: 0.07, maxStops: 8, maxLines: 3, startLines: 1, startVehicles: 1,
    body: { w: 1.35, h: 0.36, parts: 2 },
    icon: '<rect x="5" y="7.5" width="14" height="10.5" rx="3"/><path d="M9 3h6M12 3v4.5M5 13h14M8 21l1.5-3M16 21l-1.5-3"/>',
  },
  metro: {
    name: 'U-Bahn', vehicle: 'U-Bahn', lineName: 'U-Bahn-Linie', none: 'Keine U-Bahn frei',
    speed: 2.8, cap: 6, dwell: 0.3, perPax: 0.12, maxStops: 99, maxLines: 3, startLines: 1, startVehicles: 1,
    body: { w: 1.0, h: 0.5, parts: 1 },
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M8.7 7.8v4.7a3.3 3.3 0 0 0 6.6 0V7.8"/>',
  },
  rail: {
    name: 'Zug', vehicle: 'Zug', lineName: 'Zugstrecke', none: 'Kein Zug frei',
    speed: 3.8, cap: 10, dwell: 0.9, perPax: 0.08, maxStops: 5, maxLines: 2, startLines: 1, startVehicles: 1, needsHub: true,
    body: { w: 1.75, h: 0.46, parts: 2 },
    icon: '<path d="M6.5 18V8.5a4.5 4.5 0 0 1 4.5-4.5h2a4.5 4.5 0 0 1 4.5 4.5V18z"/><path d="M6.5 12.5h11M8 21.5l1.5-3.5M16 21.5l-1.5-3.5"/>',
  },
};
const MODE_ORDER = ['bus', 'tram', 'metro', 'rail'];
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Spiel-Balance – hier lässt sich alles feinjustieren */
const CFG = {
  dayLength: 12,          // Sekunden pro Spieltag (1 Woche = 7 Tage)
  stationR: 0.55,         // Radius einer Station in U
  capacity: 6,            // Fahrgäste, ab denen eine Station überfüllt ist
  bigCapacity: 12,        // … beim großen Bahnhof
  hubCapacity: 18,        // … am Hauptbahnhof
  hubR: 0.9,              // Radius des Hauptbahnhofs in U
  hubShare: 0.22,         // Anteil der Fahrgäste, die zum Hauptbahnhof wollen
  overcrowdTime: 40,      // Sekunden Überfüllung bis Game Over
  recoverTime: 80,        // Sekunden, bis sich der Timer wieder ganz erholt
  minStationDist: 3.6,    // Mindestabstand neuer Stationen (größer = übersichtlicher)
  minLineDist: 1.3,       // Mindestabstand neuer Stationen zu bestehenden Linien
  maxCity: 28,            // maximale halbe Stadtbreite in U
  lineWidth: 0.30,        // Filzstift-Breite in U
  lineGap: 0.38,          // Abstand paralleler Linien
};

/* =====================================================================
   2. HILFSFUNKTIONEN
   ===================================================================== */

const $ = sel => document.querySelector(sel);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const smooth = t => t * t * (3 - 2 * t);

/** Deterministischer Zufall 0…1 – damit das Wackeln der Striche nicht flimmert. */
function hash(...keys) {
  let h = 0x9e3779b9;
  for (const k of keys) {
    h = Math.imul(h ^ (k | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** Abstand eines Punkts zu einer Strecke */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** Rekord lokal merken (nur Komfort – darf fehlen, z. B. im privaten Modus) */
const best = {
  get() { try { return +localStorage.getItem('heftmetro.best') || 0; } catch { return 0; } },
  set(v) { try { localStorage.setItem('heftmetro.best', String(v)); } catch { /* egal */ } },
};

/* =====================================================================
   3. SPIELZUSTAND
   ===================================================================== */

/** @type {any} Der komplette Zustand einer Runde */
let G;

function newGame() {
  G = {
    state: 'start',        // start | playing | upgrade | placeBig | over
    speed: 1,              // 0 = Pause, 1 = normal, 2 = schnell
    t: 0,                  // Spielzeit in Sekunden
    week: 1,
    score: 0,
    nextId: 1,
    stations: [],
    lines: [],
    trains: [],
    // Pro Verkehrsmittel: freie Linien-Plätze und freie Fahrzeuge
    inv: Object.fromEntries(MODE_ORDER.map(m => [m, { lines: MODES[m].startLines, free: MODES[m].startVehicles }])),
    selectedMode: 'bus',   // womit neue Linien gezogen werden
    bounds: { hw: 9, hh: 6 },   // halbe Breite/Höhe der Stadt in U
    stationTimer: 10,
    dist: new Map(),       // Form → Map(Station-ID → Anzahl Haltestellen bis dorthin)
    handles: [],           // Linienenden zum Anfassen (pro Bild neu berechnet)
    lostStation: null,
    resumeState: null,     // Zustand, zu dem „Weiterspielen“ zurückkehrt
    tutorial: false,       // läuft gerade die Anleitung?
  };
  // Hauptbahnhof in der Mitte, drei Stationen im Kreis darum
  addStation('hub', 0, 0);
  const a0 = rand(0, Math.PI * 2);
  COMMON_SHAPES.forEach((shape, i) => {
    const a = a0 + (i * Math.PI * 2) / 3 + rand(-0.3, 0.3), r = rand(6, 7.5);
    addStation(shape, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * 0.8));
  });
  for (const st of G.stations) st.born = -10;   // Startstationen sind sofort da (kein Aufploppen)
  rebuildRoutes();
}

const stationById = id => G.stations.find(s => s.id === id);
const hub = () => G.stations.find(s => s.shape === 'hub');
/** Radius einer Station in U (Hauptbahnhof ist größer) */
const stationR = st => (st.shape === 'hub' ? CFG.hubR : CFG.stationR);
const capacityOf = st => (st.shape === 'hub' ? CFG.hubCapacity : st.big ? CFG.bigCapacity : CFG.capacity);
const vehiclesOn = line => G.trains.filter(t => t.line === line).length;
const linesOf = mode => G.lines.filter(l => l.mode === mode);

function addStation(shape, x, y) {
  const st = { id: G.nextId++, x, y, shape, queue: [], over: 0, big: false, born: G.t, flash: 0 };
  G.stations.push(st);
  return st;
}

/* =====================================================================
   4. NETZ UND WEGFINDUNG
   Für jede Form wird berechnet, wie viele Haltestellen jede Station von
   der nächsten Station dieser Form entfernt ist (Breitensuche vom Ziel aus).
   Ein Fahrgast steigt in einen Zug, wenn ihn die nächste Haltestelle
   seinem Ziel näher bringt – so entstehen Umstiege ganz von allein.
   ===================================================================== */

function rebuildRoutes() {
  const adj = new Map(G.stations.map(s => [s.id, []]));
  for (const line of G.lines) {
    for (let i = 0; i < line.stations.length - 1; i++) {
      const a = line.stations[i], b = line.stations[i + 1];
      adj.get(a)?.push(b);
      adj.get(b)?.push(a);
    }
  }
  G.dist = new Map();
  const shapes = new Set(G.stations.map(s => s.shape));
  for (const shape of shapes) {
    const d = new Map();
    const queue = [];
    for (const s of G.stations) if (s.shape === shape) { d.set(s.id, 0); queue.push(s.id); }
    for (let qi = 0; qi < queue.length; qi++) {
      const id = queue[qi];
      for (const n of adj.get(id) || []) {
        if (!d.has(n)) { d.set(n, d.get(id) + 1); queue.push(n); }
      }
    }
    G.dist.set(shape, d);
  }
}

/** Haltestellen bis zum Ziel (Infinity = nicht erreichbar) */
const hops = (shape, stationId) => G.dist.get(shape)?.get(stationId) ?? Infinity;

/** Nächste Station, wenn ein Zug von a nach b fährt (am Linienende kehrt er um). */
function nextStop(line, a, b) {
  const s = line.stations;
  const ia = s.indexOf(a), ib = s.indexOf(b);
  const dir = ib > ia ? 1 : -1;
  return s[ib + dir] ?? s[ib - dir] ?? b;
}

/** Versatz paralleler Linien auf demselben Abschnitt (in U, senkrecht zur Strecke). */
function segmentOffset(line, a, b) {
  const shared = G.lines.filter(l => {
    const i = l.stations.indexOf(a), j = l.stations.indexOf(b);
    return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
  });
  if (shared.length < 2) return { ox: 0, oy: 0 };
  shared.sort((p, q) => p.color - q.color);
  const k = shared.indexOf(line) - (shared.length - 1) / 2;
  // Normale immer von der kleineren zur größeren ID gerechnet, damit alle Linien sich einig sind
  const [p, q] = a < b ? [stationById(a), stationById(b)] : [stationById(b), stationById(a)];
  const len = dist(p.x, p.y, q.x, q.y) || 1;
  return { ox: (-(q.y - p.y) / len) * k * CFG.lineGap, oy: ((q.x - p.x) / len) * k * CFG.lineGap };
}

/* ---------- Linien bearbeiten ---------- */

function freeColor() {
  for (let c = 0; c < LINE_COLORS.length; c++) if (!G.lines.some(l => l.color === c)) return c;
  return -1;
}

/** Ist für dieses Verkehrsmittel noch ein Linien-Platz frei? */
const canCreateLine = mode => linesOf(mode).length < G.inv[mode].lines && freeColor() >= 0;

function createLine(stationIds, color, mode) {
  const line = { id: G.nextId++, color, mode, stations: stationIds.slice() };
  G.lines.push(line);
  rebuildRoutes();
  if (G.inv[mode].free > 0) addTrain(line);
  else toast(`${MODES[mode].none} – die Linie wartet auf das nächste Fahrzeug.`);
  hideHint();
  return line;
}

function deleteLine(line) {
  for (const tr of G.trains.filter(t => t.line === line)) removeTrain(tr);
  G.lines = G.lines.filter(l => l !== line);
  rebuildRoutes();
}

function addTrain(line) {
  const inv = G.inv[line.mode];
  if (inv.free <= 0 || line.stations.length < 2) return false;
  inv.free--;
  G.trains.push({ id: G.nextId++, line, a: line.stations[0], b: line.stations[1], t: 0, dwell: 0.4, pax: [] });
  return true;
}

/** Zug abziehen – Fahrgäste steigen an der nächsten Station aus. */
function removeTrain(tr) {
  const st = stationById(tr.b) || stationById(tr.a);
  for (const p of tr.pax) {
    if (st && p === st.shape) G.score++;
    else st?.queue.push(p);
  }
  G.trains = G.trains.filter(t => t !== tr);
  G.inv[tr.line.mode].free++;
}

/** Nach einer Änderung an der Linie: Züge auf gültige Abschnitte setzen. */
function syncTrains(line) {
  const s = line.stations;
  for (const tr of G.trains) {
    if (tr.line !== line || s.length < 2) continue;
    const ia = s.indexOf(tr.a), ib = s.indexOf(tr.b);
    if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1) continue;     // Abschnitt gibt es noch
    const k = ib >= 0 ? ib : ia >= 0 ? ia : 0;
    tr.a = s[k];
    tr.b = s[k + 1] ?? s[k - 1];
    tr.t = 0;
    tr.dwell = Math.max(tr.dwell, 0.2);
  }
}

/* =====================================================================
   5. SIMULATION
   ===================================================================== */

/** Die Stadt wächst mit der Zeit; ihr Seitenverhältnis folgt dem Bildschirm. */
function updateBounds() {
  const v = view();
  const hw = Math.min(CFG.maxCity, 9 + G.t / 22);
  G.bounds.hw = hw;
  G.bounds.hh = hw * clamp(v.h / v.w, 0.55, 1.6);
}

function pickShape() {
  if (G.week >= 2 && Math.random() < 0.1) {
    const rare = RARE_SHAPES.filter(r => !G.stations.some(s => s.shape === r));
    if (rare.length) return rare[Math.floor(Math.random() * rare.length)];
  }
  const r = Math.random();
  return r < 0.5 ? 'circle' : r < 0.8 ? 'triangle' : 'square';
}

/** Neue Station an einem freien Kreuzungspunkt des Karos. */
function spawnStation() {
  const { hw, hh } = G.bounds;
  for (let tries = 0; tries < 80; tries++) {
    const x = Math.round(rand(-hw + 1, hw - 1));
    const y = Math.round(rand(-hh + 1, hh - 1));
    if (G.stations.some(s => dist(s.x, s.y, x, y) < CFG.minStationDist + (s.shape === 'hub' ? 1.2 : 0))) continue;
    const onLine = G.lines.some(l => l.stations.some((id, i) => {
      const nId = l.stations[i + 1];
      if (!nId) return false;
      const a = stationById(id), b = stationById(nId);
      return distToSegment(x, y, a.x, a.y, b.x, b.y) < CFG.minLineDist;
    }));
    if (onLine) continue;
    addStation(pickShape(), x, y);
    rebuildRoutes();
    return;
  }
}

/** Zielform für einen neuen Fahrgast (nicht die eigene, häufige Formen öfter, oft der Hauptbahnhof). */
function pickDestination(own) {
  if (own !== 'hub' && Math.random() < CFG.hubShare) return 'hub';
  const counts = {};
  for (const s of G.stations) if (s.shape !== own && s.shape !== 'hub') counts[s.shape] = (counts[s.shape] || 0) + 1;
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  const total = entries.reduce((a, [, n]) => a + Math.sqrt(n), 0);
  let r = Math.random() * total;
  for (const [shape, n] of entries) { r -= Math.sqrt(n); if (r <= 0) return shape; }
  return entries[0][0];
}

function update(dt) {
  // Tutorial: nur die Fahrzeuge bewegen – keine Zeit, keine neuen Stationen, keine Überfüllung
  if (G.tutorial) {
    for (const st of G.stations) st.flash = Math.max(0, st.flash - dt);
    updateVehicles(dt);
    return;
  }
  G.t += dt;
  updateBounds();

  // Wochenwechsel → Upgrade wählen
  const week = Math.floor(G.t / (CFG.dayLength * 7)) + 1;
  if (week > G.week) {
    G.week = week;
    G.inv.bus.free++;                 // jede Woche ein Bus geschenkt
    showUpgrade();
    return;
  }

  // Neue Stationen
  G.stationTimer -= dt;
  if (G.stationTimer <= 0) {
    spawnStation();
    G.stationTimer = Math.max(11, 23 - G.week) * rand(0.85, 1.15);   // nicht zu viele Stationen
  }

  // Neue Fahrgäste und Überfüllung
  const rate = Math.min(0.35, 0.05 + 0.015 * G.week + G.t * 0.0004);
  for (const st of G.stations) {
    const stRate = st.shape === 'hub' ? rate * 1.6 : rate;    // am Hauptbahnhof ist mehr los
    if (G.t - st.born > 3 && Math.random() < stRate * dt) {
      const dest = pickDestination(st.shape);
      if (dest) st.queue.push(dest);
    }
    if (st.queue.length > capacityOf(st)) st.over += dt / CFG.overcrowdTime;
    else st.over = Math.max(0, st.over - dt / CFG.recoverTime);
    st.flash = Math.max(0, st.flash - dt);
    if (st.over >= 1) { gameOver(st); return; }
  }
  updateVehicles(dt);
}

/** Alle Fahrzeuge ein Stück weiterbewegen */
function updateVehicles(dt) {
  for (const tr of G.trains) {
    const line = tr.line;
    if (line.stations.length < 2) continue;          // Linie wird gerade umgebaut
    if (tr.dwell > 0) {
      tr.dwell -= dt;
      if (tr.dwell <= 0) {
        const n = nextStop(line, tr.a, tr.b);
        tr.a = tr.b;
        tr.b = n;
        tr.t = 0;
      }
      continue;
    }
    const A = stationById(tr.a), B = stationById(tr.b);
    const len = Math.max(0.1, dist(A.x, A.y, B.x, B.y));
    tr.t += (MODES[line.mode].speed * dt) / len;
    if (tr.t >= 1) { tr.t = 1; arrive(tr); }
  }
}

/** Fahrzeug hält an Station b: aussteigen, umsteigen, einsteigen. */
function arrive(tr) {
  const st = stationById(tr.b);
  const mode = MODES[tr.line.mode];
  const next = nextStop(tr.line, tr.a, tr.b);
  let moved = 0;

  tr.pax = tr.pax.filter(p => {
    if (p === st.shape) { G.score++; moved++; st.flash = 0.35; return false; }   // angekommen
    const here = hops(p, st.id), there = hops(p, next);
    if (there < here || here === Infinity) return true;                          // bleibt sitzen
    st.queue.push(p);                                                            // steigt um
    moved++;
    return false;
  });

  for (let i = 0; i < st.queue.length && tr.pax.length < mode.cap;) {
    const p = st.queue[i];
    if (hops(p, next) < hops(p, st.id)) {
      tr.pax.push(p);
      st.queue.splice(i, 1);
      moved++;
    } else {
      i++;
    }
  }
  tr.dwell = mode.dwell + mode.perPax * moved;
}

/* =====================================================================
   6. KAMERA
   Passt die ganze Stadt in den freien Bereich zwischen Status oben und
   Stiften unten ein und zoomt weich heraus, wenn die Stadt wächst.
   ===================================================================== */

const cam = { s: 50, x: 0, y: 0, ready: false };
let bottomInset = 96;     // Höhe der Leiste unten (kann im Hochformat zweizeilig sein)
let coachInset = 0;       // zusätzlicher Platz für den Tutorial-Zettel

/** Freier Bildschirmbereich (CSS-Pixel) */
function view() {
  const w = window.innerWidth, h = window.innerHeight;
  const top = 78, bottom = bottomInset + coachInset, side = 24;
  return { w: w - 2 * side, h: h - top - bottom, cx: w / 2, cy: top + (h - top - bottom) / 2 };
}

/**
 * Kamera auf die vorhandenen Stationen ausrichten (nicht auf den möglichen
 * Stadtbereich) – so wird die Fläche in Quer- und Hochformat gut genutzt.
 */
function updateCamera(rdt) {
  const v = view();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of G.stations) {
    x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x);
    y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y);
  }
  // Rand: links/oben/unten etwas Luft, rechts Platz für die wartenden Fahrgäste
  x0 -= 1.8; x1 += 3.2; y0 -= 1.8; y1 += 1.8;
  // Mindestgröße, damit am Anfang nicht riesig gezoomt wird
  const minW = 16, minH = 11;
  if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  const ts = Math.min(v.w / (x1 - x0), v.h / (y1 - y0), 70);
  const tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
  if (!cam.ready) { Object.assign(cam, { s: ts, x: tx, y: ty, ready: true }); return; }
  const k = Math.min(1, rdt * 2);
  cam.s += (ts - cam.s) * k;
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

/** Maß in U → Pixel, aber nie kleiner als minPx (bleibt lesbar, wenn die Stadt groß wird) */
const px = (u, minPx) => Math.max(u * cam.s, minPx);
/** Maßstab für Fahrzeuge: wie die Karte, aber mindestens 22 px pro U */
const vehicleScale = () => Math.max(cam.s, 22);

const toScreen = (x, y) => {
  const v = view();
  return [v.cx + (x - cam.x) * cam.s, v.cy + (y - cam.y) * cam.s];
};
const toWorld = (sx, sy) => {
  const v = view();
  return [(sx - v.cx) / cam.s + cam.x, (sy - v.cy) / cam.s + cam.y];
};

/* =====================================================================
   7. ZEICHNEN
   ===================================================================== */

const canvas = $('#game');
const ctx = canvas.getContext('2d');
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  if (typeof hudCache !== 'undefined') hudCache.pens = null;   // Leiste neu messen (Drehen)
}

/** Karopapier: Linien im Weltraster, damit das Papier beim Zoomen mitwächst. */
function drawPaper() {
  const w = window.innerWidth, h = window.innerHeight;
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, w, h);
  const [x0, y0] = toWorld(0, 0);
  const [x1, y1] = toWorld(w, h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.floor(x0); x <= x1; x++) {
    const sx = Math.round(toScreen(x, 0)[0]) + 0.5;
    ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
  }
  for (let y = Math.floor(y0); y <= y1; y++) {
    const sy = Math.round(toScreen(0, y)[1]) + 0.5;
    ctx.moveTo(0, sy); ctx.lineTo(w, sy);
  }
  ctx.stroke();
}

/**
 * Gezeichneter Strich von (x1|y1) nach (x2|y2) in Weltkoordinaten.
 * Das Wackeln hängt nur vom Seed ab – es bleibt also stabil.
 */
function wobblyStroke(x1, y1, x2, y2, seed, amp = 0.05) {
  const len = dist(x1, y1, x2, y2);
  const n = Math.max(2, Math.ceil(len / 0.6));
  const nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
  const p1 = hash(seed, 1) * Math.PI * 2, p2 = hash(seed, 2) * Math.PI * 2;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const off = amp * Math.sin(u * Math.PI) * (0.65 * Math.sin(u * len * 1.3 + p1) + 0.35 * Math.sin(u * len * 3.1 + p2));
    pts.push(toScreen(x1 + (x2 - x1) * u + nx * off, y1 + (y2 - y1) * u + ny * off));
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  ctx.stroke();
}

/** Eckpunkte der Formen (Radius 1, Mittelpunkt 0|0) */
function shapePoints(shape) {
  switch (shape) {
    case 'triangle': return [[0, -1.15], [1.05, 0.75], [-1.05, 0.75]];
    case 'square': return [[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]];
    case 'diamond': return [[0, -1.2], [0.95, 0], [0, 1.2], [-0.95, 0]];
    case 'hub': return [[0, -1.15], [1, -0.35], [1, 0.95], [-1, 0.95], [-1, -0.35]];   // Bahnhofsgebäude
    case 'star': {
      const p = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.55 : 1.25, a = -Math.PI / 2 + (i * Math.PI) / 5;
        p.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return p;
    }
    case 'cross': {
      const a = 0.36, b = 1.05;
      return [[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]];
    }
    default: return null;   // Kreis
  }
}

/**
 * Pfad einer Form am Bildschirmpunkt (sx|sy) mit Radius r (Pixel).
 * seed ≠ 0 → leicht verzogene Ecken wie von Hand gezeichnet.
 * overshoot → Kreis endet etwas nach dem Anfang (Skizzen-Look, nur für Konturen).
 */
function shapePath(shape, sx, sy, r, seed = 0, overshoot = false) {
  const j = (i, k) => (seed ? (hash(seed, i, k) - 0.5) * 0.12 : 0);
  ctx.beginPath();
  const pts = shapePoints(shape);
  if (!pts) {
    // Handkreis: weich leicht oval statt zufällig holprig
    const steps = 40;
    const a0 = seed ? hash(seed, 99) * Math.PI * 2 : 0;
    const ph = seed ? hash(seed, 98) * Math.PI * 2 : 0;
    const wob = seed ? 0.045 : 0;
    const end = overshoot ? Math.PI * 2 + 0.35 : Math.PI * 2;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (end * i) / steps;
      const rr = r * 0.92 * (1 + wob * Math.sin(2 * a + ph) + (overshoot ? 0.03 * (i / steps) : 0));
      const x = sx + Math.cos(a) * rr, y = sy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (!overshoot) ctx.closePath();
    return;
  }
  pts.forEach(([px, py], i) => {
    const x = sx + (px + j(i, 1)) * r, y = sy + (py + j(i, 2)) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** Strichbreite eines Verkehrsmittels in U (für Kappen und Vorschau) */
const modeWidth = mode => (mode === 'metro' ? CFG.lineWidth : 0.2);

/**
 * Ein Streckenabschnitt im Stil des Verkehrsmittels:
 *   Bus    gestrichelter Marker
 *   Tram   zwei dünne Schienen auf hellem Band
 *   U-Bahn dicker Filzstift
 *   Zug    Gleis mit Schwellen
 */
function strokeSegment(mode, x1, y1, x2, y2, seed) {
  const s = cam.s;
  const len = dist(x1, y1, x2, y2) || 1;
  const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  ctx.globalAlpha = 0.92;
  if (mode === 'bus') {
    ctx.lineWidth = 0.2 * s;
    ctx.setLineDash([0.55 * s, 0.32 * s]);
    wobblyStroke(x1, y1, x2, y2, seed);
    ctx.setLineDash([]);
  } else if (mode === 'tram') {
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 0.34 * s;
    wobblyStroke(x1, y1, x2, y2, seed);
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = Math.max(1.2, 0.07 * s);
    for (const k of [-1, 1]) wobblyStroke(x1 + nx * 0.11 * k, y1 + ny * 0.11 * k, x2 + nx * 0.11 * k, y2 + ny * 0.11 * k, seed);
  } else if (mode === 'rail') {
    // Schwellen quer zur Strecke, dann zwei Schienen
    ctx.lineWidth = Math.max(1, 0.07 * s);
    ctx.beginPath();
    const n = Math.floor(len / 0.45);
    for (let i = 1; i < n; i++) {
      const u = i / n, cx = x1 + (x2 - x1) * u, cy = y1 + (y2 - y1) * u;
      const [p, q] = [toScreen(cx - nx * 0.22, cy - ny * 0.22), toScreen(cx + nx * 0.22, cy + ny * 0.22)];
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1.2, 0.08 * s);
    for (const k of [-1, 1]) wobblyStroke(x1 + nx * 0.12 * k, y1 + ny * 0.12 * k, x2 + nx * 0.12 * k, y2 + ny * 0.12 * k, seed, 0.02);
  } else {
    ctx.lineWidth = CFG.lineWidth * s;
    wobblyStroke(x1, y1, x2, y2, seed);
  }
  ctx.globalAlpha = 1;
}

/** Linien, Linienenden („Stiftkappen“) und die Griffe zum Verlängern */
function drawLines() {
  G.handles = [];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of G.lines) {
    const color = LINE_COLORS[line.color];
    const s = line.stations;
    ctx.strokeStyle = color;
    for (let i = 0; i < s.length - 1; i++) {
      const a = stationById(s[i]), b = stationById(s[i + 1]);
      const { ox, oy } = segmentOffset(line, a.id, b.id);
      strokeSegment(line.mode, a.x + ox, a.y + oy, b.x + ox, b.y + oy, line.id * 1000 + a.id * 31 + b.id);
    }

    // Stiftkappen an beiden Enden
    if (s.length >= 2) {
      for (const end of ['start', 'end']) {
        const st = stationById(end === 'end' ? s[s.length - 1] : s[0]);
        const prev = stationById(end === 'end' ? s[s.length - 2] : s[1]);
        const len = dist(prev.x, prev.y, st.x, st.y) || 1;
        const dx = (st.x - prev.x) / len, dy = (st.y - prev.y) / len;
        const { ox, oy } = segmentOffset(line, prev.id, st.id);
        const R = stationR(st);
        const bx = st.x + ox + dx * R, by = st.y + oy + dy * R;
        const hx = st.x + ox + dx * (R + 0.9), hy = st.y + oy + dy * (R + 0.9);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(modeWidth(line.mode), 0.24) * cam.s;
        const [p, q] = [toScreen(bx, by), toScreen(hx, hy)];
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        const [c1, c2] = [toScreen(hx - dy * 0.32, hy + dx * 0.32), toScreen(hx + dy * 0.32, hy - dx * 0.32)];
        ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.stroke();
        G.handles.push({ line, end, x: hx, y: hy });
      }
    }
  }
}

function drawTrains() {
  for (const tr of G.trains) {
    if (tr.line.stations.length < 2) continue;
    const A = stationById(tr.a), B = stationById(tr.b);
    if (!A || !B) continue;
    const { ox, oy } = segmentOffset(tr.line, A.id, B.id);
    const u = smooth(clamp(tr.t, 0, 1));            // sanft anfahren und bremsen
    const [sx, sy] = toScreen(A.x + (B.x - A.x) * u + ox, A.y + (B.y - A.y) * u + oy);
    const ang = Math.atan2(B.y - A.y, B.x - A.x);
    const mode = MODES[tr.line.mode];
    const vs = vehicleScale();
    const w = mode.body.w * vs, h = mode.body.h * vs;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.fillStyle = LINE_COLORS[tr.line.color];
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = Math.max(1, 0.05 * cam.s);
    // Ein Wagen (Bus, U-Bahn) oder zwei gekoppelte (Tram, Zug)
    const parts = mode.body.parts, gap = 0.06 * cam.s, pw = (w - gap * (parts - 1)) / parts;
    for (let k = 0; k < parts; k++) {
      ctx.beginPath();
      ctx.roundRect(-w / 2 + k * (pw + gap), -h / 2, pw, h, h * (tr.line.mode === 'bus' ? 0.25 : 0.35));
      ctx.fill();
      ctx.stroke();
    }
    // Fahrgäste als weiße Mini-Formen in zwei Reihen
    ctx.fillStyle = '#fff';
    const cols = Math.ceil(mode.cap / 2);
    tr.pax.forEach((p, i) => {
      const cx = -w / 2 + w * ((i % cols) + 0.5) / cols, cy = (i < cols ? -1 : 1) * h * 0.22;
      shapePath(p, cx, cy, Math.min(0.09 * cam.s, h * 0.2));
      ctx.fill();
    });
    ctx.restore();
  }
}

function drawStations() {
  for (const st of G.stations) {
    const R = px(stationR(st), st.shape === 'hub' ? 18 : 12);
    const [sx, sy] = toScreen(st.x, st.y);
    const age = G.t - st.born;
    const pop = age < 0.35 ? (age < 0.2 ? smooth(age / 0.2) * 1.15 : 1.15 - 0.15 * smooth((age - 0.2) / 0.15)) : 1;
    const r = R * pop;

    // Überfüllung: roter Bogen wie mit dem Rotstift
    if (st.over > 0) {
      ctx.fillStyle = 'rgba(208, 52, 44, 0.12)';
      const ring = R + px(0.5, 8);
      ctx.beginPath(); ctx.arc(sx, sy, ring, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 0.12 * cam.s;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(sx, sy, ring, -Math.PI / 2, -Math.PI / 2 + st.over * Math.PI * 2); ctx.stroke();
    }
    if (st.flash > 0) {
      ctx.strokeStyle = `rgba(43,43,43,${st.flash * 1.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, r * (1.6 + (0.35 - st.flash) * 2), 0, Math.PI * 2); ctx.stroke();
    }

    // Station: weiß gefüllt, doppelte Bleistift-Kontur
    shapePath(st.shape, sx, sy, r, st.id);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = COLORS.pencil;
    ctx.lineWidth = Math.max(1.5, 0.11 * cam.s);
    ctx.lineJoin = 'round';
    shapePath(st.shape, sx, sy, r, st.id, true);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1, 0.06 * cam.s);
    shapePath(st.shape, sx + 0.03 * cam.s, sy - 0.02 * cam.s, r, st.id + 7, true);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (st.big) {
      ctx.lineWidth = Math.max(1.2, 0.07 * cam.s);
      shapePath(st.shape, sx, sy, r + 0.22 * cam.s, st.id + 3, true);
      ctx.stroke();
    }
    if (st.shape === 'hub') {
      // Großes „H“ wie mit Bleistift ins Bahnhofsgebäude geschrieben
      ctx.lineWidth = Math.max(1.5, 0.1 * cam.s);
      ctx.lineCap = 'round';
      const hw = r * 0.38, ht = r * 0.42, cy = sy + r * 0.25;
      ctx.beginPath();
      ctx.moveTo(sx - hw, cy - ht); ctx.lineTo(sx - hw, cy + ht);
      ctx.moveTo(sx + hw, cy - ht); ctx.lineTo(sx + hw, cy + ht);
      ctx.moveTo(sx - hw, cy); ctx.lineTo(sx + hw, cy);
      ctx.stroke();
    }

    // Wartende Fahrgäste rechts neben der Station
    ctx.fillStyle = COLORS.pencil;
    const pr = px(0.16, 4.5), gap = px(0.42, 11);
    st.queue.forEach((p, i) => {
      const col = i % 4, row = Math.floor(i / 4);      // kompakter Block, ragt nicht in Nachbarstationen
      shapePath(p, sx + R + gap + col * gap, sy - gap * 0.7 + row * gap, pr);
      ctx.fill();
    });
  }
}

/** Vorschau beim Ziehen einer neuen Linie */
function drawDragPreview() {
  if (!drag || drag.mode !== 'new') return;
  const color = LINE_COLORS[drag.color];
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < drag.stations.length - 1; i++) {
    const a = stationById(drag.stations[i]), b = stationById(drag.stations[i + 1]);
    strokeSegment(drag.lineMode, a.x, a.y, b.x, b.y, 7000 + a.id * 31 + b.id);
  }
  ctx.lineWidth = modeWidth(drag.lineMode) * cam.s;
  const last = stationById(drag.stations[drag.stations.length - 1]);
  const [p, q] = [toScreen(last.x, last.y), toScreen(drag.x, drag.y)];
  ctx.setLineDash([0.35 * cam.s, 0.25 * cam.s]);
  ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** Am Spielende: die überfüllte Station dick rot einkreisen */
function drawLost() {
  const st = G.lostStation;
  if (!st) return;
  const [sx, sy] = toScreen(st.x, st.y);
  ctx.strokeStyle = COLORS.danger;
  ctx.lineWidth = 0.16 * cam.s;
  shapePath('circle', sx, sy, 1.9 * cam.s, 4242, true);
  ctx.stroke();
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPaper();
  drawLines();
  drawDragPreview();
  drawTrains();
  drawTutorialGlow();
  drawStations();
  drawTutorialPath();
  drawLost();
}

/* =====================================================================
   8. EINGABE (Pencil und Finger)
   ===================================================================== */

let drag = null;          // laufende Zieh-Aktion
let penActive = false;    // Pencil zeichnet gerade → Finger ignorieren (Handballen)

/** Trefferradius in Welt-Einheiten: mindestens 28 Bildschirm-Pixel */
const hitRadius = () => Math.max(0.9, 28 / cam.s);

function stationAt(x, y) {
  let bestSt = null, bestD = hitRadius();
  for (const s of G.stations) {
    const d = dist(s.x, s.y, x, y);
    if (d < bestD) { bestD = d; bestSt = s; }
  }
  return bestSt;
}

function handleAt(x, y) {
  let bestH = null, bestD = Math.max(0.75, 26 / cam.s);
  for (const h of G.handles) {
    const d = dist(h.x, h.y, x, y);
    if (d < bestD) { bestD = d; bestH = h; }
  }
  return bestH;
}

function onDown(e) {
  closeLineMenu();
  if (drag) return;
  if (e.pointerType === 'touch' && penActive) return;
  const [x, y] = toWorld(e.clientX, e.clientY);

  if (G.state === 'placeBig') {
    const st = stationAt(x, y);
    if (st && !st.big && st.shape !== 'hub') {
      st.big = true;
      G.state = 'playing';
      toast('Großer Bahnhof gebaut – hier passen jetzt 12 Fahrgäste hin.');
    }
    return;
  }
  if (G.state !== 'playing') return;

  const h = handleAt(x, y);
  if (h) {
    drag = { mode: 'extend', line: h.line, end: h.end, x, y, id: e.pointerId };
  } else {
    const st = stationAt(x, y);
    if (!st) return;
    const lineMode = G.selectedMode;
    const M = MODES[lineMode];
    if (!canCreateLine(lineMode)) {
      toast(`Alle ${M.lineName}n sind vergeben. Wähle unten ein anderes Verkehrsmittel oder verlängere eine Linie.`, 3400);
      return;
    }
    if (M.needsHub && st.shape !== 'hub') {
      toast('Züge fahren immer ab dem Hauptbahnhof – starte dort.');
      return;
    }
    drag = { mode: 'new', lineMode, stations: [st.id], color: freeColor(), x, y, id: e.pointerId };
  }
  if (e.pointerType === 'pen') penActive = true;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* nicht kritisch */ }
  e.preventDefault();
}

function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const [x, y] = toWorld(e.clientX, e.clientY);
  drag.x = x; drag.y = y;
  const st = stationAt(x, y);
  if (!st) return;

  if (drag.mode === 'new') {
    const s = drag.stations;
    if (s[s.length - 2] === st.id) s.pop();                 // zurückgezogen
    else if (!s.includes(st.id) && !tooManyStops(drag.lineMode, s.length)) s.push(st.id);
    return;
  }

  // Linie am Ende verlängern oder verkürzen – live, damit die Züge sofort reagieren
  const line = drag.line;
  const s = line.stations;
  const atEnd = drag.end === 'end';
  const endId = atEnd ? s[s.length - 1] : s[0];
  const prevId = atEnd ? s[s.length - 2] : s[1];
  if (st.id === endId) return;
  if (st.id === prevId) {
    // Züge dürfen den Hauptbahnhof nicht verlieren
    if (MODES[line.mode].needsHub && stationById(endId).shape === 'hub') return;
    if (atEnd) s.pop(); else s.shift();
  } else if (!s.includes(st.id) && !tooManyStops(line.mode, s.length)) {
    if (atEnd) s.push(st.id); else s.unshift(st.id);
  } else {
    return;
  }
  rebuildRoutes();
  syncTrains(line);
}

/** Höchstzahl an Haltestellen erreicht? (mit Hinweis, einmal pro Ziehen) */
function tooManyStops(mode, count) {
  if (count < MODES[mode].maxStops) return false;
  if (drag && !drag.warned) {
    drag.warned = true;
    toast(`Eine ${MODES[mode].lineName} hat höchstens ${MODES[mode].maxStops} Haltestellen.`);
  }
  return true;
}

function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'new' && drag.stations.length >= 2) {
    createLine(drag.stations, drag.color, drag.lineMode);
  } else if (drag.mode === 'extend' && drag.line.stations.length < 2) {
    deleteLine(drag.line);
    toast('Linie gelöscht.');
  }
  drag = null;
  penActive = false;
}

canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
for (const t of ['touchstart', 'touchmove']) canvas.addEventListener(t, e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

/* =====================================================================
   9. HUD UND BILDSCHIRME
   ===================================================================== */

const hudCache = {};
/** Text nur setzen, wenn er sich geändert hat (spart Arbeit pro Bild) */
function setText(id, text) {
  if (hudCache[id] === text) return;
  hudCache[id] = text;
  $(id).textContent = text;
}

function updateHud() {
  setText('#score', String(G.score));
  const weekT = (G.t % (CFG.dayLength * 7)) / (CFG.dayLength * 7);
  const day = Math.min(6, Math.floor(weekT * 7));
  setText('#week-label', `Woche ${G.week} · ${DAYS[day]}`);

  // Wochenuhr als Tortenstück
  const a = weekT * Math.PI * 2 - Math.PI / 2;
  const x = 20 + 15 * Math.cos(a), y = 20 + 15 * Math.sin(a);
  const pie = weekT < 0.001 ? '' : `M20 20 L20 5 A15 15 0 ${weekT > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
  if (hudCache.pie !== pie) { hudCache.pie = pie; $('#clock-pie').setAttribute('d', pie); }

  // Leiste unten (nur neu bauen, wenn sich etwas geändert hat)
  const key = G.lines.map(l => `${l.mode}${l.color}:${vehiclesOn(l)}`).join(',') + '|' + JSON.stringify(G.inv) + '|' + G.selectedMode;
  if (hudCache.pens !== key) { hudCache.pens = key; renderPens(); }

  // Hinweis am Anfang
  const hint = $('#hint');
  const showHint = G.state === 'playing' && G.lines.length === 0 && !drag && !G.tutorial;
  if (hint.hidden === showHint) {
    hint.hidden = !showHint;
    hint.textContent = 'Wähle unten ein Verkehrsmittel und zieh von Station zu Station.';
  }
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('is-active', +b.dataset.speed === G.speed);
}

function hideHint() { $('#hint').hidden = true; }

const modeIcon = (mode, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${MODES[mode].icon}</svg>`;

/** Verkehrsmittel wählen, mit dem neue Linien gezogen werden */
function selectMode(mode) {
  G.selectedMode = mode;
  if (G.tutorial) { tut.tapped = mode; return; }   // im Tutorial erklärt der Zettel
  const M = MODES[mode];
  const extra = M.needsHub ? ' Züge starten immer am Hauptbahnhof.' : '';
  toast(canCreateLine(mode)
    ? `${M.name} gewählt – zieh von Station zu Station.${extra}`
    : `${M.name} gewählt – aber alle ${M.lineName}n sind vergeben.`);
}

/**
 * Leiste unten: pro Verkehrsmittel ein Reiter (Symbol + freie Fahrzeuge)
 * und dahinter seine Linien-Stifte (benutzt = farbig, frei = gestrichelt).
 */
function renderPens() {
  const box = $('#pens');
  box.innerHTML = '';
  for (const mode of MODE_ORDER) {
    const M = MODES[mode];
    const group = document.createElement('div');
    group.className = 'mode-group' + (G.selectedMode === mode ? ' selected' : '');

    const tab = document.createElement('button');
    tab.className = 'mode-tab';
    tab.setAttribute('aria-label', `${M.name}: ${G.inv[mode].free} frei`);
    tab.innerHTML = `${modeIcon(mode)}<span class="mode-name">${M.name}</span><span class="pen-trains">${G.inv[mode].free}</span>`;
    tab.addEventListener('click', () => selectMode(mode));
    group.appendChild(tab);

    const used = linesOf(mode);
    for (const line of used) {
      const b = document.createElement('button');
      b.className = 'pen used';
      b.dataset.line = line.id;
      b.style.setProperty('--c', LINE_COLORS[line.color]);
      b.setAttribute('aria-label', `${M.lineName} ${line.color + 1}`);
      b.innerHTML = `<span class="pen-trains">${vehiclesOn(line)}</span>`;
      b.addEventListener('click', () => openLineMenu(line, b));
      group.appendChild(b);
    }
    for (let k = used.length; k < G.inv[mode].lines; k++) {
      const b = document.createElement('button');
      b.className = 'pen';
      b.setAttribute('aria-label', `Freie ${M.lineName}`);
      b.addEventListener('click', () => selectMode(mode));
      group.appendChild(b);
    }
    box.appendChild(group);
  }
  bottomInset = ($('.hud-bottom').offsetHeight || 80) + 10;
}

let menuLine = null;
function openLineMenu(line, anchor) {
  if (menuLine === line) { closeLineMenu(); return; }
  menuLine = line;
  tut.menuOpened = true;
  const m = $('#line-menu');
  const M = MODES[line.mode];
  const free = G.inv[line.mode].free;
  $('#lm-add').textContent = `+ ${M.vehicle} (${free} frei)`;
  $('#lm-remove').textContent = `− ${M.vehicle}`;
  $('#lm-add').disabled = free <= 0;
  $('#lm-remove').disabled = vehiclesOn(line) === 0;
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth;
  m.style.left = `${clamp(r.left + r.width / 2 - mw / 2, 10, window.innerWidth - mw - 10)}px`;
  m.style.top = `${r.top - m.offsetHeight - 14}px`;
  for (const p of document.querySelectorAll('.pen')) p.classList.toggle('selected', p === anchor);
}
function closeLineMenu() {
  menuLine = null;
  $('#line-menu').hidden = true;
  for (const p of document.querySelectorAll('.pen')) p.classList.remove('selected');
}

$('#lm-add').addEventListener('click', () => {
  if (menuLine && addTrain(menuLine)) toast(`${MODES[menuLine.mode].vehicle} eingesetzt.`);
  closeLineMenu();
});
$('#lm-remove').addEventListener('click', () => {
  const tr = G.trains.filter(t => t.line === menuLine).pop();
  if (tr) removeTrain(tr);
  closeLineMenu();
});
$('#lm-delete').addEventListener('click', () => {
  if (menuLine) deleteLine(menuLine);
  closeLineMenu();
});

for (const b of document.querySelectorAll('[data-speed]')) {
  b.addEventListener('click', () => {
    G.speed = +b.dataset.speed;
    if (G.speed === 0 && saveGame()) toast('Pause – dein Spiel ist gespeichert.');
  });
}

/* ---------- Upgrade am Wochenende ---------- */

const totalLineSlots = () => MODE_ORDER.reduce((a, m) => a + G.inv[m].lines, 0);
const MODE_TEXT = {
  bus: 'langsam, 4 Plätze, max. 6 Halte',
  tram: 'schnelles Einsteigen, max. 8 Halte',
  metro: 'schnell, beliebig lang',
  rail: 'sehr schnell, 10 Plätze, ab Hauptbahnhof',
};

/** Alle möglichen Upgrades; pro Woche werden drei passende ausgelost. */
const UPGRADES = [
  ...MODE_ORDER.map(mode => ({
    key: 'line-' + mode, title: `Neue ${MODES[mode].lineName}`, text: MODE_TEXT[mode], icon: MODES[mode].icon,
    ok: () => G.inv[mode].lines < MODES[mode].maxLines && totalLineSlots() < LINE_COLORS.length,
    apply: () => { G.inv[mode].lines++; G.selectedMode = mode; },
  })),
  ...MODE_ORDER.map(mode => ({
    key: 'veh-' + mode, title: mode === 'bus' ? '2 Busse' : `Extra-${MODES[mode].vehicle}`,
    text: `Mehr Fahrzeuge für deine ${MODES[mode].lineName}n.`, icon: MODES[mode].icon,
    ok: () => true,
    apply: () => { G.inv[mode].free += mode === 'bus' ? 2 : 1; },
  })),
  {
    key: 'big', title: 'Großer Bahnhof', text: 'Eine Station fasst 12 statt 6 Fahrgäste.',
    icon: '<circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="9"/>',
    ok: () => G.stations.some(s => !s.big && s.shape !== 'hub'),
    apply: () => { G.state = 'placeBig'; toast('Tippe auf die Station, die größer werden soll.', 4000); },
  },
];

/** Drei verschiedene Upgrades auslosen (fest pro Woche, damit Neuladen nichts ändert) */
function weeklyUpgrades() {
  const pool = UPGRADES.filter(u => u.ok());
  return pool
    .map((u, i) => ({ u, r: hash(G.week, i, G.stations.length) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, 3)
    .map(x => x.u);
}

function showUpgrade() {
  G.state = 'upgrade';
  closeLineMenu();
  drag = null;
  $('#up-title').textContent = `Woche ${G.week - 1} geschafft!`;
  const box = $('#up-cards');
  box.innerHTML = '';
  for (const up of weeklyUpgrades()) {
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = `<svg class="ico" viewBox="0 0 24 24">${up.icon}</svg><b>${up.title}</b><small>${up.text}</small>`;
    b.addEventListener('click', () => {
      $('#screen-upgrade').hidden = true;
      G.state = 'playing';
      up.apply();
      saveGame();
    });
    box.appendChild(b);
  }
  $('#screen-upgrade').hidden = false;
}

/* ---------- Speichern ----------
   Das Spiel speichert sich selbst: alle paar Sekunden, beim Pausieren,
   über das Menü und wenn die App in den Hintergrund geht. Gespeichert
   wird nur, was nötig ist (Stationen, Linien, Züge, Zeit, Punkte) –
   alles andere (Wegfindung, Griffe) wird beim Laden neu berechnet. */

const SAVE_KEY = 'heftmetro.save';
const SAVE_VERSION = 2;          // v2: Verkehrsmittel und Hauptbahnhof (v1-Stände werden verworfen)
const ACTIVE_STATES = ['playing', 'upgrade', 'placeBig'];

function serialize() {
  return {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    state: G.state,
    t: G.t, week: G.week, score: G.score, nextId: G.nextId,
    inv: G.inv, selectedMode: G.selectedMode, stationTimer: G.stationTimer,
    stations: G.stations.map(({ id, x, y, shape, queue, over, big, born }) => ({ id, x, y, shape, queue, over, big, born })),
    lines: G.lines.map(({ id, color, mode, stations }) => ({ id, color, mode, stations })),
    trains: G.trains.map(({ id, line, a, b, t, dwell, pax }) => ({ id, line: line.id, a, b, t, dwell, pax })),
  };
}

/** Speichert die laufende Runde. Gibt true zurück, wenn es geklappt hat. */
function saveGame() {
  if (G.tutorial) return false;            // die Anleitung wird nicht gespeichert
  const state = G.state === 'start' ? G.resumeState : G.state;
  if (!ACTIVE_STATES.includes(state)) return false;
  try {
    const data = serialize();
    data.state = state;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;          // z. B. privater Modus – das Spiel läuft trotzdem
  }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* egal */ }
}

/** Prüft einen Spielstand gründlich, damit ein kaputter Stand das Spiel nicht lahmlegt. */
function isValidSave(d) {
  const num = v => Number.isFinite(v);
  const shapes = ALL_SHAPES;
  if (!d || d.v !== SAVE_VERSION || !Array.isArray(d.stations) || !Array.isArray(d.lines) || !Array.isArray(d.trains)) return false;
  if (![d.t, d.week, d.score, d.nextId, d.stationTimer].every(num)) return false;
  if (!d.inv || !MODE_ORDER.every(m => num(d.inv[m]?.lines) && num(d.inv[m]?.free))) return false;
  if (!d.stations.some(st => st.shape === 'hub')) return false;
  const ids = new Set();
  for (const st of d.stations) {
    if (!num(st.id) || !num(st.x) || !num(st.y) || !shapes.includes(st.shape) || !Array.isArray(st.queue)) return false;
    if (!st.queue.every(p => shapes.includes(p))) return false;
    ids.add(st.id);
  }
  const lineIds = new Set();
  for (const l of d.lines) {
    if (!num(l.id) || !(l.color >= 0 && l.color < LINE_COLORS.length) || !MODES[l.mode] || !Array.isArray(l.stations) || l.stations.length < 2) return false;
    if (!l.stations.every(id => ids.has(id))) return false;
    lineIds.add(l.id);
  }
  return d.trains.every(tr => lineIds.has(tr.line) && ids.has(tr.a) && ids.has(tr.b) && num(tr.t) && Array.isArray(tr.pax));
}

function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (isValidSave(d)) return d;
    if (d) clearSave();
  } catch { /* kein oder kaputter Stand */ }
  return null;
}

/** Baut eine gespeicherte Runde wieder auf (zunächst hinter dem Startzettel). */
function restoreGame(d) {
  newGame();
  Object.assign(G, {
    t: d.t, week: d.week, score: d.score, nextId: d.nextId, stationTimer: d.stationTimer,
    selectedMode: MODES[d.selectedMode] ? d.selectedMode : 'bus',
    inv: Object.fromEntries(MODE_ORDER.map(m => [m, {
      lines: clamp(Math.round(d.inv[m].lines), 0, MODES[m].maxLines),
      free: Math.max(0, Math.round(d.inv[m].free)),
    }])),
  });
  G.stations = d.stations.map(st => ({ ...st, queue: [...st.queue], over: clamp(+st.over || 0, 0, 0.99), big: !!st.big, born: +st.born || 0, flash: 0 }));
  G.lines = d.lines.map(l => ({ id: l.id, color: l.color, mode: l.mode, stations: [...l.stations] }));
  const lineById = new Map(G.lines.map(l => [l.id, l]));
  G.trains = d.trains.map(tr => ({
    id: tr.id, line: lineById.get(tr.line), a: tr.a, b: tr.b,
    t: clamp(tr.t, 0, 1), dwell: +tr.dwell || 0, pax: [...tr.pax],
  }));
  for (const l of G.lines) syncTrains(l);
  rebuildRoutes();
  updateBounds();
  G.resumeState = d.state;
  cam.ready = false;
}

/** Zeitangabe wie „vor 5 Min.“ */
function timeAgo(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const days = Math.round(h / 24);
  return days === 1 ? 'gestern' : `vor ${days} Tagen`;
}

/** Laufende Runde fortsetzen (nach Laden oder aus dem Menü) */
function resumeGame() {
  $('#screen-start').hidden = true;
  const state = G.resumeState || 'playing';
  G.resumeState = null;
  G.speed = 1;
  if (state === 'upgrade') {
    showUpgrade();
  } else if (state === 'placeBig') {
    G.state = 'placeBig';
    toast('Tippe auf die Station, die größer werden soll.', 4000);
  } else {
    G.state = 'playing';
  }
}

/* ---------- Start und Ende ---------- */

function gameOver(st) {
  G.state = 'over';
  G.lostStation = st;
  clearSave();                         // vorbei ist vorbei
  drag = null;
  closeLineMenu();
  const rec = best.get();
  const isNew = G.score > rec;
  if (isNew) best.set(G.score);
  $('#over-reason').textContent = st.shape === 'hub'
    ? 'Der Hauptbahnhof war zu lange überfüllt.'
    : `Die ${SHAPE_NAME[st.shape]}-Station war zu lange überfüllt.`;
  $('#over-score').textContent = G.score;
  $('#over-weeks').textContent = G.week;
  $('#over-record').textContent = isNew ? 'Neuer Rekord!' : rec ? `Rekord: ${rec} Fahrgäste` : '';
  // Kurz zeigen, welche Station es war, dann den Zettel
  setTimeout(() => { $('#screen-over').hidden = false; }, 900);
}

/** Startzettel. Mit Spielstand: „Weiterspielen“ und „Neues Spiel“. */
function showStart(saved, canResume = !!saved) {
  const rec = best.get();
  $('#start-record').textContent = rec ? `Dein Rekord: ${rec} Fahrgäste` : '';
  const info = $('#save-info');
  info.hidden = !saved;
  $('#btn-continue').hidden = !canResume;
  const start = $('#btn-start');
  start.textContent = canResume ? 'Neues Spiel' : 'Losfahren';
  start.classList.toggle('primary', !canResume);
  if (saved) {
    info.textContent = `Gespeichert ${timeAgo(saved.savedAt)}: Woche ${saved.week} · ${saved.score} Fahrgäste`;
  }
  $('#screen-start').hidden = false;
}

$('#btn-continue').addEventListener('click', resumeGame);

$('#btn-start').addEventListener('click', () => {
  if (G.resumeState && !confirm('Neues Spiel starten? Dein gespeichertes Spiel wird dabei überschrieben.')) return;
  $('#screen-start').hidden = true;
  if (!tutorialSeen()) { startTutorial(); return; }   // allererstes Spiel: mit Anleitung
  clearSave();
  newGame();
  cam.ready = false;
  G.state = 'playing';
  G.speed = 1;
});

// Menü: sofort speichern und zum Startzettel
$('#btn-menu').addEventListener('click', () => {
  if (!ACTIVE_STATES.includes(G.state)) return;
  closeLineMenu();
  drag = null;
  G.resumeState = G.state;
  G.state = 'start';
  const ok = saveGame();
  showStart(ok ? serialize() : null, true);
  if (!ok) toast(G.tutorial ? 'Die Anleitung wird nicht gespeichert.' : 'Speichern ist hier nicht möglich (privater Modus?).');
});
$('#btn-again').addEventListener('click', () => {
  $('#screen-over').hidden = true;
  newGame();
  cam.ready = false;
  G.state = 'playing';
  G.speed = 1;
});

// App im Hintergrund → automatisch pausieren
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (G.state === 'playing') G.speed = 0;
  saveGame();
});
window.addEventListener('pagehide', () => saveGame());

/* =====================================================================
   TUTORIAL
   Die erste Runde wird Schritt für Schritt erklärt. Jeder Schritt hat
   einen Text, ein Ziel zum Hervorheben (Station, Weg zum Ziehen,
   Linienende, Reiter oder Stift) und eine Bedingung, wann es weitergeht.
   Während des Tutorials entstehen keine neuen Stationen, die Zeit steht
   und niemand wird überfüllt – man kann in Ruhe ausprobieren.
   ===================================================================== */

const TUT_DONE_KEY = 'heftmetro.tutorialDone';
const tutorialSeen = () => { try { return localStorage.getItem(TUT_DONE_KEY) === '1'; } catch { return false; } };
const markTutorialSeen = () => { try { localStorage.setItem(TUT_DONE_KEY, '1'); } catch { /* egal */ } };

const stationOf = shape => G.stations.find(s => s.shape === shape);
/** Gibt es eine Linie dieses Verkehrsmittels, die beide Stationen verbindet? */
const lineWith = (mode, a, b) => G.lines.find(l => l.mode === mode && l.stations.includes(a.id) && l.stations.includes(b.id));

const TUTORIAL = [
  {
    text: 'Das ist dein Hauptbahnhof. Von hier aus baust du das Verkehrsnetz der Stadt.',
    focus: () => ({ station: stationOf('hub') }),
  },
  {
    text: 'Die kleinen Formen neben den Stationen sind Fahrgäste. Jeder will zu einer Station mit seiner Form – ein Häuschen heißt: zum Hauptbahnhof.',
    enter: () => {
      stationOf('hub').queue.push('circle', 'circle', 'triangle');
      stationOf('circle').queue.push('hub', 'hub');
      stationOf('triangle').queue.push('hub', 'circle');
      stationOf('square').queue.push('hub');
    },
    focus: () => ({ station: stationOf('circle') }),
  },
  {
    text: 'Unten wählst du das Verkehrsmittel. Tippe auf „Bus“.',
    focus: () => ({ tab: 'bus' }),
    done: t => t.tapped === 'bus',
  },
  {
    text: 'Zieh jetzt mit Stift oder Finger vom Hauptbahnhof zum Kreis. So entsteht deine erste Buslinie.',
    focus: () => ({ path: [stationOf('hub'), stationOf('circle')] }),
    done: () => lineWith('bus', stationOf('hub'), stationOf('circle')),
  },
  {
    text: 'Super! Der Bus holt die Fahrgäste ab und bringt sie ans Ziel. Schau kurz zu …',
    focus: () => ({}),
    done: t => G.score >= 2 || t.time > 18,
  },
  {
    text: 'Züge sind schnell und haben viel Platz, starten aber immer am Hauptbahnhof. Tippe auf „Zug“ und zieh vom Hauptbahnhof zum Dreieck.',
    focus: () => ({ tab: G.selectedMode === 'rail' ? null : 'rail', path: [stationOf('hub'), stationOf('triangle')] }),
    done: () => lineWith('rail', stationOf('hub'), stationOf('triangle')),
  },
  {
    text: 'Jede Linie endet mit einer Stiftkappe. Zieh die Kappe deiner Buslinie zum Quadrat – so verlängerst du die Linie.',
    focus: () => {
      const bus = lineWith('bus', stationOf('hub'), stationOf('circle'));
      if (!bus) return {};
      const circle = stationOf('circle');
      const handle = G.handles.find(h => h.line === bus &&
        (h.end === 'end' ? bus.stations[bus.stations.length - 1] : bus.stations[0]) === circle.id);
      return { handle, path: handle ? [{ x: handle.x, y: handle.y }, stationOf('square')] : null };
    },
    done: () => G.lines.some(l => l.mode === 'bus' && l.stations.includes(stationOf('square').id)),
  },
  {
    text: 'Tippe unten auf deine Buslinie. Dort setzt du weitere Fahrzeuge ein oder löschst die Linie wieder.',
    focus: () => ({ pen: G.lines.find(l => l.mode === 'bus') }),
    done: t => t.menuOpened,
  },
  {
    text: 'Wird eine Station zu voll, erscheint ein roter Kreis – dann schnell helfen! Jede Woche bekommst du neue Linien oder Fahrzeuge. Viel Spaß!',
    button: 'Los geht’s!',
  },
];

const tut = { step: 0, time: 0, tapped: null, menuOpened: false, focus: {} };

function startTutorial() {
  clearSave();
  newGame();
  cam.ready = false;
  G.tutorial = true;
  G.state = 'playing';
  G.speed = 1;
  G.selectedMode = 'metro';     // damit „Bus“ wirklich angetippt werden muss
  hudCache.pens = null;
  goToStep(0);
}

function goToStep(i) {
  if (i >= TUTORIAL.length) { endTutorial(); return; }
  Object.assign(tut, { step: i, time: 0, tapped: null, menuOpened: false });
  const step = TUTORIAL[i];
  step.enter?.();
  $('#coach-step').textContent = `Anleitung ${i + 1} / ${TUTORIAL.length}`;
  $('#coach-text').textContent = step.text;
  const next = $('#coach-next');
  next.hidden = !!step.done;                    // Aktions-Schritte gehen von allein weiter
  next.textContent = step.button || 'Weiter';
}

function endTutorial() {
  G.tutorial = false;
  markTutorialSeen();
  $('#coach').hidden = true;
  clearFocus();
  toast('Jetzt spielst du richtig – die Stadt wächst!');
}

function clearFocus() {
  for (const el of document.querySelectorAll('.tut-focus')) el.classList.remove('tut-focus');
}

/** Pro Bild: Bedingung prüfen, Zettel zeigen, Bedienelemente hervorheben */
function tutorialTick(rdt) {
  const coach = $('#coach');
  if (!G.tutorial || G.state !== 'playing') { coach.hidden = true; coachInset = 0; clearFocus(); return; }
  coach.hidden = false;
  coachInset = coach.offsetHeight + 16;     // Kamera hält die Stadt über dem Zettel
  coach.style.setProperty('--coach-bottom', `${bottomInset + 8}px`);
  tut.time += rdt;
  const step = TUTORIAL[tut.step];
  if (step.done && step.done(tut)) { goToStep(tut.step + 1); return; }
  tut.focus = step.focus ? step.focus() || {} : {};

  clearFocus();
  if (tut.focus.tab) {
    document.querySelector(`.mode-group:nth-child(${MODE_ORDER.indexOf(tut.focus.tab) + 1}) .mode-tab`)?.classList.add('tut-focus');
  }
  if (tut.focus.pen) {
    document.querySelector(`.pen[data-line="${tut.focus.pen.id}"]`)?.classList.add('tut-focus');
  }
}

/** Textmarker-Leuchten hinter Station oder Linienende (vor den Stationen gezeichnet) */
function drawTutorialGlow() {
  if (!G.tutorial || G.state !== 'playing') return;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
  const glow = (x, y, r) => {
    const [sx, sy] = toScreen(x, y);
    ctx.fillStyle = `rgba(255, 232, 61, ${0.45 + 0.3 * pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, (r + 0.35 + 0.2 * pulse) * cam.s, 0, Math.PI * 2);
    ctx.fill();
  };
  const f = tut.focus;
  if (f.station) glow(f.station.x, f.station.y, stationR(f.station));
  if (f.handle) glow(f.handle.x, f.handle.y, 0.35);
  if (f.path) for (const p of f.path) if (p.shape) glow(p.x, p.y, stationR(p) * 0.6);
}

/** Gestrichelter Bleistift-Pfeil „hier entlang ziehen“ mit wanderndem Stiftpunkt */
function drawTutorialPath() {
  const f = G.tutorial && G.state === 'playing' ? tut.focus : null;
  if (!f?.path || drag) return;
  const [a, b] = f.path;
  const [ax, ay] = toScreen(a.x, a.y), [bx, by] = toScreen(b.x, b.y);
  const t = (performance.now() / 1600) % 1;
  ctx.save();
  ctx.strokeStyle = COLORS.pencil;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(2, 0.08 * cam.s);
  ctx.lineCap = 'round';
  ctx.setLineDash([0.3 * cam.s, 0.22 * cam.s]);
  ctx.lineDashOffset = -t * 0.52 * cam.s * 3;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.setLineDash([]);
  // Pfeilspitze kurz vor dem Ziel
  const ang = Math.atan2(by - ay, bx - ax), len = Math.hypot(bx - ax, by - ay);
  const tipX = ax + Math.cos(ang) * (len - 0.95 * cam.s), tipY = ay + Math.sin(ang) * (len - 0.95 * cam.s);
  ctx.beginPath();
  ctx.moveTo(tipX - Math.cos(ang - 0.5) * 0.45 * cam.s, tipY - Math.sin(ang - 0.5) * 0.45 * cam.s);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tipX - Math.cos(ang + 0.5) * 0.45 * cam.s, tipY - Math.sin(ang + 0.5) * 0.45 * cam.s);
  ctx.stroke();
  // Wandernder Stiftpunkt
  const e = smooth(t);
  ctx.globalAlpha = 0.85 * Math.sin(t * Math.PI);
  ctx.fillStyle = COLORS.pencil;
  ctx.beginPath(); ctx.arc(ax + (bx - ax) * e, ay + (by - ay) * e, 0.22 * cam.s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

$('#coach-next').addEventListener('click', () => goToStep(tut.step + 1));
$('#coach-skip').addEventListener('click', endTutorial);
$('#btn-tutorial').addEventListener('click', () => {
  if (G.resumeState && !confirm('Die Anleitung startet ein neues Spiel. Dein gespeichertes Spiel wird dabei überschrieben.')) return;
  $('#screen-start').hidden = true;
  startTutorial();
});

/* =====================================================================
   10. START
   ===================================================================== */

let lastFrame = performance.now();
let autosaveTimer = 0;
function frame(now) {
  const rdt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  // Auto-Speichern alle 5 Sekunden, solange gespielt wird
  autosaveTimer += rdt;
  if (autosaveTimer >= 5) { autosaveTimer = 0; if (G.state === 'playing' && G.speed > 0) saveGame(); }
  if (G.state === 'playing' && G.speed > 0) update(rdt * G.speed);
  updateCamera(rdt);
  draw();
  updateHud();
  tutorialTick(rdt);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
const saved = loadSave();
if (saved) restoreGame(saved); else newGame();
showStart(saved);
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker:', err));
}

// Schnittstelle für automatische Tests (wird vom Spiel selbst nicht benutzt)
window.__metro = {
  get G() { return G; },
  step(dt) { update(dt); },
  toScreen,
  newGame,
  saveGame,
  loadSave,
  tut,
  startTutorial,
};
