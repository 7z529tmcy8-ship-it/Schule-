/* =====================================================================
   Heft-Metro – game.js
   ---------------------------------------------------------------------
   Ein U-Bahn-Planungsspiel im Schulheft-Look, gemacht für das iPad.
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
const LINE_COLORS = ['#d23b2f', '#2456c9', '#2f9e4f', '#ef8a17', '#8a3fb8', '#1199a8', '#8b5a2b'];

const COMMON_SHAPES = ['circle', 'triangle', 'square'];
const RARE_SHAPES = ['star', 'diamond', 'cross'];
const SHAPE_NAME = {
  circle: 'Kreis', triangle: 'Dreieck', square: 'Quadrat',
  star: 'Stern', diamond: 'Rauten', cross: 'Kreuz',
};
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Spiel-Balance – hier lässt sich alles feinjustieren */
const CFG = {
  dayLength: 12,          // Sekunden pro Spieltag (1 Woche = 7 Tage)
  stationR: 0.55,         // Radius einer Station in U
  capacity: 6,            // Fahrgäste, ab denen eine Station überfüllt ist
  bigCapacity: 12,        // … beim großen Bahnhof
  overcrowdTime: 40,      // Sekunden Überfüllung bis Game Over
  recoverTime: 80,        // Sekunden, bis sich der Timer wieder ganz erholt
  trainCap: 6,
  trainSpeed: 2.4,        // U pro Sekunde
  startLines: 3,
  startTrains: 3,
  maxLines: 7,
  minStationDist: 2.6,    // Mindestabstand neuer Stationen
  lineWidth: 0.30,        // Filzstift-Breite in U
  lineGap: 0.32,          // Abstand paralleler Linien
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
    maxLines: CFG.startLines,
    trainsFree: CFG.startTrains,
    bounds: { hw: 7, hh: 5 },   // halbe Breite/Höhe der Stadt in U
    stationTimer: 10,
    dist: new Map(),       // Form → Map(Station-ID → Anzahl Haltestellen bis dorthin)
    handles: [],           // Linienenden zum Anfassen (pro Bild neu berechnet)
    lostStation: null,
  };
  // Drei Startstationen, eine pro Grundform
  addStation('circle', -3 + Math.round(rand(-1, 1)), -1 + Math.round(rand(-1, 1)));
  addStation('triangle', 3 + Math.round(rand(-1, 1)), -2 + Math.round(rand(-1, 1)));
  addStation('square', Math.round(rand(-1, 1)), 2 + Math.round(rand(0, 1)));
  rebuildRoutes();
}

const stationById = id => G.stations.find(s => s.id === id);

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
  for (let c = 0; c < G.maxLines; c++) if (!G.lines.some(l => l.color === c)) return c;
  return -1;
}

function createLine(stationIds, color) {
  const line = { id: G.nextId++, color, stations: stationIds.slice() };
  G.lines.push(line);
  rebuildRoutes();
  if (G.trainsFree > 0) addTrain(line);
  else toast('Kein Zug frei – die Linie wartet auf den nächsten.');
  hideHint();
  return line;
}

function deleteLine(line) {
  for (const tr of G.trains.filter(t => t.line === line)) removeTrain(tr);
  G.lines = G.lines.filter(l => l !== line);
  rebuildRoutes();
}

function addTrain(line) {
  if (G.trainsFree <= 0 || line.stations.length < 2) return false;
  G.trainsFree--;
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
  G.trainsFree++;
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
  const hw = Math.min(24, 7 + G.t / 25);
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
    if (G.stations.some(s => dist(s.x, s.y, x, y) < CFG.minStationDist)) continue;
    const onLine = G.lines.some(l => l.stations.some((id, i) => {
      const nId = l.stations[i + 1];
      if (!nId) return false;
      const a = stationById(id), b = stationById(nId);
      return distToSegment(x, y, a.x, a.y, b.x, b.y) < 0.9;
    }));
    if (onLine) continue;
    addStation(pickShape(), x, y);
    rebuildRoutes();
    return;
  }
}

/** Zielform für einen neuen Fahrgast (nicht die eigene, häufige Formen öfter). */
function pickDestination(own) {
  const counts = {};
  for (const s of G.stations) if (s.shape !== own) counts[s.shape] = (counts[s.shape] || 0) + 1;
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  const total = entries.reduce((a, [, n]) => a + Math.sqrt(n), 0);
  let r = Math.random() * total;
  for (const [shape, n] of entries) { r -= Math.sqrt(n); if (r <= 0) return shape; }
  return entries[0][0];
}

function update(dt) {
  G.t += dt;
  updateBounds();

  // Wochenwechsel → Upgrade wählen
  const week = Math.floor(G.t / (CFG.dayLength * 7)) + 1;
  if (week > G.week) {
    G.week = week;
    G.trainsFree++;
    showUpgrade();
    return;
  }

  // Neue Stationen
  G.stationTimer -= dt;
  if (G.stationTimer <= 0) {
    spawnStation();
    G.stationTimer = Math.max(7, 18 - G.week * 1.2) * rand(0.8, 1.2);
  }

  // Neue Fahrgäste und Überfüllung
  const rate = Math.min(0.35, 0.05 + 0.015 * G.week + G.t * 0.0004);
  for (const st of G.stations) {
    if (G.t - st.born > 3 && Math.random() < rate * dt) {
      const dest = pickDestination(st.shape);
      if (dest) st.queue.push(dest);
    }
    const cap = st.big ? CFG.bigCapacity : CFG.capacity;
    if (st.queue.length > cap) st.over += dt / CFG.overcrowdTime;
    else st.over = Math.max(0, st.over - dt / CFG.recoverTime);
    st.flash = Math.max(0, st.flash - dt);
    if (st.over >= 1) { gameOver(st); return; }
  }

  // Züge
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
    tr.t += (CFG.trainSpeed * dt) / len;
    if (tr.t >= 1) { tr.t = 1; arrive(tr); }
  }
}

/** Zug hält an Station b: aussteigen, umsteigen, einsteigen. */
function arrive(tr) {
  const st = stationById(tr.b);
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

  for (let i = 0; i < st.queue.length && tr.pax.length < CFG.trainCap;) {
    const p = st.queue[i];
    if (hops(p, next) < hops(p, st.id)) {
      tr.pax.push(p);
      st.queue.splice(i, 1);
      moved++;
    } else {
      i++;
    }
  }
  tr.dwell = 0.3 + 0.12 * moved;
}

/* =====================================================================
   6. KAMERA
   Passt die ganze Stadt in den freien Bereich zwischen Status oben und
   Stiften unten ein und zoomt weich heraus, wenn die Stadt wächst.
   ===================================================================== */

const cam = { s: 50, x: 0, y: 0, ready: false };

/** Freier Bildschirmbereich (CSS-Pixel) */
function view() {
  const w = window.innerWidth, h = window.innerHeight;
  const top = 78, bottom = 96, side = 24;
  return { w: w - 2 * side, h: h - top - bottom, cx: w / 2, cy: top + (h - top - bottom) / 2 };
}

function updateCamera(rdt) {
  const v = view();
  let { hw, hh } = G.bounds;
  for (const s of G.stations) { hw = Math.max(hw, Math.abs(s.x) + 1); hh = Math.max(hh, Math.abs(s.y) + 1); }
  const ts = Math.min(v.w / (2 * hw + 2), v.h / (2 * hh + 2));
  if (!cam.ready) { cam.s = ts; cam.ready = true; }
  cam.s += (ts - cam.s) * Math.min(1, rdt * 2);
}

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

/** Linien, Linienenden („Stiftkappen“) und die Griffe zum Verlängern */
function drawLines() {
  G.handles = [];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of G.lines) {
    const color = LINE_COLORS[line.color];
    const s = line.stations;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = CFG.lineWidth * cam.s;
    for (let i = 0; i < s.length - 1; i++) {
      const a = stationById(s[i]), b = stationById(s[i + 1]);
      const { ox, oy } = segmentOffset(line, a.id, b.id);
      wobblyStroke(a.x + ox, a.y + oy, b.x + ox, b.y + oy, line.id * 1000 + a.id * 31 + b.id);
    }
    ctx.globalAlpha = 1;

    // Stiftkappen an beiden Enden
    if (s.length >= 2) {
      for (const end of ['start', 'end']) {
        const st = stationById(end === 'end' ? s[s.length - 1] : s[0]);
        const prev = stationById(end === 'end' ? s[s.length - 2] : s[1]);
        const len = dist(prev.x, prev.y, st.x, st.y) || 1;
        const dx = (st.x - prev.x) / len, dy = (st.y - prev.y) / len;
        const { ox, oy } = segmentOffset(line, prev.id, st.id);
        const bx = st.x + ox + dx * CFG.stationR, by = st.y + oy + dy * CFG.stationR;
        const hx = st.x + ox + dx * (CFG.stationR + 0.9), hy = st.y + oy + dy * (CFG.stationR + 0.9);
        ctx.strokeStyle = color;
        ctx.lineWidth = CFG.lineWidth * cam.s;
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
    const w = 1.0 * cam.s, h = 0.5 * cam.s;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.fillStyle = LINE_COLORS[tr.line.color];
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = Math.max(1, 0.05 * cam.s);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.35);
    ctx.fill();
    ctx.stroke();
    // Fahrgäste als weiße Mini-Formen, 3 × 2
    ctx.fillStyle = '#fff';
    tr.pax.forEach((p, i) => {
      const cx = -w / 2 + w * (0.2 + 0.3 * (i % 3)), cy = (i < 3 ? -1 : 1) * h * 0.22;
      shapePath(p, cx, cy, 0.09 * cam.s);
      ctx.fill();
    });
    ctx.restore();
  }
}

function drawStations() {
  const R = CFG.stationR * cam.s;
  for (const st of G.stations) {
    const [sx, sy] = toScreen(st.x, st.y);
    const age = G.t - st.born;
    const pop = age < 0.35 ? (age < 0.2 ? smooth(age / 0.2) * 1.15 : 1.15 - 0.15 * smooth((age - 0.2) / 0.15)) : 1;
    const r = R * pop;

    // Überfüllung: roter Bogen wie mit dem Rotstift
    if (st.over > 0) {
      ctx.fillStyle = 'rgba(208, 52, 44, 0.12)';
      ctx.beginPath(); ctx.arc(sx, sy, 1.05 * cam.s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 0.12 * cam.s;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(sx, sy, 1.05 * cam.s, -Math.PI / 2, -Math.PI / 2 + st.over * Math.PI * 2); ctx.stroke();
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

    // Wartende Fahrgäste rechts neben der Station
    ctx.fillStyle = COLORS.pencil;
    const pr = 0.16 * cam.s, gap = 0.42 * cam.s;
    st.queue.forEach((p, i) => {
      const col = i % 6, row = Math.floor(i / 6);
      shapePath(p, sx + R + 0.45 * cam.s + col * gap, sy - 0.3 * cam.s + row * gap, pr);
      ctx.fill();
    });
  }
}

/** Vorschau beim Ziehen einer neuen Linie */
function drawDragPreview() {
  if (!drag || drag.mode !== 'new') return;
  const color = LINE_COLORS[drag.color];
  ctx.strokeStyle = color;
  ctx.lineWidth = CFG.lineWidth * cam.s;
  ctx.lineCap = 'round';
  for (let i = 0; i < drag.stations.length - 1; i++) {
    const a = stationById(drag.stations[i]), b = stationById(drag.stations[i + 1]);
    wobblyStroke(a.x, a.y, b.x, b.y, 7000 + a.id * 31 + b.id);
  }
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
  drawStations();
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
    if (st && !st.big) {
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
    const color = freeColor();
    if (color < 0) {
      toast('Alle Linien sind vergeben. Verlängere eine am Ende oder lösche eine.');
      return;
    }
    drag = { mode: 'new', stations: [st.id], color, x, y, id: e.pointerId };
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
    else if (!s.includes(st.id)) s.push(st.id);
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
    if (atEnd) s.pop(); else s.shift();
  } else if (!s.includes(st.id)) {
    if (atEnd) s.push(st.id); else s.unshift(st.id);
  } else {
    return;
  }
  rebuildRoutes();
  syncTrains(line);
}

function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'new' && drag.stations.length >= 2) {
    createLine(drag.stations, drag.color);
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
  setText('#trains-free', String(G.trainsFree));

  // Wochenuhr als Tortenstück
  const a = weekT * Math.PI * 2 - Math.PI / 2;
  const x = 20 + 15 * Math.cos(a), y = 20 + 15 * Math.sin(a);
  const pie = weekT < 0.001 ? '' : `M20 20 L20 5 A15 15 0 ${weekT > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
  if (hudCache.pie !== pie) { hudCache.pie = pie; $('#clock-pie').setAttribute('d', pie); }

  // Linien-Stifte
  const key = G.lines.map(l => `${l.color}:${G.trains.filter(t => t.line === l).length}`).join(',') + '|' + G.maxLines;
  if (hudCache.pens !== key) { hudCache.pens = key; renderPens(); }

  // Hinweis am Anfang
  const hint = $('#hint');
  const showHint = G.state === 'playing' && G.lines.length === 0 && !drag;
  if (hint.hidden === showHint) {
    hint.hidden = !showHint;
    hint.textContent = 'Zieh mit dem Stift von einer Station zur nächsten.';
  }
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('is-active', +b.dataset.speed === G.speed);
}

function hideHint() { $('#hint').hidden = true; }

function renderPens() {
  const box = $('#pens');
  box.innerHTML = '';
  for (let c = 0; c < G.maxLines; c++) {
    const line = G.lines.find(l => l.color === c);
    const b = document.createElement('button');
    b.className = 'pen' + (line ? ' used' : '');
    b.style.setProperty('--c', LINE_COLORS[c]);
    b.setAttribute('aria-label', line ? `Linie ${c + 1}` : `Freie Linie ${c + 1}`);
    if (line) {
      const n = G.trains.filter(t => t.line === line).length;
      b.innerHTML = `<span class="pen-trains">${n}</span>`;
      b.addEventListener('click', () => openLineMenu(line, b));
    } else {
      b.addEventListener('click', () => toast('Freier Stift: Zieh auf dem Plan von Station zu Station.'));
    }
    box.appendChild(b);
  }
}

let menuLine = null;
function openLineMenu(line, anchor) {
  if (menuLine === line) { closeLineMenu(); return; }
  menuLine = line;
  const m = $('#line-menu');
  const n = G.trains.filter(t => t.line === line).length;
  $('#lm-add').disabled = G.trainsFree <= 0;
  $('#lm-remove').disabled = n === 0;
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
  if (menuLine && addTrain(menuLine)) toast('Zug eingesetzt.');
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
  b.addEventListener('click', () => { G.speed = +b.dataset.speed; });
}

/* ---------- Upgrade am Wochenende ---------- */

const UPGRADES = [
  {
    key: 'line', title: 'Neue Linie', text: 'Ein weiterer Stift für eine neue Linie.',
    icon: '<path d="M8 46 C 20 30, 34 30, 46 8"/><circle cx="8" cy="46" r="4"/><circle cx="46" cy="8" r="4"/>',
    ok: () => G.maxLines < CFG.maxLines,
    apply: () => { G.maxLines++; },
  },
  {
    key: 'train', title: 'Extra-Zug', text: 'Noch ein Zug zum Einsetzen.',
    icon: '<rect x="9" y="12" width="36" height="24" rx="6"/><path d="M9 25h36M18 42l-3 5M36 42l3 5"/>',
    ok: () => true,
    apply: () => { G.trainsFree++; },
  },
  {
    key: 'big', title: 'Großer Bahnhof', text: 'Eine Station fasst 12 statt 6 Fahrgäste.',
    icon: '<circle cx="27" cy="27" r="11"/><circle cx="27" cy="27" r="19"/>',
    ok: () => G.stations.some(s => !s.big),
    apply: () => { G.state = 'placeBig'; toast('Tippe auf die Station, die größer werden soll.', 4000); },
  },
];

function showUpgrade() {
  G.state = 'upgrade';
  closeLineMenu();
  drag = null;
  $('#up-title').textContent = `Woche ${G.week - 1} geschafft!`;
  const box = $('#up-cards');
  box.innerHTML = '';
  for (const up of UPGRADES.filter(u => u.ok())) {
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = `<svg class="ico" viewBox="0 0 54 54">${up.icon}</svg><b>${up.title}</b><small>${up.text}</small>`;
    b.addEventListener('click', () => {
      $('#screen-upgrade').hidden = true;
      G.state = 'playing';
      up.apply();
    });
    box.appendChild(b);
  }
  $('#screen-upgrade').hidden = false;
}

/* ---------- Start und Ende ---------- */

function gameOver(st) {
  G.state = 'over';
  G.lostStation = st;
  drag = null;
  closeLineMenu();
  const rec = best.get();
  const isNew = G.score > rec;
  if (isNew) best.set(G.score);
  $('#over-reason').textContent = `Die ${SHAPE_NAME[st.shape]}-Station war zu lange überfüllt.`;
  $('#over-score').textContent = G.score;
  $('#over-weeks').textContent = G.week;
  $('#over-record').textContent = isNew ? 'Neuer Rekord!' : rec ? `Rekord: ${rec} Fahrgäste` : '';
  // Kurz zeigen, welche Station es war, dann den Zettel
  setTimeout(() => { $('#screen-over').hidden = false; }, 900);
}

function showStart() {
  const rec = best.get();
  $('#start-record').textContent = rec ? `Dein Rekord: ${rec} Fahrgäste` : '';
  $('#screen-start').hidden = false;
}

$('#btn-start').addEventListener('click', () => {
  $('#screen-start').hidden = true;
  G.state = 'playing';
});
$('#btn-again').addEventListener('click', () => {
  $('#screen-over').hidden = true;
  newGame();
  cam.ready = false;
  G.state = 'playing';
});

// App im Hintergrund → automatisch pausieren
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'playing') G.speed = 0;
});

/* =====================================================================
   10. START
   ===================================================================== */

let lastFrame = performance.now();
function frame(now) {
  const rdt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (G.state === 'playing' && G.speed > 0) update(rdt * G.speed);
  updateCamera(rdt);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
newGame();
showStart();
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
};
