/* =====================================================================
   MetroRush – game.js
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
const LINE_COLORS = ['#d23b2f', '#2456c9', '#2f9e4f', '#ef8a17', '#8a3fb8', '#1199a8', '#8b5a2b', '#d81b7a', '#6d7f12', '#1f3a7a',
  '#c2185b', '#00897b', '#5c6bc0', '#a1887f'];

const COMMON_SHAPES = ['circle', 'triangle', 'square'];
const RARE_SHAPES = ['star', 'diamond', 'cross'];
const ALL_SHAPES = ['hub', ...COMMON_SHAPES, ...RARE_SHAPES];
const SHAPE_NAME = {
  circle: 'Kreis', triangle: 'Dreieck', square: 'Quadrat',
  star: 'Stern', diamond: 'Rauten', cross: 'Kreuz', hub: 'Hauptbahnhof',
};

/**
 * Die fünf Verkehrsmittel. Jedes fährt anders und hat ein eigenes Netz:
 *   Bus groß und kleinräumig, Tram/U-Bahn mittel, S-Bahn und Zug klein, aber weit.
 *   speed  Tempo in U pro Sekunde     cap      Plätze
 *   dwell  Grund-Haltezeit (s)        perPax   Sekunden pro ein-/aussteigendem Fahrgast
 *   maxStops  Haltestellen pro Linie  maxLines Linien höchstens (durch Upgrades)
 *   maxHop / minHop  größter / kleinster Abstand zwischen zwei Halten (U, 1 U ≈ 300 m)
 *   tier   Mindest-Stationsart, an der das Verkehrsmittel halten kann (siehe TIERS)
 *   needsHub  Linie muss den Hauptbahnhof enthalten
 */
const MODES = {
  bus: {
    name: 'Bus', vehicle: 'Bus', lineName: 'Buslinie', none: 'Kein Bus frei', no: 'kein Bus', gift: 'einen Bus', one: 'Ein Bus', the: 'den Bus', two: '2 Busse', style: 'dashed', tier: 'bus',
    speed: 1.6, cap: 4, dwell: 0.25, perPax: 0.15, maxStops: Infinity, maxLines: 5, startLines: 3, startVehicles: 4,
    maxHop: 12, minHop: 0,
    body: { w: 0.8, h: 0.46, parts: 1 },
    icon: '<rect x="4.5" y="4" width="15" height="13" rx="3"/><path d="M4.5 11h15M8 20.5v-3.5M16 20.5v-3.5"/>',
  },
  tram: {
    name: 'Tram', vehicle: 'Tram', lineName: 'Tramlinie', none: 'Keine Tram frei', no: 'keine Tram', gift: 'eine Tram', one: 'Eine Tram', the: 'die Tram', style: 'rails', tier: 'tram',
    speed: 2.2, cap: 6, dwell: 0.2, perPax: 0.07, maxStops: 12, maxLines: 3, startLines: 1, startVehicles: 2,
    maxHop: 15, minHop: 0,
    body: { w: 1.35, h: 0.36, parts: 2 },
    icon: '<rect x="5" y="7.5" width="14" height="10.5" rx="3"/><path d="M9 3h6M12 3v4.5M5 13h14M8 21l1.5-3M16 21l-1.5-3"/>',
  },
  metro: {
    name: 'U-Bahn', vehicle: 'U-Bahn', lineName: 'U-Bahn-Linie', none: 'Keine U-Bahn frei', no: 'keine U-Bahn', gift: 'eine U-Bahn', one: 'Eine U-Bahn', the: 'die U-Bahn', style: 'solid', tier: 'metro',
    speed: 2.8, cap: 6, dwell: 0.3, perPax: 0.12, maxStops: 99, maxLines: 3, startLines: 1, startVehicles: 2,
    maxHop: 22, minHop: 0,
    body: { w: 1.0, h: 0.5, parts: 1 },
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M8.7 7.8v4.7a3.3 3.3 0 0 0 6.6 0V7.8"/>',
  },
  sbahn: {
    name: 'S-Bahn', vehicle: 'S-Bahn', lineName: 'S-Bahn-Linie', none: 'Keine S-Bahn frei', no: 'keine S-Bahn', gift: 'eine S-Bahn', one: 'Eine S-Bahn', the: 'die S-Bahn', style: 'sbahn', tier: 'rail',
    speed: 3.6, cap: 8, dwell: 0.6, perPax: 0.09, maxStops: 9, maxLines: 2, startLines: 1, startVehicles: 1, needsHub: true,
    maxHop: 99, minHop: 0,
    body: { w: 1.5, h: 0.46, parts: 2 },
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M15 8.6c-.8-.9-1.9-1.3-3.1-1.3-1.6 0-2.8.9-2.8 2.2 0 2.9 6.2 1.7 6.2 4.8 0 1.4-1.3 2.4-3.1 2.4-1.4 0-2.6-.5-3.4-1.5"/>',
  },
  rail: {
    name: 'Zug', vehicle: 'Zug', lineName: 'Zugstrecke', none: 'Kein Zug frei', no: 'kein Zug', gift: 'einen Zug', one: 'Ein Zug', the: 'den Zug', style: 'track', tier: 'rail',
    speed: 4.4, cap: 10, dwell: 0.9, perPax: 0.08, maxStops: 6, maxLines: 2, startLines: 1, startVehicles: 1, needsHub: true,
    maxHop: 99, minHop: 10,
    body: { w: 2.1, h: 0.46, parts: 3 },
    icon: '<path d="M6.5 18V8.5a4.5 4.5 0 0 1 4.5-4.5h2a4.5 4.5 0 0 1 4.5 4.5V18z"/><path d="M6.5 12.5h11M8 21.5l1.5-3.5M16 21.5l-1.5-3.5"/>',
  },
};
const MODE_ORDER = ['bus', 'tram', 'metro', 'sbahn', 'rail'];

/** Liniennamen je Verkehrsmittel (angelehnt an Hannover), werden der Reihe nach vergeben */
let LINE_NAMES = {
  bus: ['100', '121', '128', '134', '200'],
  tram: ['10', '17', '11'],
  metro: ['U1', 'U2', 'U3'],
  sbahn: ['S1', 'S5'],
  rail: ['RE2', 'RE3'],
};

/**
 * Ereignisse in Hannover: Viele wollen zur Station nahe dem Ort (Anreise),
 * am Ende reisen alle auf einmal ab. at: Kartenpunkt in U (siehe HANNOVER).
 */
let EVENTS = [
  { key: '96', name: '96-Spiel', place: 'Stadion', text: 'Hannover 96 spielt – alle wollen ins Stadion!' },
  { key: 'messe', name: 'Messe', place: 'Messe', text: 'Messe in Hannover – Besuch aus aller Welt!' },
  { key: 'maschsee', name: 'Maschseefest', place: 'Maschsee', text: 'Maschseefest – die halbe Stadt will an den See!' },
  { key: 'zoo', name: 'Zoo-Tag', place: 'Zoo', text: 'Sonnentag – viele Familien wollen in den Zoo.' },
];

/**
 * Stationsarten, aufsteigend. Ein Verkehrsmittel hält an seiner Art und allen höheren.
 * Der Hauptbahnhof ist immer 'rail' – dort hält alles.
 */
const TIERS = ['bus', 'tram', 'metro', 'rail'];
const TIER_INFO = {
  bus: { name: 'Bushaltestelle', a: 'eine', badge: '', r: 0.42 },
  tram: { name: 'Tram-Halt', a: 'ein', badge: 'T', r: 0.55 },
  metro: { name: 'U-Bahn-Station', a: 'eine', badge: 'U', r: 0.55 },
  rail: { name: 'Bahnhof', a: 'ein', badge: 'S', r: 0.6 },
};
const tierRank = t => TIERS.indexOf(t);
/** Darf dieses Verkehrsmittel an der Station halten? */
const servesMode = (st, mode) => st.shape === 'hub' || tierRank(st.tier || 'metro') >= tierRank(MODES[mode].tier);

/* ---------- Karte von Hannover ----------
   Grobe Skizze aus dem Gedächtnis – nicht kartengenau! Angaben in km
   relativ zum Hauptbahnhof (x nach Osten, y nach Süden). 1 Kästchen (U)
   entspricht etwa 300 m; umgerechnet wird mit km().                    */
const KM_PER_U = 0.3;
const km = pts => pts.map(([x, y]) => [x / KM_PER_U, y / KM_PER_U]);

let HANNOVER = {
  water: [
    { name: 'Leine', width: 0.6, label: 8, pts: km([[2.2, 10.5], [1.6, 9.0], [1.2, 7.5], [0.9, 6.0], [0.4, 4.6], [-0.2, 3.6], [-0.35, 2.6], [-0.3, 1.6], [-0.55, 0.9], [-0.75, 0.3], [-1.2, -0.1], [-1.7, -0.4], [-2.4, -0.8], [-3.4, -1.1], [-3.9, -1.9], [-4.4, -2.9], [-5.4, -3.6], [-7.0, -4.6], [-8.5, -5.6], [-10.5, -6.5]]) },
    { name: 'Ihme', width: 0.42, label: 2, pts: km([[-3.0, 5.5], [-2.6, 4.4], [-2.0, 3.2], [-1.7, 2.2], [-1.35, 1.3], [-1.3, 0.6], [-1.45, 0.0], [-1.7, -0.4]]) },
    { name: 'Mittellandkanal', width: 0.45, label: 8, pts: km([[-13.0, 1.0], [-11.0, 0.0], [-9.0, -0.8], [-7.0, -1.7], [-5.6, -2.5], [-4.6, -3.4], [-3.2, -3.4], [-1.5, -3.6], [0.5, -3.4], [2.5, -3.0], [4.5, -2.4], [6.5, -1.6], [8.0, -1.2], [9.5, -0.2], [11.5, 1.0], [13.5, 2.2]]) },
  ],
  lakes: [
    { name: 'Maschsee', pts: km([[0.25, 1.35], [0.55, 1.4], [0.65, 2.2], [0.6, 3.1], [0.4, 3.45], [0.2, 3.3], [0.15, 2.4]]) },
  ],
  green: [
    { name: 'Eilenriede', pts: km([[1.9, -1.6], [2.6, -1.9], [3.3, -1.2], [3.6, -0.2], [3.4, 0.9], [3.0, 1.9], [2.5, 2.4], [2.1, 1.6], [2.2, 0.6], [1.9, -0.4]]) },
    { name: 'Herrenhäuser Gärten', pts: km([[-3.2, -1.8], [-2.6, -1.8], [-2.5, -1.2], [-3.1, -1.15]]) },
  ],
  // Umland: Nachbarorte rund um Hannover (nur Beschriftung, grob)
  towns: [
    ['Langenhagen', 0.8, -8.5], ['Flughafen', -1.0, -11.0], ['Isernhagen', 6.5, -8.5], ['Garbsen', -10.5, -4.0],
    ['Seelze', -11.5, 0.8], ['Ronnenberg', -7.5, 7.5], ['Hemmingen', -1.5, 8.8], ['Laatzen', 3.2, 9.0], ['Lehrte', 13.0, -1.5],
    ['Burgdorf', 17.0, -7.0], ['Wunstorf', -19.0, -1.5], ['Sarstedt', 4.5, 14.0],
  ].map(([name, x, y]) => ({ name, at: [x / KM_PER_U, y / KM_PER_U] })),
  pois: [
    { name: 'Rathaus', at: km([[-0.15, 1.05]])[0] },
    { name: 'Zoo', at: km([[2.25, -0.75]])[0] },
    { name: 'Stadion', at: km([[-0.68, 1.84]])[0] },
    { name: 'Messe', at: km([[6.6, 7.0]])[0] },
  ],
  // Die ersten drei sind die Startstationen. Die Stationsart (tier) steht in DISTRICT_TIER.
  districts: [
    ['List', 1.4, -2.1], ['Linden-Nord', -2.3, 0.1], ['Südstadt', 1.3, 2.0],
    ['Oststadt', 1.1, -0.5], ['Nordstadt', -1.2, -1.3], ['Calenberger Neustadt', -1.0, 0.9], ['Bult', 1.4, 0.75],
    ['Vahrenwald', -0.1, -2.6], ['Hainholz', -1.6, -2.9], ['Linden-Mitte', -3.0, 0.9], ['Linden-Süd', -2.3, 1.9],
    ['Herrenhausen', -3.0, -2.4], ['Kleefeld', 4.0, 0.6], ['Limmer', -4.3, -0.4], ['Waldhausen', 0.9, 3.8],
    ['Döhren', 1.6, 5.0], ['Ricklingen', -3.1, 3.9], ['Oberricklingen', -3.6, 2.6], ['Groß-Buchholz', 5.0, -1.6],
    ['Bothfeld', 3.8, -4.2], ['Vahrenheide', 0.4, -4.6], ['Kirchrode', 5.8, 2.4], ['Heideviertel', 5.3, 0.4],
    ['Seelhorst', 3.6, 3.8], ['Badenstedt', -5.6, 1.6], ['Stöcken', -4.6, -4.3], ['Burg', -2.6, -4.3],
    ['Sahlkamp', 2.2, -5.0], ['Wülfel', 1.8, 6.4], ['Mittelfeld', 3.4, 6.2], ['Bemerode', 5.4, 4.6],
    ['Mühlenberg', -4.3, 4.6], ['Misburg', 8.2, -0.4], ['Davenstedt', -7.0, 0.8], ['Wettbergen', -5.8, 5.6],
    ['Ahlem', -7.0, -1.2], ['Marienwerder', -6.3, -3.3], ['Ledeburg', -4.6, -5.6], ['Lahe', 6.5, -4.0],
    ['Anderten', 9.0, 2.0], ['Kronsberg', 6.8, 5.6], ['Isernhagen-Süd', 5.0, -6.0],
    // Umland: lange Strecken für S-Bahn und Zug
    ['Langenhagen', 0.8, -8.5], ['Messe', 6.6, 7.0], ['Laatzen', 3.2, 9.0], ['Hemmingen', -1.5, 8.8],
    ['Garbsen', -10.5, -4.0], ['Isernhagen', 6.5, -8.5], ['Seelze', -11.5, 0.8], ['Ronnenberg', -7.5, 7.5],
    ['Flughafen', -1.0, -11.0], ['Lehrte', 13.0, -1.5], ['Sarstedt', 4.5, 14.0], ['Wunstorf', -19.0, -1.5],
    ['Burgdorf', 17.0, -7.0],
  ].map(([name, x, y]) => ({ name, x: Math.round(x / KM_PER_U), y: Math.round(y / KM_PER_U) })),
};

/**
 * Stationsart je Stadtteil – grob angelehnt an Hannovers S-Bahn- und Stadtbahnnetz,
 * aber fürs Spiel vereinfacht. Nicht genannte Stadtteile sind Bushaltestellen.
 */
let DISTRICT_TIER = {
  rail: ['Nordstadt', 'Linden-Süd', 'Kleefeld', 'Misburg', 'Anderten', 'Ledeburg', 'Wülfel', 'Kronsberg',
    'Langenhagen', 'Messe', 'Seelze', 'Flughafen', 'Lehrte', 'Sarstedt', 'Wunstorf', 'Burgdorf'],
  metro: ['List', 'Oststadt', 'Südstadt', 'Vahrenwald', 'Linden-Mitte', 'Calenberger Neustadt', 'Döhren',
    'Groß-Buchholz', 'Kirchrode', 'Bothfeld', 'Stöcken', 'Laatzen', 'Garbsen'],
  tram: ['Linden-Nord', 'Bult', 'Hainholz', 'Herrenhausen', 'Limmer', 'Ricklingen', 'Oberricklingen', 'Waldhausen',
    'Vahrenheide', 'Sahlkamp', 'Bemerode', 'Mühlenberg', 'Wettbergen', 'Badenstedt', 'Hemmingen', 'Ronnenberg'],
};
const tierOfDistrict = name => Object.keys(DISTRICT_TIER).find(t => DISTRICT_TIER[t].includes(name)) || 'bus';

/** Punkt in Polygon (für See, Wald – Zufalls-Stationen landen nicht im Wasser) */
function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Liegt der Punkt im oder zu nah am Wasser / im Wald (bzw. in Europa: nicht an Land)? */
function onMapFeature(x, y) {
  if (HANNOVER.land) {
    return !HANNOVER.land.some(p => inPolygon(x, y, p)) || HANNOVER.innerSeas.some(sea => inPolygon(x, y, sea.pts));
  }
  for (const w of HANNOVER.water) {
    for (let i = 0; i < w.pts.length - 1; i++) {
      if (distToSegment(x, y, w.pts[i][0], w.pts[i][1], w.pts[i + 1][0], w.pts[i + 1][1]) < 1.2) return true;
    }
  }
  return [...HANNOVER.lakes, ...HANNOVER.green].some(a => inPolygon(x, y, a.pts));
}

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Aktive Spielwelt (Hannover oder Europa) – wird von applyScenario() gesetzt */
let SC = null;
/** Sekunden pro Spieltag – Europa läuft gemächlicher als Hannover */
const dayLen = () => SC?.dayLength || CFG.dayLength;

/** Spiel-Balance – hier lässt sich alles feinjustieren */
const CFG = {
  dayLength: 12,          // Sekunden pro Spieltag (1 Woche = 7 Tage)
  stationR: 0.55,         // Radius einer Station in U
  capacity: 6,            // Fahrgäste, ab denen eine Station überfüllt ist
  bigCapacity: 12,        // … beim großen Bahnhof
  hubCapacity: 18,        // … am Hauptbahnhof
  hubR: 0.9,              // Radius des Hauptbahnhofs in U
  hubShare: 0.22,         // Anteil der Fahrgäste, die zum Hauptbahnhof wollen
  overcrowdTime: 50,      // Sekunden Überfüllung bis Game Over
  nodeBonus: 6,           // Umsteigeknoten: zusätzliche Plätze
  nodeBoarding: 0.4,      // Umsteigeknoten: Faktor für die Ein-/Aussteigezeit
  eventDays: 1.5,         // Dauer eines Ereignisses in Spieltagen
  eventShare: 0.35,       // Anteil neuer Fahrgäste, die zum Ereignis wollen
  recoverTime: 80,        // Sekunden, bis sich der Timer wieder ganz erholt
  minStationDist: 3.6,    // Mindestabstand neuer Stationen (größer = übersichtlicher)
  minLineDist: 1.3,       // Mindestabstand neuer Stationen zu bestehenden Linien
  maxCity: 40,            // maximale halbe Stadtbreite in U
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
const bestKey = w => 'heftmetro.best' + (w && w !== 'hannover' ? '.' + w : '');
const best = {
  get(w = SC?.key) { try { return +localStorage.getItem(bestKey(w)) || 0; } catch { return 0; } },
  set(v, w = SC?.key) { try { localStorage.setItem(bestKey(w), String(v)); } catch { /* egal */ } },
};

/* =====================================================================
   3. SPIELZUSTAND
   ===================================================================== */

/** @type {any} Der komplette Zustand einer Runde */
let G;

/**
 * Fokus zu Beginn: wie viele Linien man pro Verkehrsmittel am Start hat
 * (Reihenfolge wie MODE_ORDER: Bus/Propeller, Tram/Regionaljet, U-Bahn/Mittelstrecke,
 * S-Bahn/Großraumjet, Zug/Jumbo). Fahrzeuge kommen mit jeder Linie automatisch.
 */
const FOCUS_LINES = {
  bus: [4, 1, 1, 0, 0],
  city: [1, 2, 2, 1, 0],
  rail: [1, 0, 1, 2, 2],
  balanced: [2, 1, 1, 1, 1],
};

function newGame(world = SC?.key || 'hannover', focus = 'balanced') {
  applyScenario(world);
  const startLines = FOCUS_LINES[focus] || FOCUS_LINES.balanced;
  if (typeof cam !== 'undefined') cam.manual = false;
  G = {
    state: 'start',        // start | playing | upgrade | placeBig | placeTier | over
    placeTier: null,       // beim Ausbau: Ziel-Stationsart ('tram' | 'metro' | 'rail')
    event: null,           // laufendes Ereignis { key, stationId, end }
    nextEventT: dayLen() * 7 * 1.3,   // frühestens Woche 2
    speed: 1,              // 0 = Pause, 1 = normal, 2 = schnell
    t: 0,                  // Spielzeit in Sekunden
    week: 1,
    score: 0,
    nextId: 1,
    stations: [],
    lines: [],
    trains: [],
    // Pro Verkehrsmittel: freie Linien-Plätze und freie Fahrzeuge
    inv: Object.fromEntries(MODE_ORDER.map((m, i) => [m, { lines: startLines[i], free: 0 }])),
    focus,                 // gewählter Fokus (nur zur Info)
    // Unternehmer-Modus (Europa)
    money: SC.business ? SC.business.start : 0,
    price: 'normal',       // Ticketpreis: cheap | normal | premium
    marketingUntil: 0,     // Werbekampagne läuft bis zu dieser Spielzeit
    weekRev: 0,            // Umsatz der laufenden Woche
    weekCost: 0,           // Kosten der laufenden Woche
    history: [],           // Gewinn der vergangenen Wochen
    floaters: [],          // aufsteigende „+90.000 €“ (wird nicht gespeichert)
    selectedMode: MODE_ORDER[startLines.indexOf(Math.max(...startLines))],   // womit neue Linien gezogen werden
    bounds: { hw: 9, hh: 6 },   // halbe Breite/Höhe der Stadt in U
    stationTimer: 10,
    dist: new Map(),       // Form → Map(Station-ID → Anzahl Haltestellen bis dorthin)
    handles: [],           // Linienenden zum Anfassen (pro Bild neu berechnet)
    lostStation: null,
    resumeState: null,     // Zustand, zu dem „Weiterspielen“ zurückkehrt
    tutorial: false,       // läuft gerade die Anleitung?
    world: SC.key,         // Spielwelt: 'hannover' | 'europa'
    districtsLeft: HANNOVER.districts.map(d => d.name),   // noch nicht erschlossene Stadtteile
    buildChoice: null,     // Vorschläge für die nächste Station: { opts: [...], until }
    sandbox: false,        // Sandbox: frei bauen, kein Game Over
    tool: 'lines',         // Sandbox-Werkzeug: lines | build | tier | shape | move | remove
    sbShape: 'circle', sbTier: 'auto', sbDemand: 1, sbTab: 'build', sbEvent: null, sbMin: false,
  };
  // Hauptbahnhof in der Mitte, drei Stadtteile darum (List, Linden-Nord, Südstadt) – Formen gemischt
  addStation('hub', 0, 0, SC.hubName, 'rail');
  const shapes = [...COMMON_SHAPES].sort(() => Math.random() - 0.5);
  HANNOVER.districts.slice(0, 3).forEach((d, i) => addStation(shapes[i], d.x, d.y, d.name, tierOfDistrict(d.name)));
  G.districtsLeft = G.districtsLeft.slice(3);
  for (const st of G.stations) st.born = -10;   // Startstationen sind sofort da (kein Aufploppen)
  rebuildRoutes();
}

const stationById = id => G.stations.find(s => s.id === id);
const hub = () => G.stations.find(s => s.shape === 'hub');
/** Radius einer Station in U (Hauptbahnhof ist größer) */
const stationR = st => (st.shape === 'hub' ? CFG.hubR : TIER_INFO[st.tier || 'metro'].r);
const capacityOf = st => (st.shape === 'hub' ? CFG.hubCapacity : st.big ? CFG.bigCapacity : CFG.capacity) + (st.node ? CFG.nodeBonus : 0);
const vehiclesOn = line => G.trains.filter(t => t.line === line).length;
const linesOf = mode => G.lines.filter(l => l.mode === mode);

/** Abschnitte einer Linie als [a, b]-Paare – bei Ringlinien inkl. letzter → erster Station */
function segs(line) {
  const s = line.stations, out = [];
  for (let i = 0; i < s.length - 1; i++) out.push([s[i], s[i + 1]]);
  if (line.loop && s.length >= 3) out.push([s[s.length - 1], s[0]]);
  return out;
}
/** Liegen a und b auf der Linie direkt nebeneinander? */
function adjacent(line, a, b) {
  const s = line.stations, n = s.length, i = s.indexOf(a), j = s.indexOf(b);
  if (i < 0 || j < 0) return false;
  return Math.abs(i - j) === 1 || (line.loop && n >= 3 && Math.abs(i - j) === n - 1);
}

function addStation(shape, x, y, name = '', tier = 'bus') {
  const st = { id: G.nextId++, x, y, shape, name, tier, queue: [], over: 0, big: false, born: G.t, flash: 0 };
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
    for (const [a, b] of segs(line)) {
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
  const s = line.stations, n = s.length;
  const ia = s.indexOf(a), ib = s.indexOf(b);
  if (line.loop && n >= 3 && ib >= 0) {
    // Ring: immer in derselben Richtung weiter
    const dir = (ia + 1) % n === ib ? 1 : -1;
    return s[(ib + dir + n) % n];
  }
  const dir = ib > ia ? 1 : -1;
  return s[ib + dir] ?? s[ib - dir] ?? b;
}

/** Versatz paralleler Linien auf demselben Abschnitt (in U, senkrecht zur Strecke). */
function segmentOffset(line, a, b) {
  const shared = G.lines.filter(l => adjacent(l, a, b));
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

/** Nächster freier Liniennamen für ein Verkehrsmittel (z. B. „U2“) */
function nextLineName(mode) {
  const used = new Set(G.lines.map(l => l.label));
  return LINE_NAMES[mode].find(n => !used.has(n)) || `${MODES[mode].name[0]}${G.nextId}`;
}

function createLine(stationIds, color, mode) {
  const line = { id: G.nextId++, color, mode, label: nextLineName(mode), stations: stationIds.slice() };
  G.lines.push(line);
  rebuildRoutes();
  if (G.inv[mode].free <= 0) G.inv[mode].free++;   // jede neue Linie bringt ihr Fahrzeug mit
  addTrain(line);
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

/**
 * Welches Verkehrsmittel braucht am dringendsten ein Fahrzeug?
 *   1. eines mit Linien ohne Fahrzeug (die meisten Wartenden zuerst)
 *   2. sonst das mit den meisten Wartenden pro Fahrzeug
 *   3. sonst der Bus
 */
function neededMode() {
  const waitingOn = line => line.stations.reduce((a, id) => a + (stationById(id)?.queue.length || 0), 0);
  const empty = G.lines.filter(l => vehiclesOn(l) === 0 && l.stations.length >= 2)
    .sort((a, b) => waitingOn(b) - waitingOn(a));
  if (empty.length) return empty[0].mode;
  let best = 'bus', bestLoad = -1;
  for (const m of MODE_ORDER) {
    const ls = linesOf(m);
    if (!ls.length) continue;
    const load = ls.reduce((a, l) => a + waitingOn(l), 0) / Math.max(1, ls.reduce((a, l) => a + vehiclesOn(l), 0));
    if (load > bestLoad) { bestLoad = load; best = m; }
  }
  return best;
}

/**
 * Wochengeschenk: ein Fahrzeug für das Verkehrsmittel mit dem größten Bedarf,
 * direkt eingesetzt – zuerst auf Linien ohne Fahrzeug, sonst auf der vollsten Linie.
 */
function giveWeeklyVehicle() {
  const mode = neededMode();
  G.gift = mode;
  G.giftLine = null;
  G.inv[mode].free++;
  if (autoAssignVehicles()) return;
  const waiting = l => l.stations.reduce((a, id) => a + (stationById(id)?.queue.length || 0), 0) / (vehiclesOn(l) + 1);
  const line = linesOf(mode).filter(l => l.stations.length >= 2).sort((a, b) => waiting(b) - waiting(a))[0];
  if (line && addTrain(line)) G.giftLine = line.label;
}

/** Freie Fahrzeuge automatisch auf Linien setzen, auf denen noch keins fährt */
function autoAssignVehicles() {
  let placed = 0;
  for (const line of G.lines) {
    if (vehiclesOn(line) === 0 && G.inv[line.mode].free > 0 && addTrain(line)) placed++;
  }
  return placed;
}

/** Nach einer Änderung an der Linie: Züge auf gültige Abschnitte setzen. */
function syncTrains(line) {
  const s = line.stations;
  for (const tr of G.trains) {
    if (tr.line !== line || s.length < 2) continue;
    const ia = s.indexOf(tr.a), ib = s.indexOf(tr.b);
    if (adjacent(line, tr.a, tr.b)) continue;     // Abschnitt gibt es noch
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

/**
 * Neue Station: bevorzugt im nächsten noch freien Stadtteil von Hannover
 * (zufällig unter den vier, die dem Hauptbahnhof am nächsten sind – so
 * wächst die Stadt von innen nach außen). Sind alle Stadtteile erschlossen,
 * entsteht die Station an einem freien Punkt abseits von Wasser und Wald.
 */
function spawnStation() {
  while (G.districtsLeft.length) {
    const near = G.districtsLeft
      .map(name => HANNOVER.districts.find(d => d.name === name))
      .filter(Boolean)
      .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
      .slice(0, 4);
    if (!near.length) { G.districtsLeft = []; break; }
    const d = near[Math.floor(Math.random() * near.length)];
    G.districtsLeft = G.districtsLeft.filter(n => n !== d.name);
    if (G.stations.some(s => dist(s.x, s.y, d.x, d.y) < 2.5)) continue;   // zu nah an einer anderen Station
    notifyNewStation(addStation(pickShape(), d.x, d.y, d.name, tierOfDistrict(d.name)));
    rebuildRoutes();
    return;
  }
  const { hw, hh } = G.bounds;
  for (let tries = 0; tries < 80; tries++) {
    const x = Math.round(rand(-hw + 1, hw - 1));
    const y = Math.round(rand(-hh + 1, hh - 1));
    if (G.stations.some(s => dist(s.x, s.y, x, y) < CFG.minStationDist + (s.shape === 'hub' ? 1.2 : 0))) continue;
    if (onMapFeature(x, y)) continue;
    const r = Math.random();
    const tier = r < 0.4 ? 'bus' : r < 0.65 ? 'tram' : r < 0.85 ? 'metro' : 'rail';
    const onLine = G.lines.some(l => segs(l).some(([id, nId]) => {
      const a = stationById(id), b = stationById(nId);
      return distToSegment(x, y, a.x, a.y, b.x, b.y) < CFG.minLineDist;
    }));
    if (onLine) continue;
    notifyNewStation(addStation(pickShape(), x, y, '', tier));
    rebuildRoutes();
    return;
  }
}

/* ---------- Nächste Station selbst aussuchen ----------
   Statt zufällig entsteht die nächste Station dort, wo du willst:
   Es erscheinen Vorschläge am Rand deines Netzes (die nächstgelegenen
   noch freien Stadtteile). Wer nicht wählt, bekommt nach Ablauf der Zeit
   einen zufälligen. So wächst das Netz in die Richtung, die du ausbaust. */

const CHOICE_COUNT = 5;

function offerBuildChoice(time) {
  const near = d => Math.min(...G.stations.map(s => dist(s.x, s.y, d.x, d.y)));
  const ds = G.districtsLeft.map(n => HANNOVER.districts.find(d => d.name === n)).filter(Boolean);
  const tooClose = ds.filter(d => near(d) < 2.5).map(d => d.name);
  G.districtsLeft = G.districtsLeft.filter(n => !tooClose.includes(n));
  const opts = ds.filter(d => !tooClose.includes(d.name))
    .sort((a, b) => near(a) - near(b))
    .slice(0, CHOICE_COUNT)
    .map(d => ({ name: d.name, x: d.x, y: d.y, tier: tierOfDistrict(d.name), shape: pickShape() }));
  if (opts.length < 2) return false;
  G.buildChoice = { opts, until: G.t + Math.max(6, time), total: Math.max(6, time) };
  if (!G.choiceExplained) {
    G.choiceExplained = true;
    toast(`Wo soll die nächste Station hin? Tippe auf einen gestrichelten Vorschlag – sonst entscheidet der Zufall.`, 4200);
  }
  return true;
}

function resolveBuildChoice(opt) {
  const c = G.buildChoice;
  if (!c) return;
  opt = opt || c.opts[Math.floor(Math.random() * c.opts.length)];
  G.buildChoice = null;
  G.districtsLeft = G.districtsLeft.filter(n => n !== opt.name);
  const st = addStation(opt.shape, opt.x, opt.y, opt.name, opt.tier);
  notifyNewStation(st);
  rebuildRoutes();
  return st;
}

/** Vorschlag unter dem Finger */
function choiceAt(x, y) {
  if (!G.buildChoice) return null;
  let best = null, bestD = hitRadius() * 1.2;
  for (const o of G.buildChoice.opts) {
    const d = dist(o.x, o.y, x, y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

/* ---------- Ereignisse in Hannover ---------- */

/** Kartenpunkt eines Ereignisortes (Orientierungspunkt oder Mitte des Sees) */
function eventPlace(ev) {
  const poi = HANNOVER.pois.find(p => p.name === ev.place);
  if (poi) return poi.at;
  const lake = HANNOVER.lakes.find(l => l.name === ev.place);
  if (lake) return lake.pts.reduce((c, p) => [c[0] + p[0] / lake.pts.length, c[1] + p[1] / lake.pts.length], [0, 0]);
  const city = HANNOVER.districts.find(d => d.name === ev.place);
  return city ? [city.x, city.y] : null;
}

/** Ereignis starten, laufen lassen und beenden (Abreise: alle auf einmal) */
function updateEvent() {
  if (G.event) {
    const st = stationById(G.event.stationId);
    if (!st) { G.event = null; return; }
    if (G.t >= G.event.end) {
      for (let i = 0; i < 6; i++) { const dest = pickDestination(st.shape, true); if (dest) st.queue.push(dest); }
      toast(`${EVENTS.find(e => e.key === G.event.key)?.name || 'Ereignis'} vorbei – alle wollen gleichzeitig nach Hause!`, 3200);
      G.event = null;
      G.nextEventT = G.t + dayLen() * 7 * rand(1.1, 2);
    }
    return;
  }
  if (G.t < G.nextEventT || G.sandbox) return;   // Sandbox: Ereignisse nur per Knopf
  // Ein Ereignis, dessen Ort eine Station in der Nähe hat
  const options = EVENTS.map(ev => {
    const at = eventPlace(ev);
    if (!at) return null;
    const st = G.stations.filter(s => s.shape !== 'hub')
      .map(s => ({ s, d: dist(s.x, s.y, at[0], at[1]) }))
      .sort((a, b) => a.d - b.d)[0];
    return st && st.d < 8 ? { ev, st: st.s } : null;
  }).filter(Boolean);
  if (!options.length) { G.nextEventT = G.t + dayLen() * 2; return; }
  const { ev, st } = options[Math.floor(Math.random() * options.length)];
  G.event = { key: ev.key, stationId: st.id, end: G.t + dayLen() * CFG.eventDays };
  toast(`${ev.text} Ziel: ${st.name || 'die Station mit dem Fähnchen'}.`, 4200);
}

/** Bei eigener Kamera: Hinweis, wenn eine neue Station außerhalb des Bildes entsteht */
function notifyNewStation(st) {
  if (!cam.manual) return;
  const [sx, sy] = toScreen(st.x, st.y);
  if (sx < 0 || sy < 0 || sx > innerWidth || sy > innerHeight) {
    toast(`Neue Station: ${st.name || 'außerhalb des Bildes'} – tippe rechts auf ◎, um alles zu sehen.`, 3200);
  }
}

/** Zielform für einen neuen Fahrgast (nicht die eigene, häufige Formen öfter, oft der Hauptbahnhof). */
function pickDestination(own, ignoreEvent = false) {
  if (!ignoreEvent && G.event && Math.random() < CFG.eventShare) {
    const target = stationById(G.event.stationId);
    if (target && target.shape !== own) return target.shape;
  }
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
  const week = Math.floor(G.t / (dayLen() * 7)) + 1;
  if (week > G.week) {
    G.week = week;
    if (G.sandbox) return;                 // Sandbox: keine Upgrade-Zettel, keine Bilanz
    // Jede Woche mindestens ein Fahrzeug – dort, wo es am meisten fehlt
    if (SC.business) { closeWeekBalance(); showBalance(); return; }
    giveWeeklyVehicle();
    showUpgrade();
    return;
  }

  updateEvent();

  // Neue Stationen (in der Sandbox baust du selbst)
  G.stationTimer -= dt;
  if (G.stationTimer <= 0 && !G.sandbox) {
    if (G.buildChoice) resolveBuildChoice(null);
    G.stationTimer = (SC.spawnInterval ? SC.spawnInterval(G.week) : Math.max(11, 23 - G.week)) * rand(0.85, 1.15);
    if (!offerBuildChoice(G.stationTimer * 0.7)) spawnStation();
  }
  if (G.buildChoice && G.t >= G.buildChoice.until) resolveBuildChoice(null);

  // Neue Fahrgäste und Überfüllung
  // Sanfter Einstieg, dann steigt der Andrang Woche für Woche
  const rate = G.sandbox
    ? 0.08 * G.sbDemand
    : Math.min(0.35, 0.035 + 0.016 * G.week + G.t * 0.0003) * (G.event ? 1.4 : 1) * demandFactor();
  for (const st of G.stations) {
    const stRate = st.shape === 'hub' ? rate * 1.6 : rate;    // am Hauptbahnhof ist mehr los
    if (G.t - st.born > 3 && Math.random() < stRate * dt) {
      const dest = pickDestination(st.shape);
      if (dest) st.queue.push(dest);
    }
    if (G.sandbox) {                      // Sandbox: Überzählige gehen zu Fuß, kein Game Over
      if (st.queue.length > capacityOf(st)) st.queue.length = capacityOf(st);
      st.flash = Math.max(0, st.flash - dt);
      continue;
    }
    if (st.queue.length > capacityOf(st)) st.over += dt / CFG.overcrowdTime;
    else st.over = Math.max(0, st.over - dt / CFG.recoverTime);
    st.flash = Math.max(0, st.flash - dt);
    if (st.over >= 1) { gameOver(st); return; }
  }
  if (SC.business && !G.sandbox && payRunningCosts(dt)) return;
  updateVehicles(dt);
  for (const f of G.floaters) f.t += dt;
  G.floaters = G.floaters.filter(f => f.t < 1.4);
}

/* ---------- Unternehmer-Modus (Europa) ----------
   Fluggäste bringen Ticketumsatz, Flugzeuge kosten Leasing, Routen Gebühren.
   Kosten werden laufend abgebucht (pro Spielsekunde), damit der Kontostand
   lebendig mitläuft. Unter dem Kreditrahmen ist die Airline pleite.          */

const priceLevel = () => SC.business?.prices[G.price] || { fare: 1, demand: 1 };
/** Nachfrage-Faktor: Spielwelt, Ticketpreis und Werbekampagne */
function demandFactor() {
  if (!SC.business) return SC.demand || 1;
  return (SC.demand || 1) * priceLevel().demand * (G.t < G.marketingUntil ? 1.4 : 1);
}

/** Wochenkosten bei aktuellem Netz: Leasing aller Flugzeuge + Routengebühren */
function weeklyCosts() {
  const b = SC.business;
  return G.trains.reduce((a, t) => a + b.lease[t.line.mode], 0) + G.lines.length * b.routeFee;
}

/** Kosten anteilig abbuchen; true = pleite (Spiel vorbei) */
function payRunningCosts(dt) {
  const cost = (weeklyCosts() / (dayLen() * 7)) * dt;
  G.money -= cost;
  G.weekCost += cost;
  if (G.money < -SC.business.credit) { gameOver(null, 'bankrupt'); return true; }
  return false;
}

/** Ticketumsatz für einen angekommenen Fahrgast-Block, mit aufsteigender Zahl an der Station */
function earnFare(st, mode) {
  const amount = Math.round(SC.business.fare[mode] * priceLevel().fare);
  G.money += amount;
  G.weekRev += amount;
  G.floaters.push({ x: st.x, y: st.y, text: `+${fmtMoney(amount)}`, t: 0 });
}

/** Geld lesbar: „1,2 Mio €“ oder „90.000 €“ */
function fmtMoney(v) {
  const a = Math.abs(v), sign = v < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}${(a / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mio €`;
  return `${sign}${(Math.round(a / 1000) * 1000).toLocaleString('de-DE')} €`;
}

/** Woche abschließen: Zahlen merken, Zähler zurücksetzen */
function closeWeekBalance() {
  G.lastWeek = { week: G.week - 1, rev: G.weekRev, cost: G.weekCost, profit: G.weekRev - G.weekCost };
  G.history.push(G.lastWeek.profit);
  if (G.history.length > 8) G.history.shift();
  G.weekRev = 0;
  G.weekCost = 0;
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
    if (p === st.shape) {                                                         // angekommen
      G.score++; moved++; st.flash = 0.35;
      tr.line.riders = (tr.line.riders || 0) + 1;
      if (SC.business && !G.sandbox) earnFare(st, tr.line.mode);
      return false;
    }
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
  tr.dwell = mode.dwell + mode.perPax * moved * (st.node ? CFG.nodeBoarding : 1);
}

/* =====================================================================
   6. KAMERA
   Passt die ganze Stadt in den freien Bereich zwischen Status oben und
   Stiften unten ein und zoomt weich heraus, wenn die Stadt wächst.
   ===================================================================== */

const cam = { s: 50, x: 0, y: 0, ready: false, manual: false };
const ZOOM_MIN = 4, ZOOM_MAX = 90;      // Pixel pro U
const PAN_LIMIT = 80;                   // so weit darf man die Karte verschieben (U)
let bottomInset = 96;     // Höhe der Leiste unten (kann im Hochformat zweizeilig sein)
let coachInset = 0;       // zusätzlicher Platz für den Tutorial-Zettel

/** Freier Bildschirmbereich (CSS-Pixel) */
function view() {
  const w = window.innerWidth, h = window.innerHeight;
  const top = 78, bottom = bottomInset + coachInset, side = 24;
  // Sandbox-Zettel links: Platz freihalten, damit keine Station dahinter verschwindet
  const sb = typeof G !== 'undefined' && G?.sandbox && !G.sbMin && G.state === 'playing' ? (document.getElementById('sandbox')?.offsetWidth || 0) : 0;
  const left = sb ? sb + 8 : 0;
  return { w: w - 2 * side - left, h: h - top - bottom, cx: left + (w - left) / 2, cy: top + (h - top - bottom) / 2 };
}

/**
 * Kamera auf die vorhandenen Stationen ausrichten (nicht auf den möglichen
 * Stadtbereich) – so wird die Fläche in Quer- und Hochformat gut genutzt.
 */
function updateCamera(rdt) {
  // Hat der Spieler selbst gezoomt/verschoben, bleibt die Kamera, wo sie ist
  if (cam.manual && cam.ready) {
    cam.s = clamp(cam.s, ZOOM_MIN, ZOOM_MAX);
    cam.x = clamp(cam.x, -PAN_LIMIT, PAN_LIMIT);
    cam.y = clamp(cam.y, -PAN_LIMIT, PAN_LIMIT);
    return;
  }
  const v = view();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of [...G.stations, ...(G.buildChoice?.opts || [])]) {
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

/** Um einen Bildschirmpunkt zoomen (der Punkt bleibt unter dem Finger) */
function zoomAt(sx, sy, factor) {
  const v = view();
  const [wx, wy] = toWorld(sx, sy);
  cam.s = clamp(cam.s * factor, ZOOM_MIN, ZOOM_MAX);
  cam.x = wx - (sx - v.cx) / cam.s;
  cam.y = wy - (sy - v.cy) / cam.s;
  cam.manual = true;
}
function panBy(dx, dy) {
  cam.x -= dx / cam.s;
  cam.y -= dy / cam.s;
  cam.manual = true;
}
/** Zurück zur automatischen Kamera (ganze Stadt im Blick) */
function fitCamera() { cam.manual = false; }

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

/* ---------- Karte von Hannover zeichnen (Buntstift-Skizze unter dem Netz) ---------- */

const MAP_COLORS = {
  water: 'rgba(90, 150, 215, 0.30)',
  waterEdge: 'rgba(55, 115, 185, 0.55)',
  waterText: 'rgba(45, 100, 170, 0.8)',
  green: 'rgba(80, 160, 90, 0.10)',
  hatch: 'rgba(60, 140, 80, 0.30)',
  greenText: 'rgba(45, 120, 60, 0.8)',
  district: 'rgba(43, 43, 43, 0.30)',
  name: 'rgba(43, 43, 43, 0.85)',
};
const HAND_FONT = '"Noteworthy", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive';
/** Schriftgröße für Kartenbeschriftungen in px (wächst mit dem Zoom, bleibt lesbar) */
const labelSize = () => clamp(0.5 * cam.s, 11, 15);

/** Weicher Pfad durch Weltpunkte (quadratische Kurven durch die Mittelpunkte) */
function smoothPath(pts, close = false) {
  const p = pts.map(([x, y]) => toScreen(x, y));
  ctx.beginPath();
  if (close) {
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = m(p[p.length - 1], p[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < p.length; i++) {
      const n = m(p[i], p[(i + 1) % p.length]);
      ctx.quadraticCurveTo(p[i][0], p[i][1], n[0], n[1]);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length - 1; i++) {
    ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
  }
  ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
}

/** Linie parallel versetzt um d (in U) – für die Ufer der Flüsse */
function offsetLine(pts, d) {
  return pts.map(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    return [x - ((by - ay) / len) * d, y + ((bx - ax) / len) * d];
  });
}

/** Beschriftung in Handschrift mit Papier-„Halo“, damit sie auf Linien lesbar bleibt */
function mapText(text, sx, sy, color, size, angle = 0, weight = '') {
  ctx.save();
  ctx.translate(sx, sy);
  if (angle) ctx.rotate(angle);
  ctx.font = `${weight} ${size}px ${HAND_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(251, 250, 246, 0.9)';
  ctx.lineWidth = 4;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawMap() {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fs = labelSize();

  // Europa: Meer = alles außer Land (innere Meere wieder Wasser), Küsten als Buntstift-Linie
  if (HANNOVER.land) {
    const polys = [...HANNOVER.land, ...HANNOVER.innerSeas.map(sea => sea.pts)];
    const addPoly = pts => {
      const p = pts.map(([x, y]) => toScreen(x, y));
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
    };
    ctx.beginPath();
    ctx.rect(-10, -10, innerWidth + 20, innerHeight + 20);
    for (const pts of polys) addPoly(pts);
    ctx.fillStyle = 'rgba(90, 150, 215, 0.20)';
    ctx.fill('evenodd');
    ctx.strokeStyle = MAP_COLORS.waterEdge;
    ctx.lineWidth = 1.5;
    for (const pts of polys) { smoothPath(pts, true); ctx.stroke(); }
    for (const l of HANNOVER.seaLabels) mapText(l.name, ...toScreen(l.at[0], l.at[1]), MAP_COLORS.waterText, fs * 1.15, 0, 'italic');
  }

  // Grünflächen: blass gefüllt und schräg schraffiert
  for (const g of HANNOVER.green) {
    smoothPath(g.pts, true);
    ctx.fillStyle = MAP_COLORS.green;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const xs = g.pts.map(p => toScreen(p[0], p[1]));
    const minX = Math.min(...xs.map(p => p[0])), maxX = Math.max(...xs.map(p => p[0]));
    const minY = Math.min(...xs.map(p => p[1])), maxY = Math.max(...xs.map(p => p[1]));
    const step = Math.max(7, 0.45 * cam.s);
    ctx.strokeStyle = MAP_COLORS.hatch;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = minX - (maxY - minY); x < maxX; x += step) {
      ctx.moveTo(x, maxY); ctx.lineTo(x + (maxY - minY), minY);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Seen
  for (const l of HANNOVER.lakes) {
    smoothPath(l.pts, true);
    ctx.fillStyle = MAP_COLORS.water;
    ctx.fill();
    ctx.strokeStyle = MAP_COLORS.waterEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Flüsse und Kanal: blasses Band + zwei Ufer-Striche
  for (const w of HANNOVER.water) {
    ctx.strokeStyle = MAP_COLORS.water;
    ctx.lineWidth = w.width * cam.s;
    smoothPath(w.pts);
    ctx.stroke();
    ctx.strokeStyle = MAP_COLORS.waterEdge;
    ctx.lineWidth = 1.2;
    for (const k of [-1, 1]) { smoothPath(offsetLine(w.pts, (k * w.width) / 2)); ctx.stroke(); }
  }

  // Beschriftungen: Gewässer entlang des Flusses, Flächen in der Mitte
  for (const w of HANNOVER.water) {
    const [a, b] = [w.pts[w.label], w.pts[w.label + 1]];
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const off = w.width / 2 + 0.7;
    const [sx, sy] = toScreen(mx + Math.sin(ang) * -off, my + Math.cos(ang) * off);
    mapText(w.name, sx, sy, MAP_COLORS.waterText, fs, ang, 'italic');
  }
  const centroid = pts => pts.reduce((c, p) => [c[0] + p[0] / pts.length, c[1] + p[1] / pts.length], [0, 0]);
  for (const l of HANNOVER.lakes) { const [x, y] = centroid(l.pts); mapText(l.name, ...toScreen(x, y), MAP_COLORS.waterText, fs, -Math.PI / 2, 'italic'); }
  for (const g of HANNOVER.green) { const [x, y] = centroid(g.pts); mapText(g.name, ...toScreen(x, y), MAP_COLORS.greenText, fs, 0, 'italic'); }

  // Orientierungspunkte: kleiner Bleistift-Punkt + Name
  for (const p of HANNOVER.pois) {
    if (G.stations.some(st => st.name === p.name)) continue;   // gleichnamige Station beschriftet sich selbst
    const [sx, sy] = toScreen(p.at[0], p.at[1]);
    ctx.fillStyle = MAP_COLORS.district;
    ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
    mapText(p.name, sx, sy + fs * 0.95, MAP_COLORS.district, fs * 0.9);
  }

  // Umland: größer und ganz blass, in Großbuchstaben
  for (const t of HANNOVER.towns) {
    if (G.stations.some(s => dist(s.x, s.y, t.at[0], t.at[1]) < 2.5)) continue;   // dort steht schon eine Station
    mapText(t.name.toUpperCase(), ...toScreen(t.at[0], t.at[1]), 'rgba(43, 43, 43, 0.22)', fs * 1.25, 0, 'bold');
  }

  // Noch nicht erschlossene Stadtteile ganz blass
  for (const name of G.districtsLeft) {
    const d = HANNOVER.districts.find(x => x.name === name);
    if (!d || G.stations.some(s => dist(s.x, s.y, d.x, d.y) < 2)) continue;
    if (G.buildChoice?.opts.some(o => o.name === name)) continue;   // Vorschlag hat eigene Beschriftung
    if (HANNOVER.towns.some(t => t.name === name)) continue;          // Umland hat schon seine große Beschriftung
    mapText(d.name, ...toScreen(d.x, d.y), MAP_COLORS.district, fs);
  }
  ctx.restore();
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
const modeWidth = mode => ({ solid: CFG.lineWidth, sbahn: 0.28, jumbo: 0.36 })[MODES[mode].style] || 0.2;

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
  const style = MODES[mode].style;
  ctx.globalAlpha = 0.92;
  if (style === 'dotted') {
    // Punktlinie (Regionaljet)
    ctx.lineWidth = 0.22 * s;
    ctx.setLineDash([0.01 * s, 0.38 * s]);
    wobblyStroke(x1, y1, x2, y2, seed);
    ctx.setLineDash([]);
  } else if (style === 'jumbo') {
    // Dicker Strich mit dünner weißer Mittellinie (Jumbo)
    ctx.lineWidth = 0.36 * s;
    wobblyStroke(x1, y1, x2, y2, seed, 0.03);
    const stroke = ctx.strokeStyle;
    ctx.strokeStyle = '#fffdf3';
    ctx.lineWidth = Math.max(1.2, 0.06 * s);
    wobblyStroke(x1, y1, x2, y2, seed, 0.03);
    ctx.strokeStyle = stroke;
  } else if (style === 'dashed') {
    ctx.lineWidth = 0.2 * s;
    ctx.setLineDash([0.55 * s, 0.32 * s]);
    wobblyStroke(x1, y1, x2, y2, seed);
    ctx.setLineDash([]);
  } else if (style === 'rails') {
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 0.34 * s;
    wobblyStroke(x1, y1, x2, y2, seed);
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = Math.max(1.2, 0.07 * s);
    for (const k of [-1, 1]) wobblyStroke(x1 + nx * 0.11 * k, y1 + ny * 0.11 * k, x2 + nx * 0.11 * k, y2 + ny * 0.11 * k, seed);
  } else if (style === 'sbahn') {
    ctx.lineWidth = 0.28 * s;
    wobblyStroke(x1, y1, x2, y2, seed, 0.03);
    const stroke = ctx.strokeStyle;
    ctx.strokeStyle = '#fffdf3';
    ctx.lineWidth = Math.max(1.5, 0.09 * s);
    ctx.setLineDash([0.45 * s, 0.35 * s]);
    wobblyStroke(x1, y1, x2, y2, seed, 0.03);
    ctx.setLineDash([]);
    ctx.strokeStyle = stroke;
  } else if (style === 'track') {
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

/** Namensschild der Linie (z. B. „U1“) in der Mitte des ersten Abschnitts */
function drawLineTag(line) {
  const a = stationById(line.stations[0]), b = stationById(line.stations[1]);
  const { ox, oy } = segmentOffset(line, a.id, b.id);
  const len = dist(a.x, a.y, b.x, b.y) || 1;
  const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
  const [sx, sy] = toScreen((a.x + b.x) / 2 + ox + nx * 0.55, (a.y + b.y) / 2 + oy + ny * 0.55);
  const fs = clamp(0.42 * cam.s, 11, 14);
  ctx.save();
  ctx.font = `700 ${fs}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  const w = ctx.measureText(line.label).width + fs * 0.8, h = fs * 1.45;
  ctx.fillStyle = LINE_COLORS[line.color];
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(sx - w / 2, sy - h / 2, w, h, h * 0.3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(line.label, sx, sy + 0.5);
  ctx.restore();
}

/** Linien, Linienenden („Stiftkappen“) und die Griffe zum Verlängern */
function drawLines() {
  G.handles = [];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of G.lines) {
    if (!line.label) line.label = nextLineName(line.mode);   // Sicherheitsnetz: jede Linie hat einen Namen
    const color = LINE_COLORS[line.color];
    const s = line.stations;
    ctx.strokeStyle = color;
    for (const [ia, ib] of segs(line)) {
      const a = stationById(ia), b = stationById(ib);
      const { ox, oy } = segmentOffset(line, a.id, b.id);
      strokeSegment(line.mode, a.x + ox, a.y + oy, b.x + ox, b.y + oy, line.id * 1000 + a.id * 31 + b.id);
    }
    if (s.length >= 2) drawLineTag(line);

    // Stiftkappen an beiden Enden (Ringlinien haben keine Enden)
    if (s.length >= 2 && !line.loop) {
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

/**
 * Flugzeug von oben, Nase nach rechts (+x), Länge L in Pixeln.
 * Rumpf, gepfeilte Flügel und Leitwerk; Fahrgäste als weiße Punkte im Rumpf.
 */
function drawPlane(L, pax, cap) {
  const wing = (x0, span, sweep, depth) => {
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 - sweep, -span);
    ctx.lineTo(x0 - sweep - depth, -span);
    ctx.lineTo(x0 - depth * 1.4, 0);
    ctx.lineTo(x0 - sweep - depth, span);
    ctx.lineTo(x0 - sweep, span);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  wing(L * 0.12, L * 0.48, L * 0.2, L * 0.12);          // Tragflächen
  wing(-L * 0.36, L * 0.18, L * 0.08, L * 0.08);        // Leitwerk
  ctx.beginPath();
  ctx.ellipse(0, 0, L / 2, L * 0.09, 0, 0, Math.PI * 2);  // Rumpf
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  const n = Math.min(pax, cap);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(L * 0.36 - (i * L * 0.6) / Math.max(cap - 1, 1), 0, Math.max(1.2, L * 0.035), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Flugzeug im Flug: steigt nach dem Start, sinkt vor der Landung.
 * Je höher, desto größer, desto weiter weg der Schatten und desto länger
 * die Kondensstreifen.
 */
function drawFlyingPlane(sx, sy, ang, L, tr, mode) {
  const alt = tr.dwell > 0 ? 0 : Math.sin(Math.PI * clamp(tr.t, 0, 1));
  const color = LINE_COLORS[tr.line.color];
  // Kondensstreifen hinter den Triebwerken
  if (alt > 0.15) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    const len = L * 2.2 * alt;
    const g = ctx.createLinearGradient(-L * 0.4, 0, -L * 0.4 - len, 0);
    g.addColorStop(0, `rgba(120, 140, 175, ${0.45 * alt})`);
    g.addColorStop(1, 'rgba(120, 140, 175, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1.5, L * 0.05);
    ctx.lineCap = 'round';
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.15, k * L * 0.22);
      ctx.lineTo(-L * 0.4 - len, k * L * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Schatten auf der Karte
  ctx.save();
  ctx.translate(sx + alt * 12, sy + alt * 16);
  ctx.rotate(ang);
  ctx.fillStyle = `rgba(43, 43, 43, ${0.08 + 0.1 * alt})`;
  ctx.strokeStyle = 'rgba(0,0,0,0)';
  drawPlane(L * 0.95, 0, mode.cap);
  ctx.restore();
  // Flugzeug selbst, in der Luft etwas größer
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = Math.max(1, 0.05 * cam.s);
  drawPlane(L * (1 + 0.2 * alt), tr.pax.length, mode.cap);
  ctx.restore();
}

/** Aufsteigende Umsatz-Zahlen („+90.000 €“) über den Flughäfen */
function drawFloaters() {
  if (!G.floaters?.length) return;
  const fs = clamp(0.5 * cam.s, 13, 17);
  for (const f of G.floaters) {
    const [sx, sy] = toScreen(f.x, f.y);
    ctx.save();
    ctx.globalAlpha = 1 - f.t / 1.4;
    mapText(f.text, sx, sy - px(0.9, 18) - f.t * 40, '#2f9e4f', fs, 0, 'bold');
    ctx.restore();
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
    if (mode.plane) {
      ctx.restore();
      drawFlyingPlane(sx, sy, ang, mode.plane * vs, tr, mode);
      continue;
    }
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

/** Welches Verkehrsmittel ist gerade „in der Hand“? (zum Abblenden unpassender Stationen) */
function activeMode() {
  if (drag) return drag.lineMode || drag.line?.mode;
  return G.state === 'playing' ? G.selectedMode : null;
}

/** Abzeichen der Stationsart: T (Tram), U (blau, U-Bahn), S (grün, Bahnhof) */
function drawTierBadge(st, sx, sy, r) {
  const badge = TIER_INFO[st.tier]?.badge;
  if (!badge || st.shape === 'hub') return;
  const size = Math.max(15, 0.46 * cam.s);
  const bx = sx + r * 0.9, by = sy - r * 0.9;
  ctx.save();
  ctx.beginPath();
  if (st.tier === 'rail') ctx.arc(bx, by, size / 2, 0, Math.PI * 2);
  else ctx.roundRect(bx - size / 2, by - size / 2, size, size, size * 0.22);
  ctx.fillStyle = st.tier === 'metro' ? '#2456c9' : st.tier === 'rail' ? '#2f9e4f' : '#fffdf3';
  ctx.fill();
  ctx.strokeStyle = COLORS.pencil;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = st.tier === 'tram' ? COLORS.pencil : '#fff';
  ctx.font = `700 ${size * 0.68}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, bx, by + size * 0.04);
  ctx.restore();
}

/** Umsteigeknoten: kleines gelbes Abzeichen mit zwei Pfeilen (⇄) oben links */
function drawNodeBadge(sx, sy, r) {
  const size = Math.max(15, 0.46 * cam.s);
  const bx = sx - r * 0.9, by = sy - r * 0.9, k = size / 24;
  ctx.save();
  ctx.beginPath(); ctx.arc(bx, by, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe83d'; ctx.fill();
  ctx.strokeStyle = COLORS.pencil; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.translate(bx - size / 2, by - size / 2);
  ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(6 * k, 9.5 * k); ctx.lineTo(17 * k, 9.5 * k); ctx.lineTo(14 * k, 6.5 * k);
  ctx.moveTo(18 * k, 14.5 * k); ctx.lineTo(7 * k, 14.5 * k); ctx.lineTo(10 * k, 17.5 * k);
  ctx.stroke();
  ctx.restore();
}

/** Ereignis: rotes Fähnchen über der Station, leicht wehend */
function drawEventFlag(sx, sy, r) {
  const h = Math.max(26, 1.1 * cam.s), wave = Math.sin(performance.now() / 300) * 2;
  const x = sx + r * 0.2, y = sy - r - 4;
  ctx.save();
  ctx.strokeStyle = COLORS.pencil; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.fillStyle = COLORS.danger;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.quadraticCurveTo(x + h * 0.35, y - h + wave, x + h * 0.6, y - h * 0.78);
  ctx.quadraticCurveTo(x + h * 0.3, y - h * 0.62 - wave, x, y - h * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStations() {
  const mode = activeMode();
  for (const st of G.stations) {
    // Station, an der das gewählte Verkehrsmittel nicht halten kann → blass
    ctx.globalAlpha = mode && !servesMode(st, mode) ? 0.3 : 1;
    const R = px(stationR(st), st.shape === 'hub' ? 18 : st.tier === 'bus' ? 9 : 12);
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
    const baseAlpha = ctx.globalAlpha;
    ctx.globalAlpha = baseAlpha * 0.35;
    ctx.lineWidth = Math.max(1, 0.06 * cam.s);
    shapePath(st.shape, sx + 0.03 * cam.s, sy - 0.02 * cam.s, r, st.id + 7, true);
    ctx.stroke();
    ctx.globalAlpha = baseAlpha;
    drawTierBadge(st, sx, sy, r);
    if (st.node) drawNodeBadge(sx, sy, r);
    if (G.event?.stationId === st.id) drawEventFlag(sx, sy, r);
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

    // Name des Stadtteils unter der Station
    if (st.name) {
      const fs = labelSize() * (st.shape === 'hub' ? 1.1 : 1);
      mapText(st.name, sx, sy + R + fs * 0.9, MAP_COLORS.name, fs, 0, st.shape === 'hub' ? 'bold' : '');
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
  ctx.globalAlpha = 1;
}

/** Vorschau beim Ziehen einer neuen Linie */
function drawDragPreview() {
  if (drag?.mode === 'extend') return drawExtendPreview();
  if (drag?.mode === 'insert') return drawInsertPreview();
  if (!drag || drag.mode !== 'new') return;
  const color = LINE_COLORS[drag.color];
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < drag.stations.length - 1; i++) {
    const a = stationById(drag.stations[i]), b = stationById(drag.stations[i + 1]);
    strokeSegment(drag.lineMode, a.x, a.y, b.x, b.y, 7000 + a.id * 31 + b.id);
  }
  if (drag.loop) {
    const a = stationById(drag.stations[drag.stations.length - 1]), b = stationById(drag.stations[0]);
    strokeSegment(drag.lineMode, a.x, a.y, b.x, b.y, 7000 + a.id * 31 + b.id);
    return;
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

/** Vorschläge für die nächste Station: gestrichelt, leicht pulsierend, mit Restzeit-Bogen */
function drawBuildChoice() {
  const c = G.buildChoice;
  if (!c) return;
  const pulse = 1 + Math.sin(performance.now() / 260) * 0.06;
  const left = clamp((c.until - G.t) / c.total, 0, 1);
  for (const o of c.opts) {
    const [sx, sy] = toScreen(o.x, o.y);
    const r = px(TIER_INFO[o.tier].r, o.tier === 'bus' ? 9 : 12) * pulse;
    ctx.save();
    ctx.globalAlpha = 0.85;
    shapePath(o.shape, sx, sy, r, 9000 + o.x * 7);
    ctx.fillStyle = 'rgba(255, 232, 61, 0.35)';
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLORS.pencil;
    ctx.lineWidth = Math.max(1.5, 0.09 * cam.s);
    ctx.stroke();
    ctx.setLineDash([]);
    // Restzeit als Bleistiftbogen
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, r + 7, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    drawTierBadge({ tier: o.tier, shape: o.shape }, sx, sy, r);
    ctx.restore();
    const fs = labelSize();
    mapText(o.name + ' ?', sx, sy + r + fs * 1.1, MAP_COLORS.name, fs, 0, '');
  }
}

/** Gestrichelte Linie vom Finger zu Stationen (Vorschau beim Verlängern/Einfügen) */
function dashTo(color, mode, pts, alpha) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(modeWidth(mode), 0.2) * cam.s;
  ctx.setLineDash([0.35 * cam.s, 0.25 * cam.s]);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  pts.forEach((p, k) => { const [sx, sy] = toScreen(p.x, p.y); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** Beim Verlängern: Strich vom Linienende zum Finger, solange der Finger noch unterwegs ist */
function drawExtendPreview() {
  const s = drag.line.stations;
  if (s.length < 1) return;
  const end = stationById(drag.end === 'end' ? s[s.length - 1] : s[0]);
  if (!end || dist(end.x, end.y, drag.x, drag.y) < hitRadius()) return;
  dashTo(LINE_COLORS[drag.line.color], drag.line.mode, [end, drag], 0.6);
}

/** Beim Einfügen: Abschnitt wird zum „V“ über den Finger bzw. die Zielstation */
function drawInsertPreview() {
  const s = drag.line.stations;
  const a = stationById(s[drag.i]), b = stationById(s[(drag.i + 1) % s.length]);
  if (!a || !b) return;
  const tip = drag.target != null ? stationById(drag.target) : drag;
  dashTo(LINE_COLORS[drag.line.color], drag.line.mode, [a, tip, b], drag.target != null ? 0.95 : 0.55);
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
  drawMap();
  drawLines();
  drawDragPreview();
  drawTrains();
  drawTutorialGlow();
  drawStations();
  drawBuildChoice();
  drawFloaters();
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
  let bestH = null, bestD = Math.max(1.0, 36 / cam.s);
  for (const h of G.handles) {
    const d = dist(h.x, h.y, x, y);
    if (d < bestD) { bestD = d; bestH = h; }
  }
  return bestH;
}

/** Abstand Punkt–Strecke (in U) */
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
  return dist(x, y, ax + dx * t, ay + dy * t);
}

/** Linienabschnitt unter dem Finger → { line, i } (Abschnitt zwischen stations[i] und stations[i+1]) */
function segmentAt(x, y) {
  let best = null, bestD = Math.max(0.55, 24 / cam.s);
  for (const line of G.lines) {
    const sg = segs(line);
    for (let i = 0; i < sg.length; i++) {
      const a = stationById(sg[i][0]), b = stationById(sg[i][1]);
      const { ox, oy } = segmentOffset(line, a.id, b.id);
      const d = segDist(x, y, a.x + ox, a.y + oy, b.x + ox, b.y + oy);
      if (d < bestD) { bestD = d; best = { line, i }; }
    }
  }
  return best;
}

/**
 * Welche Linie endet an dieser Station und soll beim Ziehen verlängert werden?
 * Bevorzugt das gewählte Verkehrsmittel. Am Hauptbahnhof (dort starten neue Linien)
 * nur, wenn für das gewählte Verkehrsmittel keine neue Linie mehr frei ist.
 */
function lineEndAt(st, mode) {
  const ends = G.lines.filter(l => l.stations.length >= 2 && !l.loop &&
    (l.stations[0] === st.id || l.stations[l.stations.length - 1] === st.id));
  if (!ends.length) return null;
  const own = ends.filter(l => l.mode === mode);
  const free = canCreateLine(mode);
  let line = null;
  if (st.shape === 'hub') line = !free ? own[0] : null;
  else line = own[0] || (!free ? ends[0] : null);
  if (!line) return null;
  return { line, end: line.stations[line.stations.length - 1] === st.id ? 'end' : 'start' };
}

/**
 * Tipp/Ziehen auf dem Spielfeld. Gibt true zurück, wenn die Berührung
 * „verbraucht“ wurde (Linie ziehen, Station antippen) – sonst darf sie
 * die Karte verschieben.
 */
function onDown(e) {
  closeLineMenu();
  if (drag) return true;
  if (e.pointerType === 'touch' && penActive) return true;
  const [x, y] = toWorld(e.clientX, e.clientY);

  if (G.state === 'placeBig') {
    const st = stationAt(x, y);
    if (!st) return false;
    if (st && !st.big && st.shape !== 'hub') {
      st.big = true;
      G.state = 'playing';
      toast('Großer Bahnhof gebaut – hier passen jetzt 12 Fahrgäste hin.');
    }
    return true;
  }
  if (G.state === 'placeNode') {
    const st = stationAt(x, y);
    if (!st) return false;
    if (st && !st.node) {
      st.node = true;
      st.flash = 0.35;
      G.state = 'playing';
      toast(`${st.name || 'Die Station'} ist jetzt ein Umsteigeknoten – hier geht das Umsteigen schneller.`);
    } else if (st) {
      toast('Das ist schon ein Umsteigeknoten – wähle eine andere Station.');
    }
    return true;
  }
  if (G.state === 'placeTier') {
    const st = stationAt(x, y);
    if (!st) return false;
    if (st && st.shape !== 'hub' && tierRank(st.tier) < tierRank(G.placeTier)) {
      st.tier = G.placeTier;
      st.flash = 0.35;
      G.state = 'playing';
      rebuildRoutes();
      toast(`${st.name || 'Die Station'} ist jetzt ${TIER_INFO[st.tier].a} ${TIER_INFO[st.tier].name}.`);
    } else if (st) {
      toast('Diese Station ist schon mindestens so groß – wähle eine andere.');
    }
    return true;
  }
  if (G.state !== 'playing') return false;
  if (G.sandbox && G.tool !== 'lines') return sandboxTap(e, x, y);

  const opt = choiceAt(x, y);
  if (opt) {
    const st = resolveBuildChoice(opt);
    st.flash = 0.35;
    toast(`${st.name} wird gebaut.`);
    return true;
  }

  const h = handleAt(x, y);
  const st0 = h ? null : stationAt(x, y);
  const endHit = st0 ? lineEndAt(st0, G.selectedMode) : null;
  const seg = !h && !st0 ? segmentAt(x, y) : null;
  if (h || endHit) {
    // Linienende (Stiftkappe oder Endstation) anfassen → weiterziehen
    const t = h || endHit;
    drag = { mode: 'extend', line: t.line, end: t.end, x, y, id: e.pointerId };
  } else if (seg) {
    // Mitten auf der Linie anfassen → Station dazwischen einfügen
    drag = { mode: 'insert', line: seg.line, i: seg.i, target: null, x, y, id: e.pointerId };
  } else {
    const st = st0;
    if (!st) return false;                  // leere Fläche → Karte verschieben
    const lineMode = G.selectedMode;
    const M = MODES[lineMode];
    if (!canCreateLine(lineMode)) {
      toast(`Alle ${M.lineName}n sind vergeben. Wähle unten ein anderes Verkehrsmittel oder verlängere eine Linie.`, 3400);
      return true;
    }
    if (!servesMode(st, lineMode)) {
      toast(`${st.name || TIER_INFO[st.tier].name} ist ${TIER_INFO[st.tier].a} ${TIER_INFO[st.tier].name} – hier ${SC.stopVerb} ${M.no}. Baue die Station per Upgrade aus.`, 3400);
      return true;
    }
    if (M.needsHub && st.shape !== 'hub') {
      toast(`${M.lineName}n starten immer ${SC.atHub} – starte dort.`);
      return true;
    }
    drag = { mode: 'new', lineMode, stations: [st.id], color: freeColor(), x, y, id: e.pointerId };
  }
  if (e.pointerType === 'pen') penActive = true;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* nicht kritisch */ }
  e.preventDefault();
  return true;
}

function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const [x, y] = toWorld(e.clientX, e.clientY);
  drag.x = x; drag.y = y;
  if (drag.mode === 'move') { drag.st.x = x; drag.st.y = y; return; }
  if (drag.closed) return;
  const st = stationAt(x, y);
  if (drag.mode === 'insert') { drag.target = st && canInsert(drag.line, drag.i, st) ? st.id : null; return; }
  if (!st) return;

  if (drag.mode === 'new') {
    const s = drag.stations;
    if (st.id === s[0] && s.length >= 3) {                    // zurück zum Start → Ring
      if (canLink(drag.lineMode, s[s.length - 1], st)) { drag.loop = true; drag.closed = true; }
      return;
    }
    if (s[s.length - 2] === st.id) s.pop();                 // zurückgezogen
    else if (!s.includes(st.id) && !tooManyStops(drag.lineMode, s.length) && canLink(drag.lineMode, s[s.length - 1], st)) s.push(st.id);
    return;
  }

  // Linie am Ende verlängern oder verkürzen – live, damit die Züge sofort reagieren
  const line = drag.line;
  const s = line.stations;
  const atEnd = drag.end === 'end';
  const endId = atEnd ? s[s.length - 1] : s[0];
  const prevId = atEnd ? s[s.length - 2] : s[1];
  if (st.id === endId) return;
  // Zur anderen Endstation gezogen → Ring schließen
  const otherId = atEnd ? s[0] : s[s.length - 1];
  if (st.id === otherId) {
    if (s.length >= 3 && canLink(line.mode, endId, st)) {
      line.loop = true;
      drag.closed = true;
      rebuildRoutes();
      syncTrains(line);
      st.flash = 0.35;
      toast(`${line.label} ist jetzt eine Ringlinie – die Fahrzeuge fahren im Kreis. Öffnen über das Linien-Menü unten.`, 3600);
    } else if (s.length < 3) {
      warnOnce('ring', 'Für einen Ring braucht die Linie mindestens 3 Stationen.');
    }
    return;
  }
  if (st.id === prevId) {
    // Züge dürfen den Hauptbahnhof nicht verlieren
    if (MODES[line.mode].needsHub && stationById(endId).shape === 'hub') return;
    if (atEnd) s.pop(); else s.shift();
  } else if (!s.includes(st.id) && !tooManyStops(line.mode, s.length) && canLink(line.mode, endId, st)) {
    if (atEnd) s.push(st.id); else s.unshift(st.id);
  } else {
    return;
  }
  rebuildRoutes();
  syncTrains(line);
}

/** Darf Station st zwischen stations[i] und stations[i+1] eingefügt werden? */
function canInsert(line, i, st) {
  const s = line.stations;
  if (s.includes(st.id)) return false;
  if (tooManyStops(line.mode, s.length)) return false;
  return canLink(line.mode, s[i], st) && canLink(line.mode, s[(i + 1) % s.length], st);
}

/** Station in die Linie einfügen; Fahrzeuge auf dem Abschnitt fahren die neue Station an */
function insertStation(line, i, id) {
  const [a, b] = [line.stations[i], line.stations[(i + 1) % line.stations.length]];
  line.stations.splice(i + 1, 0, id);
  for (const tr of G.trains) {
    if (tr.line !== line) continue;
    if (tr.a === a && tr.b === b) { tr.b = id; tr.t = Math.min(tr.t, 0.5); }
    else if (tr.a === b && tr.b === a) { tr.b = id; tr.t = Math.min(tr.t, 0.5); }
  }
  rebuildRoutes();
  syncTrains(line);
}

/** Hinweis nur einmal pro Zieh-Vorgang (sonst flackert der Toast) */
function warnOnce(key, msg) {
  if (!drag || drag.warned === key) return;
  drag.warned = key;
  toast(msg, 3200);
}

/**
 * Darf die Linie von Station fromId zur Station st weitergehen?
 * Prüft Stationsart und Reichweite: Busse fahren nur kurze Stücke,
 * Züge nur lange (weite Entfernungen).
 */
function canLink(mode, fromId, st) {
  const M = MODES[mode];
  if (!servesMode(st, mode)) {
    warnOnce('tier' + st.id, `${st.name || TIER_INFO[st.tier].name} ist ${TIER_INFO[st.tier].a} ${TIER_INFO[st.tier].name} – hier ${SC.stopVerb} ${M.no}.`);
    return false;
  }
  const from = stationById(fromId);
  const d = dist(from.x, from.y, st.x, st.y);
  if (d > M.maxHop) {
    warnOnce('far', `Zu weit für ${M.the}: höchstens ${fmtKm(M.maxHop)} zwischen zwei Halten.`);
    return false;
  }
  if (d < M.minHop) {
    warnOnce('near', `${M.vehicle}: nur weite Strecken – mindestens ${fmtKm(M.minHop)} zwischen zwei Halten.`);
    return false;
  }
  return true;
}
/** Abstand in U als Text: „2,7 km“ (Hannover) oder „1.500 km“ (Europa, auf 50 km gerundet) */
const fmtKm = u => {
  const k = u * SC.kmPerU;
  return `${k >= 100 ? (Math.round(k / 50) * 50).toLocaleString('de-DE') : k.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`;
};

/** Höchstzahl an Haltestellen erreicht? (mit Hinweis, einmal pro Ziehen) */
function tooManyStops(mode, count) {
  if (count < MODES[mode].maxStops) return false;
  warnOnce('stops', `Eine ${MODES[mode].lineName} hat höchstens ${MODES[mode].maxStops} Haltestellen.`);
  return true;
}

function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'new' && drag.stations.length >= 2) {
    const line = createLine(drag.stations, drag.color, drag.lineMode);
    if (drag.loop) {
      line.loop = true;
      rebuildRoutes();
      toast(`${line.label} fährt als Ringlinie im Kreis.`);
    }
  } else if (drag.mode === 'extend' && drag.line.stations.length < 2) {
    deleteLine(drag.line);
    toast('Linie gelöscht.');
  } else if (drag.mode === 'move') {
    rebuildRoutes();
  } else if (drag.mode === 'insert' && drag.target != null) {
    insertStation(drag.line, drag.i, drag.target);
    const st = stationById(drag.target);
    st.flash = 0.35;
    toast(`${st.name || 'Station'} hängt jetzt an ${drag.line.label}.`);
  }
  drag = null;
  penActive = false;
}

/* ---------- Zoomen und Verschieben ----------
   Zwei Finger: zoomen (auseinander/zusammen) und verschieben.
   Ein Finger oder Stift auf leerer Fläche: Karte verschieben.
   Auf Stationen und Linienenden wird wie gewohnt gezeichnet.          */

const pointers = new Map();     // aktive Berührungen: id → { x, y, type }
let gesture = null;             // { kind: 'pan', id, x, y } | { kind: 'pinch', a, b, dist, s0, wx, wy }

/** Laufendes Linienziehen abbrechen (wenn ein zweiter Finger dazukommt) */
function cancelDrag() {
  if (!drag) return;
  if (drag.mode === 'extend' && drag.line.stations.length < 2) deleteLine(drag.line);
  drag = null;
  penActive = false;
}

function pinchState() {
  const [a, b] = [pointers.get(gesture.a), pointers.get(gesture.b)];
  return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist: Math.hypot(b.x - a.x, b.y - a.y) || 1 };
}

function onPointerDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
  const touches = [...pointers.entries()].filter(([, p]) => p.type === 'touch');
  if (touches.length >= 2 && !penActive && G.state !== 'start' && G.state !== 'over') {
    cancelDrag();
    gesture = { kind: 'pinch', a: touches[0][0], b: touches[1][0] };
    const p = pinchState();
    Object.assign(gesture, { dist: p.dist, s0: cam.s });
    [gesture.wx, gesture.wy] = toWorld(p.mx, p.my);
    e.preventDefault();
    return;
  }
  if (gesture) return;
  const used = onDown(e);
  if (!used && !drag && pointers.size === 1 && G.state !== 'start' && G.state !== 'over') {
    gesture = { kind: 'pan', id: e.pointerId, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* nicht kritisch */ }
  }
}

function onPointerMove(e) {
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  if (gesture?.kind === 'pinch') {
    if (!pointers.has(gesture.a) || !pointers.has(gesture.b)) return;
    const q = pinchState(), v = view();
    cam.s = clamp(gesture.s0 * (q.dist / gesture.dist), ZOOM_MIN, ZOOM_MAX);
    cam.x = gesture.wx - (q.mx - v.cx) / cam.s;     // Punkt zwischen den Fingern bleibt fest
    cam.y = gesture.wy - (q.my - v.cy) / cam.s;
    cam.manual = true;
    return;
  }
  if (gesture?.kind === 'pan' && e.pointerId === gesture.id) {
    panBy(e.clientX - gesture.x, e.clientY - gesture.y);
    gesture.x = e.clientX; gesture.y = e.clientY;
    return;
  }
  onMove(e);
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (gesture) {
    if (gesture.kind === 'pan' ? gesture.id === e.pointerId : (gesture.a === e.pointerId || gesture.b === e.pointerId)) gesture = null;
    return;
  }
  onUp(e);
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);
// Trackpad / Mausrad (z. B. iPad mit Magic Keyboard)
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
$('#zoom-in').addEventListener('click', () => { const v = view(); zoomAt(v.cx, v.cy, 1.3); });
$('#zoom-out').addEventListener('click', () => { const v = view(); zoomAt(v.cx, v.cy, 1 / 1.3); });
$('#zoom-fit').addEventListener('click', fitCamera);
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
  const biz = !!SC.business && !G.sandbox;
  if (hudCache.biz !== biz) { hudCache.biz = biz; $('#money-chip').hidden = !biz; $('#btn-shop').hidden = !biz; }
  if (biz) {
    setText('#money', fmtMoney(G.money));
    const chip = $('#money-chip');
    chip.classList.toggle('negative', G.money < 0);
    chip.classList.toggle('ad', G.t < G.marketingUntil);
  }
  const weekT = (G.t % (dayLen() * 7)) / (dayLen() * 7);
  const day = Math.min(6, Math.floor(weekT * 7));
  setText('#week-label', `Woche ${G.week} · ${DAYS[day]}`);

  // Wochenuhr als Tortenstück
  const a = weekT * Math.PI * 2 - Math.PI / 2;
  const x = 20 + 15 * Math.cos(a), y = 20 + 15 * Math.sin(a);
  const pie = weekT < 0.001 ? '' : `M20 20 L20 5 A15 15 0 ${weekT > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
  if (hudCache.pie !== pie) { hudCache.pie = pie; $('#clock-pie').setAttribute('d', pie); }

  // Leiste unten (nur neu bauen, wenn sich etwas geändert hat)
  const key = G.lines.map(l => `${l.mode}${l.color}${l.label}:${vehiclesOn(l)}`).join(',') + '|' + JSON.stringify(G.inv) + '|' + G.selectedMode;
  if (hudCache.pens !== key) { hudCache.pens = key; renderPens(); }

  // Hinweis am Anfang
  const hint = $('#hint');
  const showHint = G.state === 'playing' && G.lines.length === 0 && !drag && !G.tutorial;
  const hintText = G.sandbox
    ? (G.stations.length < 2 ? (G.tool === 'build' ? 'Sandbox: Tippe auf die Karte, um Stationen zu bauen.' : 'Sandbox: Links „Bauen“ wählen und Stationen auf die Karte tippen.') : 'Jetzt „Linien“ wählen und von Station zu Station ziehen.')
    : SC.hint;
  if (hint.hidden === showHint || (showHint && hint.textContent !== hintText)) {
    hint.hidden = !showHint;
    hint.textContent = hintText;
  }
  syncSandboxUi();
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('is-active', +b.dataset.speed === G.speed);
  $('#zoom-fit').classList.toggle('is-active', !cam.manual);

  // Laufendes Ereignis
  const ev = G.event && EVENTS.find(e => e.key === G.event.key);
  const evText = ev && G.state !== 'start' ? `${ev.name} · ${stationById(G.event.stationId)?.name || ''}` : '';
  if (hudCache.event !== evText) {
    hudCache.event = evText;
    $('#event-chip').hidden = !evText;
    $('#event-text').textContent = evText;
  }
}

function hideHint() { $('#hint').hidden = true; }

const modeIcon = (mode, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${MODES[mode].icon}</svg>`;

/** Verkehrsmittel wählen, mit dem neue Linien gezogen werden */
function selectMode(mode) {
  G.selectedMode = mode;
  if (G.tutorial) { tut.tapped = mode; return; }   // im Tutorial erklärt der Zettel
  if (G.sandbox && G.tool !== 'lines') setTool('lines');
  const M = MODES[mode];
  toast(canCreateLine(mode)
    ? `${M.name}: ${MODE_TEXT[mode]}. ${SC.dragHint}`
    : `${M.name} gewählt – aber alle ${M.lineName}n sind vergeben.`, 3200);
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
      b.setAttribute('aria-label', `${M.lineName} ${line.label}`);
      b.innerHTML = `<span class="pen-label"></span><span class="pen-trains">${vehiclesOn(line)}</span>`;
      b.firstChild.textContent = line.label;
      if (line.label.length > 3) b.firstChild.classList.add('long');
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
  $('#hint').style.bottom = `${bottomInset + 6}px`;      // Hinweis immer über der Leiste
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
  $('#lm-ring').hidden = !line.loop;
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
$('#lm-rename').addEventListener('click', () => {
  const line = menuLine;
  closeLineMenu();
  if (!line) return;
  const name = window.prompt(`Neuer Name für ${MODES[line.mode].lineName} ${line.label} (max. 6 Zeichen):`, line.label);
  if (name && name.trim()) {
    line.label = name.trim().slice(0, 6);
    saveGame();
  }
});
$('#lm-ring').addEventListener('click', () => {
  const line = menuLine;
  closeLineMenu();
  if (!line?.loop) return;
  line.loop = false;
  rebuildRoutes();
  syncTrains(line);
  toast(`${line.label} ist wieder eine normale Linie mit zwei Enden.`);
});
$('#lm-delete').addEventListener('click', () => {
  if (menuLine) { deleteLine(menuLine); autoAssignVehicles(); }
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
let MODE_TEXT = {
  bus: 'großes Netz, kurze Wege, hält überall, beliebig viele Halte',
  tram: 'schnelles Einsteigen, max. 12 Halte',
  metro: 'schnell, nur an U-Bahn-Stationen',
  sbahn: 'weite Wege, nur Bahnhöfe, über den Hbf',
  rail: 'sehr schnell, nur lange Strecken ab Hbf',
};

/** Ausbau-Stufen als Upgrade: eine Station wird eine Stufe größer */
let TIER_UPGRADES = [
  { tier: 'tram', title: 'Tram-Gleise legen', text: 'Eine Bushaltestelle wird zum Tram-Halt.' },
  { tier: 'metro', title: 'U-Bahn-Station bauen', text: 'Eine Station bekommt einen U-Bahn-Zugang.' },
  { tier: 'rail', title: 'Bahnhof bauen', text: 'Eine Station wird Bahnhof für S-Bahn und Zug.' },
];
const BUILD_ICON = '<path d="M4 20h16M6 20V10l6-5 6 5v10"/><path d="M10 20v-5h4v5"/><path d="M17 3v4M15 5h4"/>';

/** Alle möglichen Upgrades; pro Woche werden drei passende ausgelost. */
let UPGRADES = [];
const buildUpgrades = () => [
  ...MODE_ORDER.map(mode => ({
    key: 'line-' + mode, title: `Neue ${MODES[mode].lineName}`, text: `mit Fahrzeug – ${MODE_TEXT[mode]}`, icon: MODES[mode].icon,
    ok: () => G.inv[mode].lines < MODES[mode].maxLines && totalLineSlots() < LINE_COLORS.length,
    apply: () => { G.inv[mode].lines++; G.selectedMode = mode; },
  })),
  ...TIER_UPGRADES.map(u => ({
    key: 'tier-' + u.tier, title: u.title, text: u.text, icon: BUILD_ICON,
    ok: () => G.stations.some(st => st.shape !== 'hub' && tierRank(st.tier) < tierRank(u.tier)),
    apply: () => {
      G.state = 'placeTier';
      G.placeTier = u.tier;
      toast(`Tippe auf die Station, die ${TIER_INFO[u.tier].a === 'ein' ? 'ein' : 'eine'} ${TIER_INFO[u.tier].name} werden soll.`, 4000);
    },
  })),
  {
    key: 'node', title: 'Umsteigeknoten', text: 'Schnelleres Ein- und Umsteigen, 6 Plätze mehr.',
    icon: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    ok: () => G.stations.some(s => !s.node),
    apply: () => { G.state = 'placeNode'; toast('Tippe auf die Station, die Umsteigeknoten werden soll.', 4000); },
  },
  {
    key: 'big', title: SC.bigTitle, text: 'Eine Station fasst 12 statt 6 Fahrgäste.',
    icon: '<circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="9"/>',
    ok: () => G.stations.some(s => !s.big && s.shape !== 'hub'),
    apply: () => { G.state = 'placeBig'; toast('Tippe auf die Station, die größer werden soll.', 4000); },
  },
];

/**
 * Vier Upgrades zur Auswahl. Zuerst die, die gerade wirklich helfen
 * (Fahrzeug, wo eins fehlt; Platz an vollen Stationen; Linie, wenn Stationen
 * ohne Anschluss sind und alle Linien belegt), der Rest wird ausgelost.
 */
function weeklyUpgrades() {
  const pool = UPGRADES.filter(u => u.ok());
  // Neue Linien: Verkehrsmittel zuerst, die Stationen ohne Anschluss bedienen könnten
  const connected = new Set(G.lines.flatMap(l => l.stations));
  const open = G.stations.filter(s => !connected.has(s.id));
  const usefulness = m => open.filter(s => servesMode(s, m)).length * 10 - linesOf(m).length;
  const lines = pool.filter(u => u.key.startsWith('line-'))
    .sort((a, b) => usefulness(b.key.slice(5)) - usefulness(a.key.slice(5)));
  // Dazu genau ein Ausbau: bei vollen Stationen Knoten/großer Bahnhof, sonst Stationsausbau
  const crowded = G.stations.some(s => s.over > 0 || s.queue.length >= capacityOf(s) * 0.7);
  const builds = pool.filter(u => !u.key.startsWith('line-'));
  const build = (crowded && builds.find(u => u.key === (hash(G.week, 3) < 0.5 ? 'node' : 'big')))
    || builds.map((u, i) => ({ u, r: hash(G.week, i, G.stations.length) })).sort((a, b) => a.r - b.r)[0]?.u;
  return [...lines, build].filter(Boolean).slice(0, 6);
}

function showUpgrade() {
  G.state = 'upgrade';
  closeLineMenu();
  drag = null;
  $('#up-title').textContent = `Woche ${G.week - 1} geschafft!`;
  const gift = MODES[G.gift || 'bus'];
  $('#up-lead').textContent = (G.giftLine
    ? `${gift.one} ${SC.moveVerb} ab jetzt zusätzlich auf Linie ${G.giftLine}.`
    : `${gift.one} steht bereit.`) + ' Wähle eine neue Linie oder einen Ausbau:';
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
      if (autoAssignVehicles()) toast('Neue Fahrzeuge fahren schon auf deinen Linien ohne Fahrzeug.');
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
const SAVE_VERSION = 3;          // v3: Stationsarten + S-Bahn (v2 wird übernommen, v1 verworfen)
const ACTIVE_STATES = ['playing', 'upgrade', 'placeBig', 'placeTier', 'placeNode', 'balance', 'shop'];

function serialize() {
  return {
    v: SAVE_VERSION,
    world: G.world,
    savedAt: Date.now(),
    state: G.state,
    t: G.t, week: G.week, score: G.score, nextId: G.nextId, placeTier: G.placeTier, gift: G.gift,
    inv: G.inv, selectedMode: G.selectedMode, stationTimer: G.stationTimer,
    stations: G.stations.map(({ id, x, y, shape, name, tier, node, queue, over, big, born }) => ({ id, x, y, shape, name, tier, node, queue, over, big, born })),
    event: G.event, nextEventT: G.nextEventT,
    money: G.money, price: G.price, marketingUntil: G.marketingUntil,
    weekRev: G.weekRev, weekCost: G.weekCost, history: G.history, lastWeek: G.lastWeek,
    districtsLeft: G.districtsLeft,
    sandbox: G.sandbox, sbDemand: G.sbDemand,
    lines: G.lines.map(({ id, color, mode, label, stations, loop, riders }) => ({ id, color, mode, label, stations, loop: !!loop, riders: riders || 0 })),
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

/**
 * Spielstand v2 → v3: S-Bahn-Inventar ergänzen und jeder Station eine
 * Stationsart geben – mindestens so groß, wie ihre bestehenden Linien brauchen,
 * damit kein vorhandenes Netz kaputtgeht.
 */
function migrateSave(d) {
  if (d?.v !== 2 || !Array.isArray(d.stations) || !Array.isArray(d.lines)) return d;
  d.inv = { ...d.inv, sbahn: d.inv?.sbahn || { lines: MODES.sbahn.startLines, free: MODES.sbahn.startVehicles } };
  for (const st of d.stations) {
    let tier = st.shape === 'hub' ? 'rail' : tierOfDistrict(st.name || '');
    for (const l of d.lines) {
      if (Array.isArray(l.stations) && l.stations.includes(st.id) && MODES[l.mode] && tierRank(MODES[l.mode].tier) > tierRank(tier)) {
        tier = MODES[l.mode].tier;
      }
    }
    st.tier = tier;
  }
  d.v = 3;
  return d;
}

function loadSave() {
  try {
    const d = migrateSave(JSON.parse(localStorage.getItem(SAVE_KEY)));
    if (isValidSave(d)) return d;
    if (d) clearSave();
  } catch { /* kein oder kaputter Stand */ }
  return null;
}

/** Baut eine gespeicherte Runde wieder auf (zunächst hinter dem Startzettel). */
function restoreGame(d) {
  newGame(SCENARIOS[d.world] ? d.world : 'hannover');
  Object.assign(G, {
    t: d.t, week: d.week, score: d.score, nextId: d.nextId, stationTimer: d.stationTimer,
    selectedMode: MODES[d.selectedMode] ? d.selectedMode : 'bus',
    placeTier: TIERS.includes(d.placeTier) ? d.placeTier : null,
    gift: MODES[d.gift] ? d.gift : 'bus',
    inv: Object.fromEntries(MODE_ORDER.map(m => [m, {
      lines: clamp(Math.round(d.inv[m].lines), 0, MODES[m].maxLines),
      free: Math.max(0, Math.round(d.inv[m].free)),
    }])),
  });
  G.stations = d.stations.map(st => ({
    ...st, name: typeof st.name === 'string' ? st.name.slice(0, 40) : '',
    tier: st.shape === 'hub' ? 'rail' : TIERS.includes(st.tier) ? st.tier : 'metro',
    node: !!st.node,
    queue: [...st.queue], over: clamp(+st.over || 0, 0, 0.99), big: !!st.big, born: +st.born || 0, flash: 0,
  }));
  // Offene Stadtteile: aus dem Stand, sonst alle, die noch keine Station haben
  const used = new Set(G.stations.map(st => st.name));
  const known = new Set(HANNOVER.districts.map(x => x.name));
  G.districtsLeft = Array.isArray(d.districtsLeft)
    ? d.districtsLeft.filter(n => known.has(n) && !used.has(n))
    : HANNOVER.districts.map(x => x.name).filter(n => !used.has(n));
  G.sandbox = !!d.sandbox;
  G.sbDemand = [0, 0.5, 1, 2].includes(d.sbDemand) ? d.sbDemand : 1;
  G.lines = [];
  for (const l of d.lines) {
    const label = typeof l.label === 'string' && l.label.trim() ? l.label.trim().slice(0, 6) : nextLineName(l.mode);
    G.lines.push({ id: l.id, color: l.color, mode: l.mode, label, stations: [...l.stations], loop: !!l.loop && l.stations.length >= 3, riders: Math.max(0, +l.riders || 0) });
  }
  // Ereignis fortsetzen (nur wenn die Station noch existiert)
  G.event = d.event && EVENTS.some(e => e.key === d.event.key) && G.stations.some(st => st.id === d.event.stationId)
    ? { key: d.event.key, stationId: d.event.stationId, end: +d.event.end || G.t } : null;
  G.nextEventT = Number.isFinite(d.nextEventT) ? d.nextEventT : G.t + dayLen() * 7;
  // Airline-Zahlen
  if (SC.business) {
    const num = (v, def) => (Number.isFinite(v) ? v : def);
    G.money = num(d.money, SC.business.start);
    G.price = SC.business.prices[d.price] ? d.price : 'normal';
    G.marketingUntil = num(d.marketingUntil, 0);
    G.weekRev = num(d.weekRev, 0);
    G.weekCost = num(d.weekCost, 0);
    G.history = Array.isArray(d.history) ? d.history.filter(Number.isFinite).slice(-8) : [];
    G.lastWeek = d.lastWeek && Number.isFinite(d.lastWeek.profit) ? d.lastWeek : null;
  }
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
  if (state === 'balance') {
    showBalance();
  } else if (state === 'shop') {
    openShop();
  } else if (state === 'upgrade') {
    showUpgrade();
  } else if (state === 'placeBig') {
    G.state = 'placeBig';
    toast('Tippe auf die Station, die größer werden soll.', 4000);
  } else if (state === 'placeNode') {
    G.state = 'placeNode';
    toast('Tippe auf die Station, die Umsteigeknoten werden soll.', 4000);
  } else if (state === 'placeTier' && TIERS.includes(G.placeTier)) {
    G.state = 'placeTier';
    toast('Tippe auf die Station, die ausgebaut werden soll.', 4000);
  } else {
    G.state = 'playing';
  }
}

/* ---------- Airline: Wochenbilanz und Firmen-Shop ---------- */

/** Wochenbilanz mit Balkendiagramm der letzten Wochen und einem Tipp */
function showBalance() {
  G.state = 'balance';
  closeLineMenu();
  drag = null;
  const w = G.lastWeek || { week: G.week - 1, rev: 0, cost: 0, profit: 0 };
  $('#bal-title').textContent = `Wochenbilanz – Woche ${w.week}`;
  $('#bal-rev').textContent = fmtMoney(w.rev);
  $('#bal-cost').textContent = fmtMoney(-w.cost);
  const p = $('#bal-profit');
  p.textContent = (w.profit >= 0 ? '+' : '') + fmtMoney(w.profit);
  p.className = w.profit >= 0 ? 'plus' : 'minus';
  const m = $('#bal-money');
  m.textContent = fmtMoney(G.money);
  m.className = G.money >= 0 ? '' : 'minus';

  // Balkendiagramm: Gewinn (grün) / Verlust (rot) pro Woche
  const svg = $('#bal-chart');
  const hist = G.history.length ? G.history : [0];
  const max = Math.max(1, ...hist.map(Math.abs));
  const mid = 55, bw = 400 / Math.max(hist.length, 4);
  let html = `<line class="axis" x1="0" y1="${mid}" x2="400" y2="${mid}"/>`;
  hist.forEach((v, i) => {
    const h = (Math.abs(v) / max) * 45;
    const x = i * bw + bw * 0.2, y = v >= 0 ? mid - h : mid;
    html += `<rect class="${v >= 0 ? 'bar-plus' : 'bar-minus'}" x="${x}" y="${y}" width="${bw * 0.6}" height="${Math.max(1, h)}" rx="3"/>`;
    html += `<text x="${x + bw * 0.3}" y="${v >= 0 ? mid + 14 : mid - 5}" text-anchor="middle">W${w.week - hist.length + i + 1}</text>`;
  });
  svg.innerHTML = html;

  // Ein Tipp aus den Zahlen
  const crowded = G.stations.filter(s => s.queue.length >= capacityOf(s) * 0.7);
  const connected = new Set(G.lines.flatMap(l => l.stations));
  const open = G.stations.filter(s => !connected.has(s.id));
  $('#bal-tip').textContent =
    G.money < 0 ? `Achtung: Du bist im Minus. Ab ${fmtMoney(-SC.business.credit)} ist die Airline pleite – teure Flugzeuge abgeben oder Preise anpassen.`
    : w.profit < 0 ? 'Verlust diese Woche: Prüfe, ob teure Großraumjets und Jumbos genug Fluggäste haben.'
    : crowded.length ? `${crowded[0].name} wird voll – mehr Flugzeuge oder ein Terminal-Ausbau helfen.`
    : open.length ? `${open.length === 1 ? '1 Flughafen wartet' : `${open.length} Flughäfen warten`} noch auf eine Route – im Shop gibt es Lizenzen.`
    : 'Läuft! Mit einer Werbekampagne bekommst du noch mehr Fluggäste.';
  $('#toast').classList.remove('show');
  $('#screen-balance').hidden = false;
}

$('#bal-go').addEventListener('click', () => {
  $('#screen-balance').hidden = true;
  G.state = 'playing';
  saveGame();
});
$('#bal-shop').addEventListener('click', () => {
  $('#screen-balance').hidden = true;
  openShop();
});

/** Einen Shop-Eintrag bauen; buy() wird nur bei genug Geld ausgeführt */
function shopItem(icon, title, text, price, enabled, buy) {
  const b = document.createElement('button');
  b.className = 'shop-item';
  b.innerHTML = `<svg class="ico" viewBox="0 0 24 24">${icon}</svg><b></b><small></small><span class="price"></span>`;
  b.querySelector('b').textContent = title;
  b.querySelector('small').textContent = text;
  b.querySelector('.price').textContent = fmtMoney(price);
  b.disabled = !enabled || G.money < price;
  b.addEventListener('click', () => {
    if (G.money < price) return;
    G.money -= price;
    G.weekCost += price;
    buy();
    saveGame();
    if (G.state === 'shop') renderShop();
  });
  return b;
}

function renderShop() {
  const b = SC.business;
  $('#shop-money').textContent = fmtMoney(G.money);
  $('#shop-costs').textContent = fmtMoney(weeklyCosts());

  const price = $('#shop-price');
  price.innerHTML = '';
  for (const [key, lvl] of Object.entries(b.prices)) {
    const btn = document.createElement('button');
    btn.innerHTML = `<span></span><small></small>`;
    btn.firstChild.textContent = lvl.name;
    btn.lastChild.textContent = lvl.text;
    btn.classList.toggle('is-active', G.price === key);
    btn.addEventListener('click', () => { G.price = key; renderShop(); });
    price.appendChild(btn);
  }

  const planes = $('#shop-planes'); planes.innerHTML = '';
  const routes = $('#shop-routes'); routes.innerHTML = '';
  for (const mode of MODE_ORDER) {
    const M = MODES[mode];
    planes.appendChild(shopItem(M.icon, M.vehicle, `Leasing ${fmtMoney(b.lease[mode])}/Woche · ${G.inv[mode].free} frei`,
      b.planePrice[mode], true, () => {
        G.inv[mode].free++;
        toast(autoAssignVehicles() ? `${M.one} fliegt jetzt auf einer Route ohne Flugzeug.` : `${M.one} steht bereit – im Linien-Menü einsetzen.`);
      }));
    const canRoute = G.inv[mode].lines < M.maxLines && totalLineSlots() < LINE_COLORS.length;
    routes.appendChild(shopItem(M.icon, M.lineName, canRoute ? `${MODE_TEXT[mode]} – mit Flugzeug` : 'Höchstzahl erreicht',
      b.routePrice[mode], canRoute, () => {
        G.inv[mode].lines++;
        G.selectedMode = mode;
        toast(`Neue ${M.lineName}: zieh sie jetzt auf der Karte.`);
      }));
  }

  const build = $('#shop-build'); build.innerHTML = '';
  for (const u of TIER_UPGRADES) {
    const ok = G.stations.some(st => st.shape !== 'hub' && tierRank(st.tier) < tierRank(u.tier));
    build.appendChild(shopItem(BUILD_ICON, u.title, u.text, b.tierPrice[u.tier], ok, () => {
      closeShop('placeTier');
      G.placeTier = u.tier;
      toast(`Tippe auf den Flughafen, der ${TIER_INFO[u.tier].a} ${TIER_INFO[u.tier].name} werden soll.`, 4000);
    }));
  }
  build.appendChild(shopItem('<path d="M4 8h13l-3-3M20 16H7l3 3"/>', 'Umsteige-Terminal', 'Schneller umsteigen, 6 Plätze mehr.',
    b.nodePrice, G.stations.some(s => !s.node), () => {
      closeShop('placeNode');
      toast('Tippe auf den Flughafen für das Umsteige-Terminal.', 4000);
    }));
  build.appendChild(shopItem('<circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="9"/>', SC.bigTitle, '12 statt 6 Plätze an einem Flughafen.',
    b.bigPrice, G.stations.some(s => !s.big && s.shape !== 'hub'), () => {
      closeShop('placeBig');
      toast('Tippe auf den Flughafen, der größer werden soll.', 4000);
    }));
  const adRunning = G.t < G.marketingUntil;
  build.appendChild(shopItem('<path d="M4 10v4h3l6 4V6L7 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>', 'Werbekampagne',
    adRunning ? 'Läuft gerade.' : '+40 % Fluggäste für eine Woche.', b.marketingPrice, !adRunning, () => {
      G.marketingUntil = G.t + dayLen() * 7;
      toast('Werbekampagne läuft – eine Woche lang mehr Fluggäste!');
    }));
}

function openShop() {
  if (!SC.business) return;
  closeLineMenu();
  drag = null;
  G.state = 'shop';
  renderShop();
  $('#toast').classList.remove('show');
  $('#screen-shop').hidden = false;
}
/** Shop schließen – optional direkt in einen Platzier-Modus (Ausbau antippen) */
function closeShop(next = 'playing') {
  $('#screen-shop').hidden = true;
  G.state = next;
  saveGame();
}
$('#btn-shop').addEventListener('click', () => { if (G.state === 'playing') openShop(); });
$('#shop-close').addEventListener('click', () => closeShop());

/* ---------- Start und Ende ---------- */

function gameOver(st, reason = 'crowded') {
  G.state = 'over';
  G.lostStation = st;
  clearSave();                         // vorbei ist vorbei
  drag = null;
  closeLineMenu();
  const rec = best.get();
  const isNew = !G.sandbox && G.score > rec;
  if (isNew) best.set(G.score);
  $('#over-reason').textContent = reason === 'bankrupt'
    ? `Deine Airline ist pleite – der Kreditrahmen von ${fmtMoney(SC.business.credit)} ist aufgebraucht.`
    : st.shape === 'hub'
    ? `${SC.hubTitle} war zu lange überfüllt.`
    : st.name
      ? `Die Station ${st.name} war zu lange überfüllt.`
      : `Die ${SHAPE_NAME[st.shape]}-Station war zu lange überfüllt.`;
  if (SC.business && reason !== 'bankrupt') $('#over-reason').textContent += ` Kontostand am Ende: ${fmtMoney(G.money)}.`;
  $('#over-score').textContent = G.score;
  $('#over-weeks').textContent = G.week;
  $('#over-record').textContent = isNew ? 'Neuer Rekord!' : rec ? `Rekord: ${rec} Fahrgäste` : '';
  // Kurz zeigen, welche Station es war, dann den Zettel
  setTimeout(() => { $('#screen-over').hidden = false; }, 900);
}

/** Startzettel. Mit Spielstand: „Weiterspielen“ und „Neues Spiel“. */
/** Texte des Startzettels für eine Spielwelt (ohne das laufende Spiel zu verändern) */
function renderWorldPick(w) {
  const sc = SCENARIOS[w];
  for (const b of document.querySelectorAll('.world')) b.classList.toggle('is-active', b.dataset.world === w);
  $('#start-lead').textContent = sc.lead;
  sc.howto.forEach((t, i) => { $(`#how-${i}`).textContent = t; });
  const rec = best.get(w);
  $('#start-record').textContent = rec ? `Dein Rekord in ${sc.title}: ${rec} Fahrgäste` : '';
}

/** Spielwelt auf dem Startzettel wählen. Ohne Spielstand wechselt auch die Karte dahinter. */
function pickWorld(w) {
  worldPref.set(w);
  renderWorldPick(w);
  if (!G.resumeState) { newGame(w); cam.ready = false; }
}
for (const b of document.querySelectorAll('.world')) b.addEventListener('click', () => pickWorld(b.dataset.world));

function showStart(saved, canResume = !!saved) {
  renderWorldPick(worldPref.get());
  const info = $('#save-info');
  info.hidden = !saved;
  $('#btn-continue').hidden = !canResume;
  const start = $('#btn-start');
  start.textContent = canResume ? 'Neues Spiel' : 'Losfahren';
  start.classList.toggle('primary', !canResume);
  if (saved) {
    info.textContent = `Gespeichert ${timeAgo(saved.savedAt)}: ${SCENARIOS[saved.world]?.title || 'Hannover'}${saved.sandbox ? ' (Sandbox)' : ''} · Woche ${saved.week} · ${saved.score} Fahrgäste`;
  }
  $('#screen-start').hidden = false;
}

$('#btn-continue').addEventListener('click', resumeGame);

/** Zettel „Worauf setzt du?“: Fokus wählen, dann startet das neue Spiel */
function showFocus(world) {
  const sc = SCENARIOS[world];
  $('#focus-title').textContent = `${sc.title}: Worauf setzt du?`;
  const box = $('#focus-cards');
  box.innerHTML = '';
  for (const f of sc.focus) {
    const counts = FOCUS_LINES[f.key];
    const parts = MODE_ORDER.map((m, i) => counts[i] ? `${counts[i]}× ${(sc.modes[m] || HANNOVER_MODES[m]).name}` : '').filter(Boolean);
    const icons = MODE_ORDER.filter((m, i) => counts[i] >= 2 || (f.key === 'balanced' && i % 2 === 0))
      .map(m => `<svg class="ico" viewBox="0 0 24 24">${(sc.modes[m] || HANNOVER_MODES[m]).icon}</svg>`).join('');
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = `<span class="card-icons">${icons}</span><b></b><small></small><small class="card-lines"></small>`;
    b.querySelector('b').textContent = f.title;
    b.querySelector('small').textContent = f.text;
    b.querySelector('.card-lines').textContent = parts.join(' · ');
    b.addEventListener('click', () => {
      $('#screen-focus').hidden = true;
      clearSave();
      newGame(world, f.key);
      cam.ready = false;
      G.state = 'playing';
      G.speed = 1;
    });
    box.appendChild(b);
  }
  $('#screen-focus').hidden = false;
}

$('#btn-start').addEventListener('click', () => {
  if (G.resumeState && !confirm('Neues Spiel starten? Dein gespeichertes Spiel wird dabei überschrieben.')) return;
  $('#screen-start').hidden = true;
  const world = worldPref.get();
  if (world === 'hannover' && !tutorialSeen()) { startTutorial(); return; }   // allererstes Spiel: mit Anleitung
  showFocus(world);
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
  showFocus(G.world);
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
const stationNamed = name => G.stations.find(s => s.name === name);
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
      const ln = stationNamed('Linden-Nord'), list = stationNamed('List');
      stationOf('hub').queue.push(ln.shape, ln.shape, list.shape);
      ln.queue.push('hub', 'hub');
      list.queue.push('hub');
      stationNamed('Südstadt').queue.push('hub');
    },
    focus: () => ({ station: stationNamed('Linden-Nord') }),
  },
  {
    text: 'Unten wählst du das Verkehrsmittel. Tippe auf „Bus“ – Busse halten überall, fahren aber nur kurze Stücke.',
    focus: () => ({ tab: 'bus' }),
    done: t => t.tapped === 'bus',
  },
  {
    text: 'Zieh jetzt mit Stift oder Finger vom Hauptbahnhof nach Linden-Nord. So entsteht deine erste Buslinie.',
    focus: () => ({ path: [stationOf('hub'), stationNamed('Linden-Nord')] }),
    done: () => lineWith('bus', stationOf('hub'), stationNamed('Linden-Nord')),
  },
  {
    text: 'Super! Der Bus holt die Fahrgäste ab und bringt sie ans Ziel. Schau kurz zu …',
    focus: () => ({}),
    done: t => G.score >= 2 || t.time > 18,
  },
  {
    text: 'Die U-Bahn ist schneller, hält aber nur an Stationen mit blauem „U“. Tippe auf „U-Bahn“ und zieh vom Hauptbahnhof nach List.',
    focus: () => ({ tab: G.selectedMode === 'metro' ? null : 'metro', path: [stationOf('hub'), stationNamed('List')] }),
    done: () => lineWith('metro', stationOf('hub'), stationNamed('List')),
  },
  {
    text: 'Ein neuer Stadtteil: Linden-Mitte. Zieh von Linden-Nord (Endstation deiner Buslinie) dorthin – so verlängerst du die Linie. Tipp: Ziehst du mitten an einer Linie, fügst du eine Station dazwischen ein.',
    enter: () => {
      if (stationNamed('Linden-Mitte')) return;
      const d = HANNOVER.districts.find(x => x.name === 'Linden-Mitte');
      addStation('square', d.x, d.y, d.name, tierOfDistrict(d.name));
      G.districtsLeft = G.districtsLeft.filter(n => n !== d.name);
      rebuildRoutes();
    },
    focus: () => {
      const ln = stationNamed('Linden-Nord');
      const bus = lineWith('bus', stationOf('hub'), ln);
      if (!bus) return {};
      const handle = G.handles.find(h => h.line === bus &&
        (h.end === 'end' ? bus.stations[bus.stations.length - 1] : bus.stations[0]) === ln.id);
      return { handle, path: handle ? [{ x: handle.x, y: handle.y }, stationNamed('Linden-Mitte')] : null };
    },
    done: () => G.lines.some(l => l.mode === 'bus' && l.stations.includes(stationNamed('Linden-Mitte')?.id)),
  },
  {
    text: 'Tippe unten auf deine Buslinie. Dort setzt du weitere Fahrzeuge ein oder löschst die Linie wieder.',
    focus: () => ({ pen: G.lines.find(l => l.mode === 'bus') }),
    done: t => t.menuOpened,
  },
  {
    text: 'Wird eine Station zu voll, erscheint ein roter Kreis – dann schnell helfen! Jede Woche gibt es Upgrades: neue Linien, Fahrzeuge oder den Ausbau kleiner Haltestellen zu U-Bahn-Stationen und Bahnhöfen. Viel Spaß!',
    button: 'Los geht’s!',
  },
];

const tut = { step: 0, time: 0, tapped: null, menuOpened: false, focus: {} };

function startTutorial() {
  clearSave();
  worldPref.set('hannover');
  newGame('hannover');
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
   LADEBILDSCHIRM
   Bei jedem Öffnen: Zettel mit Logo, drumherum fahren Bus, U-Bahn und
   S-Bahn auf gezeichneten Strecken. Nach gut 2 Sekunden (oder beim
   Antippen) blendet er aus und gibt den Startzettel frei.
   ===================================================================== */

function runSplash() {
  const el = $('#splash');
  const cv = $('#splash-canvas');
  const c = cv.getContext('2d');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let running = true;
  let d = 1;

  // Strecken als Bezier-Kurven in Bildschirm-Anteilen (0…1)
  const ROUTES = [
    { mode: 'metro', color: '#2456c9', pts: [[-0.1, 0.85], [0.3, 0.55], [0.65, 0.95], [1.1, 0.2]], speed: 0.085, vehicles: 2 },
    { mode: 'sbahn', color: '#ef8a17', pts: [[-0.1, 0.25], [0.35, 0.05], [0.6, 0.55], [1.1, 0.4]], speed: 0.11, vehicles: 1 },
    { mode: 'bus', color: '#d23b2f', pts: [[0.15, -0.1], [0.05, 0.5], [0.5, 0.75], [0.85, 1.1]], speed: 0.05, vehicles: 3 },
    { mode: 'rail', color: '#2f9e4f', pts: [[1.1, 0.7], [0.75, 0.6], [0.55, 0.15], [0.2, -0.1]], speed: 0.13, vehicles: 1 },
  ];
  const bez = (p, t) => {
    const u = 1 - t;
    return [0, 1].map(k => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
  };

  function resize() {
    d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(innerWidth * d);
    cv.height = Math.round(innerHeight * d);
  }

  function draw(time) {
    const W = innerWidth, H = innerHeight, s = Math.min(W, H) / 22;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, W, H);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const r of ROUTES) {
      const P = r.pts.map(([x, y]) => [x * W, y * H]);
      // Strecke im Stil des Verkehrsmittels
      c.beginPath();
      c.moveTo(P[0][0], P[0][1]);
      c.bezierCurveTo(P[1][0], P[1][1], P[2][0], P[2][1], P[3][0], P[3][1]);
      c.strokeStyle = r.color;
      c.globalAlpha = 0.85;
      c.lineWidth = (r.mode === 'metro' ? 0.3 : r.mode === 'sbahn' ? 0.28 : 0.2) * s;
      c.setLineDash(r.mode === 'bus' ? [0.55 * s, 0.32 * s] : []);
      c.stroke();
      if (r.mode === 'sbahn' || r.mode === 'rail') {
        c.strokeStyle = '#fffdf3';
        c.lineWidth = 0.08 * s;
        c.setLineDash(r.mode === 'sbahn' ? [0.45 * s, 0.35 * s] : [0.08 * s, 0.37 * s]);
        c.stroke();
      }
      c.setLineDash([]);
      c.globalAlpha = 1;
      // Haltestellen
      for (const t of [0.22, 0.5, 0.78]) {
        const [x, y] = bez(P, t);
        c.beginPath(); c.arc(x, y, 0.45 * s, 0, Math.PI * 2);
        c.fillStyle = '#fff'; c.fill();
        c.strokeStyle = '#2b2b2b'; c.lineWidth = Math.max(2, 0.1 * s); c.stroke();
      }
      // Fahrzeuge
      const len = r.mode === 'rail' ? 2.1 : r.mode === 'sbahn' ? 1.5 : r.mode === 'bus' ? 0.8 : 1.0;
      const parts = r.mode === 'rail' ? 3 : r.mode === 'sbahn' ? 2 : 1;
      for (let k = 0; k < r.vehicles; k++) {
        const t = reduce ? 0.35 + k * 0.2 : ((time / 1000) * r.speed + k / r.vehicles) % 1;
        const [x, y] = bez(P, t), [x2, y2] = bez(P, Math.min(1, t + 0.002));
        c.save();
        c.translate(x, y);
        c.rotate(Math.atan2(y2 - y, x2 - x));
        c.fillStyle = r.color;
        c.strokeStyle = 'rgba(0,0,0,.35)';
        c.lineWidth = 1.5;
        const w = len * s, h = 0.46 * s, gap = 0.06 * s, pw = (w - gap * (parts - 1)) / parts;
        for (let p = 0; p < parts; p++) {
          c.beginPath();
          c.roundRect(-w / 2 + p * (pw + gap), -h / 2, pw, h, h * 0.35);
          c.fill(); c.stroke();
        }
        c.restore();
      }
    }
  }

  function loop(time) {
    if (!running) return;
    draw(time);
    if (!reduce) requestAnimationFrame(loop);
  }

  function hide() {
    if (!running) return;
    running = false;
    el.classList.add('hide');
    removeEventListener('resize', resize);
    setTimeout(() => { el.hidden = true; cv.width = cv.height = 0; }, 500);
  }

  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(loop);
  el.addEventListener('pointerdown', hide);
  setTimeout(hide, reduce ? 900 : 2400);
}

/* =====================================================================
   SPIELWELTEN
   Beide Welten nutzen dieselbe Spiellogik. Eine Welt bringt Karte,
   Stationen, Stationsarten, Fahrzeug-Namen/-Werte, Liniennamen,
   Ereignisse und Texte mit. applyScenario() tauscht alles aus.
   ===================================================================== */

/* ---------- Spielwelt Europa (Fluglinien) ----------
   Grobe Skizze aus dem Gedächtnis – nicht kartengenau! Koordinaten als
   [Längengrad, Breitengrad], umgerechnet um Frankfurt herum: 1 U ≈ 60 km.  */
const EU_KM_PER_U = 60;
const eu = ([lon, lat]) => [((lon - 8.68) * 71.3) / EU_KM_PER_U, (-(lat - 50.04) * 111) / EU_KM_PER_U];
const euPoly = pts => pts.map(eu);

const EUROPA_MAP = {
  // Landflächen (das Meer ist alles andere); innere Meere werden wieder zu Wasser
  land: [
    euPoly([[45, 72], [33, 69.5], [28, 71.0], [23.5, 70.8], [18.9, 69.7], [15.0, 68.5], [12.5, 66.0], [10.4, 63.4], [5.3, 62.5],
      [5.0, 60.4], [5.6, 58.9], [7.0, 58.0], [9.5, 59.0], [10.7, 59.9], [11.0, 59.0], [11.9, 57.7], [12.9, 55.6], [14.3, 55.6],
      [16.4, 56.6], [16.5, 57.8], [18.1, 59.3], [17.3, 60.7], [17.3, 62.5], [21.0, 64.0], [22.1, 65.6], [25.4, 65.0], [24.5, 64.0],
      [21.5, 61.5], [21.5, 60.5], [24.9, 60.2], [28.0, 60.5], [30.3, 59.9], [28.0, 59.5], [24.0, 59.4], [23.5, 58.3], [24.1, 57.0],
      [21.0, 56.8], [21.0, 55.3], [19.5, 54.4], [18.6, 54.5], [16.5, 54.5], [14.2, 53.9], [12.5, 54.4], [10.9, 54.4], [10.5, 55.5],
      [10.6, 57.7], [8.2, 56.8], [8.1, 55.5], [8.6, 54.9], [8.8, 54.0], [7.0, 53.6], [5.0, 53.4], [4.6, 52.3], [3.6, 51.4],
      [2.5, 51.1], [1.6, 50.9], [1.5, 50.2], [0.1, 49.7], [-1.2, 49.6], [-1.6, 48.6], [-3.0, 48.8], [-4.7, 48.4], [-4.3, 47.8],
      [-2.5, 47.3], [-1.2, 46.2], [-1.3, 44.7], [-1.6, 43.4], [-3.8, 43.5], [-5.8, 43.6], [-8.0, 43.7], [-9.2, 43.1], [-8.9, 42.0],
      [-8.7, 41.1], [-9.4, 39.4], [-9.2, 38.7], [-8.9, 37.9], [-8.9, 37.0], [-7.4, 37.2], [-6.4, 36.8], [-5.6, 36.0], [-4.4, 36.7],
      [-2.1, 36.8], [-0.8, 37.6], [0.0, 38.8], [-0.3, 39.5], [0.9, 41.0], [2.2, 41.4], [3.2, 42.4], [3.1, 43.1], [4.8, 43.4],
      [6.0, 43.1], [7.3, 43.7], [8.9, 44.4], [10.3, 43.6], [11.2, 42.4], [12.4, 41.7], [14.2, 40.8], [15.6, 40.0], [15.6, 38.2],
      [16.6, 38.9], [17.1, 39.4], [16.5, 40.2], [18.5, 40.1], [16.9, 41.1], [15.6, 41.9], [14.0, 42.6], [13.6, 43.6], [12.3, 44.5],
      [12.3, 45.4], [13.7, 45.6], [14.5, 45.2], [15.3, 44.2], [16.4, 43.5], [18.1, 42.6], [19.4, 41.9], [19.4, 40.5], [20.2, 39.6],
      [21.2, 38.3], [21.7, 36.8], [22.9, 36.4], [23.7, 37.9], [24.0, 38.5], [22.9, 40.6], [24.4, 40.9], [26.0, 40.8], [26.5, 40.3],
      [26.2, 39.5], [27.0, 38.4], [27.3, 37.0], [28.5, 36.6], [30.7, 36.9], [33.0, 36.1], [36.0, 36.5], [45, 36]]),
    // Großbritannien, Irland, Island
    euPoly([[-5.7, 50.1], [-3.0, 50.6], [-1.0, 50.8], [1.4, 51.1], [1.7, 52.6], [0.3, 53.5], [-0.1, 54.5], [-1.6, 55.6], [-2.0, 57.1],
      [-3.0, 58.6], [-5.0, 58.6], [-6.2, 56.6], [-5.6, 55.4], [-4.9, 54.8], [-3.2, 54.5], [-3.1, 53.4], [-4.6, 53.3], [-4.2, 52.2],
      [-5.2, 51.7], [-3.0, 51.4], [-4.2, 51.1]]),
    euPoly([[-6.2, 53.3], [-6.0, 54.6], [-7.3, 55.3], [-8.5, 54.6], [-10.0, 53.5], [-9.8, 52.0], [-8.5, 51.6], [-6.4, 52.2]]),
    euPoly([[-22.5, 64.0], [-23.9, 64.9], [-22.0, 66.4], [-16.0, 66.5], [-13.6, 65.2], [-15.0, 64.3], [-18.0, 63.4], [-21.0, 63.8]]),
    // Inseln im Süden
    euPoly([[12.4, 37.8], [13.4, 38.2], [15.6, 38.3], [15.1, 37.0], [14.0, 37.1]]),
    euPoly([[8.4, 41.1], [9.8, 41.0], [9.7, 39.2], [9.0, 39.1], [8.4, 39.9]]),
    euPoly([[9.4, 43.0], [9.5, 42.0], [8.8, 41.4], [8.6, 42.6]]),
    euPoly([[23.5, 35.3], [26.3, 35.2], [25.0, 34.95], [23.6, 35.0]]),
    euPoly([[32.3, 35.0], [34.6, 35.6], [33.9, 34.9], [32.6, 34.7]]),
    euPoly([[2.4, 39.6], [3.4, 39.8], [3.2, 39.3]]),
    euPoly([[10.9, 55.7], [12.6, 56.0], [12.6, 55.3], [11.8, 55.0], [11.0, 55.2]]),
    // Nordafrika und Levante (unten am Rand)
    euPoly([[-15, 25], [-15, 30], [-9.6, 30.4], [-6.8, 34.0], [-5.9, 35.8], [-2.0, 35.1], [3.0, 36.7], [10.2, 37.2], [11.1, 36.9],
      [10.0, 34.0], [15.0, 32.4], [20.0, 32.0], [25.0, 31.7], [29.9, 31.2], [32.3, 31.2], [34.9, 32.8], [35.6, 34.6], [45, 34.6], [45, 25]]),
  ],
  innerSeas: [
    { name: 'Schwarzes Meer', pts: euPoly([[29.1, 41.2], [28.0, 41.9], [27.9, 43.2], [28.7, 44.2], [29.7, 45.2], [30.7, 46.5], [32.5, 46.1],
      [33.5, 44.5], [36.6, 45.3], [37.8, 44.7], [39.7, 43.6], [41.6, 41.6], [37.5, 41.0], [34.0, 42.0], [31.5, 41.3]]) },
  ],
  seaLabels: [
    { name: 'Nordsee', at: eu([3, 56]) }, { name: 'Ostsee', at: eu([19, 57.6]) }, { name: 'Mittelmeer', at: eu([5.5, 39.5]) },
    { name: 'Mittelmeer', at: eu([19, 35.3]) }, { name: 'Atlantik', at: eu([-14, 47]) }, { name: 'Schwarzes Meer', at: eu([34, 43.5]) },
    { name: 'Nordatlantik', at: eu([-12, 61]) },
  ],
  water: [], lakes: [], green: [], pois: [],
  // Länder: groß und blass (wie das Umland in Hannover)
  towns: [
    ['Deutschland', 10.5, 51.3], ['Frankreich', 2.0, 46.8], ['Spanien', -4.5, 39.2], ['Italien', 12.8, 43.2], ['Polen', 19.5, 52.2],
    ['Großbritannien', -2.3, 52.6], ['Skandinavien', 15, 63.5], ['Türkei', 33, 39], ['Griechenland', 22, 39.6], ['Rumänien', 25, 46],
    ['Ukraine', 31, 49], ['Russland', 38, 58],
  ].map(([name, lon, lat]) => ({ name, at: eu([lon, lat]) })),
  // Flughäfen: die ersten drei sind die Startstationen
  districts: [
    ['Amsterdam', 4.76, 52.31], ['München', 11.79, 48.35], ['Berlin', 13.5, 52.37],
    ['Düsseldorf', 6.77, 51.29], ['Hannover', 9.68, 52.46], ['Zürich', 8.55, 47.46], ['Brüssel', 4.48, 50.9], ['Prag', 14.26, 50.1],
    ['Paris', 2.55, 49.01], ['Hamburg', 9.99, 53.63], ['Mailand', 8.72, 45.63], ['Wien', 16.57, 48.11], ['Lyon', 5.08, 45.73],
    ['London', -0.45, 51.47], ['Kopenhagen', 12.65, 55.62], ['Venedig', 12.35, 45.5], ['Warschau', 20.97, 52.17], ['Krakau', 19.8, 50.08],
    ['Budapest', 19.26, 47.43], ['Manchester', -2.27, 53.35], ['Marseille', 5.21, 43.44], ['Nizza', 7.21, 43.66], ['Danzig', 18.47, 54.38],
    ['Toulouse', 1.37, 43.63], ['Rom', 12.25, 41.8], ['Oslo', 11.1, 60.19], ['Barcelona', 2.08, 41.3], ['Dublin', -6.27, 53.42],
    ['Edinburgh', -3.37, 55.95], ['Split', 16.3, 43.54], ['Stockholm', 17.92, 59.65], ['Belgrad', 20.31, 44.82], ['Bilbao', -2.91, 43.3],
    ['Neapel', 14.29, 40.88], ['Vilnius', 25.29, 54.63], ['Riga', 23.97, 56.92], ['Palma', 2.74, 39.55], ['Cork', -8.49, 51.84],
    ['Madrid', -3.57, 40.49], ['Bergen', 5.22, 60.29], ['Valencia', -0.48, 39.49], ['Bukarest', 26.08, 44.57], ['Sofia', 23.41, 42.7],
    ['Helsinki', 24.96, 60.32], ['Thessaloniki', 22.97, 40.52], ['Catania', 15.07, 37.47], ['Malta', 14.48, 35.86], ['Porto', -8.68, 41.24],
    ['Sevilla', -5.9, 37.42], ['Lissabon', -9.13, 38.77], ['Málaga', -4.5, 36.67], ['Athen', 23.94, 37.94], ['Istanbul', 28.75, 41.26],
    ['Heraklion', 25.18, 35.34], ['Antalya', 30.8, 36.9], ['Moskau', 37.4, 55.97], ['Larnaka', 33.62, 34.87], ['Tromsø', 18.92, 69.68],
    ['Reykjavík', -22.6, 63.98],
  ].map(([name, lon, lat]) => { const [x, y] = eu([lon, lat]); return { name, x: Math.round(x), y: Math.round(y) }; }),
};

const EUROPA_TIERS = {
  rail: ['London', 'Paris', 'Amsterdam', 'Madrid', 'Rom', 'Istanbul', 'München', 'Barcelona', 'Moskau'],
  metro: ['Berlin', 'Zürich', 'Wien', 'Kopenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Dublin', 'Lissabon', 'Brüssel', 'Mailand',
    'Athen', 'Warschau', 'Prag', 'Düsseldorf', 'Hamburg', 'Manchester', 'Palma', 'Budapest', 'Edinburgh', 'Nizza'],
  tram: ['Hannover', 'Lyon', 'Venedig', 'Neapel', 'Krakau', 'Bukarest', 'Sofia', 'Riga', 'Belgrad', 'Toulouse', 'Porto'],
};

const PLANE = 'M3 12h18M14 12 9.5 4.5M14 12l-4.5 7.5M5.5 12 3.5 8.5M5.5 12l-2 3.5';
const EUROPA_MODES = {
  bus: { name: 'Propeller', vehicle: 'Propellermaschine', lineName: 'Propellerlinie', none: 'Keine Propellermaschine frei',
    no: 'keine Propellermaschine', gift: 'eine Propellermaschine', one: 'Eine Propellermaschine', the: 'die Propellermaschine', two: '2 Propellermaschinen',
    speed: 3.2, dwell: 0.4, maxHop: 13, minHop: 0, maxStops: 9, style: 'dashed', plane: 0.9,
    icon: `<path d="${PLANE}"/><circle cx="11.5" cy="8.2" r="1.3"/><circle cx="11.5" cy="15.8" r="1.3"/>` },
  tram: { name: 'Regionaljet', vehicle: 'Regionaljet', lineName: 'Regionalroute', none: 'Kein Regionaljet frei',
    no: 'kein Regionaljet', gift: 'einen Regionaljet', one: 'Ein Regionaljet', the: 'den Regionaljet',
    speed: 4.2, dwell: 0.35, maxHop: 22, minHop: 0, maxStops: 10, style: 'dotted', plane: 1.0,
    icon: `<path d="${PLANE}"/>` },
  metro: { name: 'Mittelstrecke', vehicle: 'Mittelstreckenjet', lineName: 'Mittelstreckenroute', none: 'Kein Mittelstreckenjet frei',
    no: 'kein Mittelstreckenjet', gift: 'einen Mittelstreckenjet', one: 'Ein Mittelstreckenjet', the: 'den Mittelstreckenjet',
    speed: 5.5, dwell: 0.45, maxHop: 37, minHop: 0, maxStops: 99, style: 'solid', plane: 1.2,
    icon: `<path d="${PLANE}"/><path d="M11 8.5h2M11 15.5h2"/>` },
  sbahn: { name: 'Großraumjet', vehicle: 'Großraumjet', lineName: 'Großraumroute', none: 'Kein Großraumjet frei',
    no: 'kein Großraumjet', gift: 'einen Großraumjet', one: 'Ein Großraumjet', the: 'den Großraumjet',
    speed: 6.5, dwell: 0.7, maxHop: 99, minHop: 0, maxStops: 9, style: 'sbahn', plane: 1.5,
    icon: `<path d="${PLANE}"/><path d="M10.5 7.5h2M11.8 6.2h2M10.5 16.5h2M11.8 17.8h2"/>` },
  rail: { name: 'Jumbo', vehicle: 'Jumbo', lineName: 'Jumbo-Route', none: 'Kein Jumbo frei',
    no: 'kein Jumbo', gift: 'einen Jumbo', one: 'Ein Jumbo', the: 'den Jumbo',
    speed: 8, dwell: 0.9, maxHop: 99, minHop: 25, maxStops: 6, style: 'jumbo', plane: 1.8,
    icon: `<path d="${PLANE}"/><path d="M15 10h4.5"/>` },
};

const EUROPA = {
  key: 'europa',
  title: 'Europa',
  sub: 'Deine eigene Airline',
  dayLength: 16,                                    // längere Wochen
  demand: 0.75,                                     // weniger Andrang am Anfang
  spawnInterval: week => Math.max(18, 32 - week),   // neue Städte seltener
  /**
   * Unternehmer-Modus: Geld verdienen und ausgeben.
   * Ein Fahrgast-Symbol steht für ~100 Fluggäste.
   */
  business: {
    start: 4e6,                 // Startkapital
    credit: 2e6,                // Kreditrahmen – darunter ist die Airline pleite
    fare: { bus: 25e3, tram: 35e3, metro: 55e3, sbahn: 80e3, rail: 120e3 },      // Umsatz pro Symbol
    lease: { bus: 60e3, tram: 100e3, metro: 160e3, sbahn: 260e3, rail: 400e3 },  // Leasing pro Flugzeug und Woche
    routeFee: 40e3,             // Gebühren pro Route und Woche
    planePrice: { bus: 0.3e6, tram: 0.6e6, metro: 1.2e6, sbahn: 2.5e6, rail: 4e6 },
    routePrice: { bus: 0.5e6, tram: 0.9e6, metro: 1.5e6, sbahn: 2.5e6, rail: 3.5e6 },
    tierPrice: { tram: 1e6, metro: 2.5e6, rail: 5e6 },
    nodePrice: 1.5e6,
    bigPrice: 1e6,
    marketingPrice: 0.6e6,
    prices: {
      cheap: { name: 'Günstig', fare: 0.7, demand: 1.3, text: 'mehr Fluggäste, weniger pro Ticket' },
      normal: { name: 'Normal', fare: 1, demand: 1, text: 'ausgewogen' },
      premium: { name: 'Premium', fare: 1.4, demand: 0.7, text: 'weniger Fluggäste, mehr pro Ticket' },
    },
  },
  hubName: 'Frankfurt',
  hubTitle: 'Der Flughafen Frankfurt',
  dragHint: 'Zieh von Flughafen zu Flughafen.',
  hint: 'Wähle unten ein Flugzeug und zieh von Flughafen zu Flughafen.',
  atHub: 'in Frankfurt',
  stopVerb: 'landet',
  moveVerb: 'fliegt',
  focus: [
    { key: 'bus', title: 'Kurzstrecke', text: 'Viele Propellerlinien – kleine Flughäfen, kurze Wege.' },
    { key: 'city', title: 'Mittelstrecke', text: 'Regionaljets und Mittelstrecken quer durch Europa.' },
    { key: 'rail', title: 'Langstrecke', text: 'Großraumjets und Jumbos – weit hinaus über Frankfurt.' },
    { key: 'balanced', title: 'Ausgewogen', text: 'Von allem etwas.' },
  ],
  kmPerU: EU_KM_PER_U,
  map: EUROPA_MAP,
  tiers: EUROPA_TIERS,
  modes: EUROPA_MODES,
  tierInfo: {
    bus: { name: 'Flugplatz', a: 'ein' },
    tram: { name: 'Regionalflughafen', a: 'ein', badge: 'R' },
    metro: { name: 'Flughafen', a: 'ein', badge: 'F' },
    rail: { name: 'Großflughafen', a: 'ein', badge: 'G' },
  },
  lineNames: { bus: ['P1', 'P2', 'P3', 'P4', 'P5'], tram: ['RJ1', 'RJ2', 'RJ3'], metro: ['M1', 'M2', 'M3'], sbahn: ['G1', 'G2'], rail: ['J1', 'J2'] },
  events: [
    { key: 'okt', name: 'Oktoberfest', place: 'München', text: 'Oktoberfest – ganz Europa will nach München!' },
    { key: 'ferien', name: 'Sommerferien', place: 'Palma', text: 'Sommerferien – alle wollen auf die Insel!' },
    { key: 'cl', name: 'Champions-League-Finale', place: 'London', text: 'Champions-League-Finale in London!' },
    { key: 'messe', name: 'Hannover Messe', place: 'Hannover', text: 'Hannover Messe – Geschäftsreisende aus ganz Europa!' },
    { key: 'karneval', name: 'Karneval', place: 'Venedig', text: 'Karneval in Venedig – Masken überall!' },
  ],
  modeText: {
    bus: 'kurze Strecken bis ~600 km, landet überall',
    tram: 'bis ~1.100 km, ab Regionalflughafen',
    metro: 'bis ~2.200 km, nur Flughäfen',
    sbahn: 'nur Großflughäfen, über Frankfurt',
    rail: 'nur Langstrecken ab ~1.500 km, ab Frankfurt',
  },
  tierUpgrades: [
    { tier: 'tram', title: 'Landebahn verlängern', text: 'Ein Flugplatz wird Regionalflughafen.' },
    { tier: 'metro', title: 'Terminal bauen', text: 'Ein Flughafen für Mittelstrecken-Jets.' },
    { tier: 'rail', title: 'Großflughafen', text: 'Hier landen auch Großraumjets und Jumbos.' },
  ],
  bigTitle: 'Großes Terminal',
  lead: 'Gründe deine Airline in Frankfurt – mit 4 Mio € Startkapital. Verdiene an jedem Ticket, zahle Leasing und Gebühren und wachse bis nach London, Rom und Moskau.',
  howto: [
    'Wähle unten ein Flugzeug und zieh von Flughafen zu Flughafen – jede Route least automatisch ein Flugzeug.',
    'Fluggäste bringen Umsatz, Flugzeuge und Routen kosten laufend Geld. Im Firmen-Shop (Aktenkoffer) kaufst du Flugzeuge, Routen und Ausbauten.',
    'Achte auf Kontostand und überfüllte Flughäfen: Pleite oder Chaos am Gate heißt Endstation.',
  ],
};

// Hannover: die ursprünglichen Werte merken, damit man zurückwechseln kann
const HANNOVER_MODES = Object.fromEntries(MODE_ORDER.map(m => [m, { ...MODES[m], plane: 0 }]));
const BASE_TIER_INFO = Object.fromEntries(TIERS.map(t => [t, { ...TIER_INFO[t] }]));

const SCENARIOS = {
  hannover: {
    key: 'hannover',
    title: 'Hannover',
    sub: 'Bus, Tram, U-Bahn, S-Bahn, Zug',
    hubName: 'Hauptbahnhof',
    hubTitle: 'Der Hauptbahnhof',
    dragHint: 'Zieh von Station zu Station.',
    hint: 'Wähle unten ein Verkehrsmittel und zieh von Station zu Station.',
    atHub: 'am Hauptbahnhof',
    stopVerb: 'hält',
    moveVerb: 'fährt',
    focus: [
      { key: 'bus', title: 'Busnetz', text: 'Viele Buslinien – halten überall, kurze Wege.' },
      { key: 'city', title: 'Stadtbahn', text: 'Tram und U-Bahn – schnell durch die Stadt.' },
      { key: 'rail', title: 'Schiene', text: 'S-Bahn und Zug – weite Strecken über den Hauptbahnhof.' },
      { key: 'balanced', title: 'Ausgewogen', text: 'Von allem etwas.' },
    ],
    kmPerU: KM_PER_U,
    map: HANNOVER,
    tiers: DISTRICT_TIER,
    modes: {},
    tierInfo: {},
    lineNames: LINE_NAMES,
    events: EVENTS,
    modeText: MODE_TEXT,
    tierUpgrades: TIER_UPGRADES,
    bigTitle: 'Großer Bahnhof',
    lead: 'Hannover wächst – vom Hauptbahnhof bis nach Linden, List und Misburg. Verbinde die Stadtteile, bevor die Stationen überfüllt sind.',
    howto: [
      'Wähle unten Bus, Tram, U-Bahn oder Zug und zieh mit Stift oder Finger von Station zu Station.',
      'Fahrgäste wollen zu einer Station mit ihrer Form – viele zum Hauptbahnhof.',
      'Busse halten überall, U-Bahnen nur an „U“-Stationen, S-Bahn und Zug nur an Bahnhöfen („S“). Kleine Haltestellen baust du per Upgrade aus.',
    ],
  },
  europa: EUROPA,
};

/** Spielwelt wechseln: Daten, Fahrzeuge, Stationsarten und Upgrades austauschen */
function applyScenario(key) {
  SC = SCENARIOS[key] || SCENARIOS.hannover;
  HANNOVER = SC.map;
  DISTRICT_TIER = SC.tiers;
  LINE_NAMES = SC.lineNames;
  EVENTS = SC.events;
  MODE_TEXT = SC.modeText;
  TIER_UPGRADES = SC.tierUpgrades;
  for (const m of MODE_ORDER) Object.assign(MODES[m], HANNOVER_MODES[m], SC.modes[m] || {});
  for (const t of TIERS) Object.assign(TIER_INFO[t], BASE_TIER_INFO[t], SC.tierInfo[t] || {});
  UPGRADES = buildUpgrades();
  hudCache.pens = null;
}

/** Zuletzt gewählte Spielwelt (nur Komfort) */
const worldPref = {
  get() { try { return localStorage.getItem('heftmetro.world') || 'hannover'; } catch { return 'hannover'; } },
  set(v) { try { localStorage.setItem('heftmetro.world', v); } catch { /* egal */ } },
};

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
/* ---------- Sandbox ----------
   Freies Bauen: keine Stationen von allein, kein Game Over, keine Upgrades.
   Werkzeugzettel links mit vier Reitern:
     Bauen  – Station setzen (Form + Art), Innenstadt / ganze Region auf einmal
     Ändern – Ausbau, Form, Name, Schieben, Umsteigeknoten, groß, Abreißen
     Spaß   – Ereignisse an einer Station, Rushhour, Feierabend, Flotte
     Stadt  – Fahrgast-Menge, Statistik (Netzlänge, beste Linien), alles abreißen
   Wer unten ein Verkehrsmittel antippt, zeichnet wieder Linien.               */

const SB_SHAPES = ['circle', 'triangle', 'square', 'star', 'diamond', 'cross'];
const SB_SHAPE_SIGN = { circle: '●', triangle: '▲', square: '■', star: '★', diamond: '◆', cross: '✚' };
const SB_DEMAND = [[0, 'Aus'], [0.5, 'Wenig'], [1, 'Normal'], [2, 'Viel']];
const TOOL_HELP = {
  lines: 'Linien zeichnen – unten Verkehrsmittel wählen.',
  build: 'Station bauen – tippe auf die Karte.',
  tier: 'Ausbau – Station antippen (Bus → Tram → U → Bahnhof).',
  shape: 'Form – Station antippen.',
  name: 'Name – Station antippen und umbenennen.',
  move: 'Schieben – Station anfassen und ziehen.',
  node: 'Umsteigeknoten – Station antippen (an/aus).',
  big: 'Großer Bahnhof – Station antippen (an/aus).',
  remove: 'Abreißen – Station antippen.',
  event: 'Ereignis – tippe auf die Station, wo es stattfindet.',
};

function startSandbox(world) {
  clearSave();
  newGame(world);
  G.sandbox = true;
  G.tool = 'build';
  G.sbTab = 'build';
  // Nur der Hauptbahnhof – alles andere baust du selbst
  G.stations = G.stations.filter(s => s.shape === 'hub');
  G.districtsLeft = HANNOVER.districts.map(d => d.name);
  for (const m of MODE_ORDER) G.inv[m] = { lines: MODES[m].maxLines, free: 30 };
  rebuildRoutes();
  cam.ready = false;
  G.state = 'playing';
  G.speed = 1;
  hudCache.pens = null;
  hudCache.sb = null;
  toast('Sandbox: Baue Stationen, wo du willst, und zieh Linien – ohne Zeitdruck und ohne Game Over.', 4200);
}

function setTool(tool) {
  G.tool = tool;
  drag = null;
  closeLineMenu();
  hudCache.sb = null;
}

/** Freie Stadtteile auf einmal bauen (nur innerhalb von maxR, in U) */
function buildDistricts(maxR = Infinity) {
  let n = 0;
  for (const name of [...G.districtsLeft]) {
    const d = HANNOVER.districts.find(q => q.name === name);
    if (!d || Math.hypot(d.x, d.y) > maxR) continue;
    if (G.stations.some(s => dist(s.x, s.y, d.x, d.y) < 1.4)) continue;
    const st = addStation(COMMON_SHAPES[Math.floor(Math.random() * 3)], d.x, d.y, d.name, tierOfDistrict(d.name));
    st.born = G.t - 0.1 - n * 0.03;
    G.districtsLeft = G.districtsLeft.filter(q => q !== name);
    n++;
  }
  // ein paar Sonderformen, damit es spannend bleibt
  const plain = G.stations.filter(s => s.shape !== 'hub');
  for (const r of RARE_SHAPES) {
    if (G.stations.some(s => s.shape === r) || plain.length < 8) continue;
    plain[Math.floor(Math.random() * plain.length)].shape = r;
  }
  rebuildRoutes();
  cam.manual = false;
  return n;
}

/** Netzlänge in km (jeder Abschnitt einmal, auch wenn mehrere Linien dort fahren) */
function networkKm() {
  const seen = new Set();
  let u = 0;
  for (const l of G.lines) for (const [a, b] of segs(l)) {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const A = stationById(a), B = stationById(b);
    if (A && B) u += dist(A.x, A.y, B.x, B.y);
  }
  return u * SC.kmPerU;
}

const SB_ACTIONS = {
  inner() {
    const n = buildDistricts((SC.key === 'europa' ? 900 : 4) / SC.kmPerU);
    toast(n ? `${n} Stationen gebaut.` : 'Hier ist schon alles gebaut.');
  },
  all() {
    const n = buildDistricts();
    toast(n ? `${n} Stationen gebaut – jetzt brauchst du Linien!` : 'Es ist schon alles gebaut.');
  },
  rush() {
    for (const st of G.stations) for (let i = 0; i < 4; i++) { const d = pickDestination(st.shape, true); if (d) st.queue.push(d); }
    toast('Rushhour! An jeder Station warten jetzt mehr Leute.');
  },
  home() {
    for (const st of G.stations) if (st.shape !== 'hub') for (let i = 0; i < 3; i++) st.queue.push('hub');
    toast(`Feierabend – alle wollen zum ${SC.hubName}!`);
  },
  calm() {
    for (const st of G.stations) st.queue = [];
    toast('Alle Stationen sind leer.');
  },
  fleet() {
    let n = 0;
    for (const l of G.lines) { G.inv[l.mode].free++; if (addTrain(l)) n++; }
    toast(n ? `${n} Fahrzeuge zusätzlich unterwegs.` : 'Erst Linien bauen.');
  },
  clear() {
    if (!confirm('Wirklich alles abreißen? Nur der Hauptbahnhof bleibt stehen.')) return;
    for (const l of [...G.lines]) deleteLine(l);
    G.stations = G.stations.filter(s => s.shape === 'hub');
    for (const s of G.stations) s.queue = [];
    G.districtsLeft = HANNOVER.districts.map(d => d.name);
    G.event = null;
    G.score = 0;
    rebuildRoutes();
    cam.manual = false;
    toast('Alles abgerissen – neue Stadt, neues Glück.');
  },
};

/** Werkzeugzettel an den Spielzustand anpassen (aus updateHud) */
function syncSandboxUi() {
  const on = G.sandbox && G.state !== 'start' && G.state !== 'over';
  if (on && G.sbTab === 'city') updateSandboxStats();
  const key = on ? `${G.tool}|${G.sbTab}|${G.sbShape}|${G.sbTier}|${G.sbDemand}|${G.sbEvent}|${SC.key}|${G.sbMin}` : 'off';
  if (hudCache.sb === key) return;
  hudCache.sb = key;
  $('#sandbox').hidden = !on;
  if (!on) return;
  $('#sandbox').classList.toggle('min', !!G.sbMin);
  $('#sb-min').textContent = G.sbMin ? '+' : '–';
  $('#sb-status-text').textContent = TOOL_HELP[G.tool] || '';
  document.querySelector('[data-act="inner"]').textContent = SC.key === 'europa' ? 'Mitteleuropa' : 'Innenstadt';
  $('#sb-back').hidden = G.tool === 'lines';
  for (const b of document.querySelectorAll('.sb-tab')) b.classList.toggle('is-active', b.dataset.tab === G.sbTab);
  for (const p of document.querySelectorAll('.sb-pane')) p.hidden = p.dataset.pane !== G.sbTab;
  for (const b of document.querySelectorAll('.sb-tool')) b.classList.toggle('is-active', b.dataset.tool === G.tool);
  const chips = (box, items, isOn, onTap, cls = () => '') => {
    box.innerHTML = '';
    for (const [val, label, title] of items) {
      const b = document.createElement('button');
      b.className = 'sb-chip ' + cls(val) + (isOn(val) ? ' is-active' : '');
      b.textContent = label;
      if (title) b.setAttribute('aria-label', title);
      b.addEventListener('click', () => { onTap(val); hudCache.sb = null; });
      box.appendChild(b);
    }
  };
  chips($('#sb-shapes'), SB_SHAPES.map(s => [s, SB_SHAPE_SIGN[s], s]), v => v === G.sbShape, v => { G.sbShape = v; setTool('build'); });
  chips($('#sb-tiers'), [['auto', 'Auto', 'Wie der Stadtteil'], ...TIERS.map(t => [t, TIER_INFO[t].badge || TIER_INFO[t].name, TIER_INFO[t].name])],
    v => v === G.sbTier, v => { G.sbTier = v; setTool('build'); }, v => 't-' + v + (v === 'auto' || v === 'bus' ? ' wide' : ''));
  chips($('#sb-demand'), SB_DEMAND.map(([v, l]) => [v, l]), v => v === G.sbDemand, v => { G.sbDemand = v; }, () => 'wide');
  const evBox = $('#sb-events');
  evBox.innerHTML = '';
  for (const ev of EVENTS) {
    const b = document.createElement('button');
    b.className = 'sb-act' + (G.tool === 'event' && G.sbEvent === ev.key ? ' is-active' : '');
    b.textContent = ev.name;
    b.addEventListener('click', () => { G.sbEvent = ev.key; setTool('event'); });
    evBox.appendChild(b);
  }
}

/** Statistik im Reiter „Stadt“ (nur neu schreiben, wenn sich etwas geändert hat) */
function updateSandboxStats() {
  const veh = G.trains.length;
  const waiting = G.stations.reduce((a, s) => a + s.queue.length, 0);
  const rows = [
    ['Fahrgäste befördert', G.score.toLocaleString('de-DE')],
    ['Stationen', G.stations.length],
    ['Linien', G.lines.length],
    ['Fahrzeuge', veh],
    ['Netzlänge', `${networkKm().toLocaleString('de-DE', { maximumFractionDigits: SC.key === 'europa' ? 0 : 1 })} km`],
    ['Warten gerade', waiting],
  ];
  const top = [...G.lines].sort((a, b) => (b.riders || 0) - (a.riders || 0)).slice(0, 3);
  const key = JSON.stringify(rows) + top.map(l => l.id + ':' + (l.riders || 0)).join();
  if (hudCache.sbStats === key) return;
  hudCache.sbStats = key;
  $('#sb-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const ol = $('#sb-top');
  ol.innerHTML = '';
  for (const l of top) {
    const li = document.createElement('li');
    li.innerHTML = `<i style="background:${LINE_COLORS[l.color]}"></i>`;
    li.append(`${l.label}: ${(l.riders || 0).toLocaleString('de-DE')} Fahrgäste`);
    ol.appendChild(li);
  }
}

for (const b of document.querySelectorAll('.sb-tool')) b.addEventListener('click', () => setTool(b.dataset.tool));
for (const b of document.querySelectorAll('.sb-tab')) b.addEventListener('click', () => {
  G.sbTab = b.dataset.tab;
  if (b.dataset.tab === 'build') setTool('build');
  else if (['build', 'event'].includes(G.tool) || (b.dataset.tab === 'city')) setTool('lines');
  hudCache.sb = null;
});
for (const b of document.querySelectorAll('.sb-act[data-act]')) b.addEventListener('click', () => { SB_ACTIONS[b.dataset.act](); hudCache.sb = null; });
$('#sb-back').addEventListener('click', () => setTool('lines'));
$('#sb-min').addEventListener('click', () => { G.sbMin = !G.sbMin; hudCache.sb = null; });

/** Höchste Stationsart, die die Linien an dieser Station brauchen */
function neededTier(st) {
  let r = 0;
  for (const l of G.lines) if (l.stations.includes(st.id)) r = Math.max(r, tierRank(MODES[l.mode].tier));
  return r;
}

/** Tippen/Ziehen mit einem Sandbox-Werkzeug. true = Berührung verbraucht. */
function sandboxTap(e, x, y) {
  const st = stationAt(x, y);
  const grab = () => {
    if (e.pointerType === 'pen') penActive = true;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* nicht kritisch */ }
    e.preventDefault();
    return true;
  };
  switch (G.tool) {
    case 'build': {
      if (st) { toast('Hier steht schon eine Station.'); return true; }
      // In der Nähe eines freien Stadtteils: dort einrasten und seinen Namen übernehmen
      let d = null, dBest = 1.8;
      for (const n of G.districtsLeft) {
        const c = HANNOVER.districts.find(q => q.name === n);
        const dd = c ? dist(c.x, c.y, x, y) : Infinity;
        if (dd < dBest && !G.stations.some(s => dist(s.x, s.y, c.x, c.y) < 1.4)) { dBest = dd; d = c; }
      }
      const px0 = d ? d.x : x, py0 = d ? d.y : y;
      if (G.stations.some(s => dist(s.x, s.y, px0, py0) < 1.4)) { toast('Zu nah an einer anderen Station.'); return true; }
      const tier = G.sbTier === 'auto' ? (d ? tierOfDistrict(d.name) : 'bus') : G.sbTier;
      const nst = addStation(G.sbShape, px0, py0, d ? d.name : '', tier);
      if (d) G.districtsLeft = G.districtsLeft.filter(n => n !== d.name);
      nst.flash = 0.35;
      rebuildRoutes();
      return true;
    }
    case 'tier': {
      if (!st) return false;
      if (st.shape === 'hub') { toast(`${SC.hubName} ist schon die größte Station.`); return true; }
      const need = neededTier(st);
      let k = tierRank(st.tier);
      do { k = (k + 1) % TIERS.length; } while (k < need);
      st.tier = TIERS[k];
      st.flash = 0.35;
      rebuildRoutes();
      toast(`${st.name || 'Station'}: jetzt ${TIER_INFO[st.tier].a} ${TIER_INFO[st.tier].name}.`);
      return true;
    }
    case 'shape': {
      if (!st) return false;
      if (st.shape === 'hub') { toast(`${SC.hubName} behält seine Form.`); return true; }
      st.shape = SB_SHAPES[(SB_SHAPES.indexOf(st.shape) + 1) % SB_SHAPES.length];
      st.queue = st.queue.filter(p => p !== st.shape);     // wer hierher wollte, ist schon da
      st.flash = 0.35;
      rebuildRoutes();
      return true;
    }
    case 'move': {
      if (!st) return false;
      drag = { mode: 'move', st, x, y, id: e.pointerId };
      return grab();
    }
    case 'name': {
      if (!st) return false;
      const name = window.prompt('Name der Station:', st.name || '');
      if (name !== null) { st.name = name.trim().slice(0, 24); st.flash = 0.35; }
      return true;
    }
    case 'node': {
      if (!st) return false;
      st.node = !st.node;
      st.flash = 0.35;
      toast(st.node ? `${st.name || 'Station'}: Umsteigeknoten – Umsteigen geht hier schneller.` : `${st.name || 'Station'}: kein Umsteigeknoten mehr.`);
      return true;
    }
    case 'big': {
      if (!st) return false;
      if (st.shape === 'hub') { toast(`${SC.hubName} ist schon groß.`); return true; }
      st.big = !st.big;
      st.flash = 0.35;
      toast(st.big ? `${st.name || 'Station'}: großer Bahnhof – mehr Platz zum Warten.` : `${st.name || 'Station'}: wieder normal groß.`);
      return true;
    }
    case 'event': {
      if (!st) return false;
      const ev = EVENTS.find(q => q.key === G.sbEvent) || EVENTS[0];
      if (st.shape === 'hub') { toast('Ereignisse finden in der Stadt statt – wähle eine andere Station.'); return true; }
      G.event = { key: ev.key, stationId: st.id, end: G.t + dayLen() * CFG.eventDays };
      st.flash = 0.35;
      toast(`${ev.name} an ${st.name || 'dieser Station'}! Viele wollen jetzt dorthin – und danach alle gleichzeitig zurück.`, 3600);
      setTool('lines');
      return true;
    }
    case 'remove': {
      if (!st) return false;
      if (st.shape === 'hub') { toast(`${SC.hubName} kann nicht abgerissen werden.`); return true; }
      removeStation(st);
      return true;
    }
  }
  return false;
}

/** Station abreißen: aus allen Linien nehmen, zu kurze Linien löschen */
function removeStation(st) {
  for (const line of [...G.lines]) {
    if (!line.stations.includes(st.id)) continue;
    line.stations = line.stations.filter(id => id !== st.id);
    if (line.loop && line.stations.length < 3) line.loop = false;
    if (line.stations.length < 2) deleteLine(line);
  }
  G.stations = G.stations.filter(s => s !== st);
  for (const line of G.lines) syncTrains(line);
  if (st.name && HANNOVER.districts.some(d => d.name === st.name)) G.districtsLeft.push(st.name);
  if (G.event?.stationId === st.id) G.event = null;
  rebuildRoutes();
  autoAssignVehicles();
}

$('#btn-sandbox').addEventListener('click', () => {
  if (G.resumeState && !confirm('Sandbox starten? Dein gespeichertes Spiel wird dabei überschrieben.')) return;
  $('#screen-start').hidden = true;
  startSandbox(worldPref.get());
});

/* ---------- Paywall ----------
   Noch ohne echtes Bezahlen: Der Kauf-Knopf zeigt nur einen Hinweis,
   freigeschaltet wird mit Code. Gespeichert wird die Freischaltung auf dem Gerät.
   Hinweis: Im Browser lässt sich so eine Sperre nie wirklich absichern –
   der Code steht nur als Prüfsumme im Quelltext, nicht im Klartext. */
const UNLOCK_KEY = 'heftmetro.unlocked';
const CODE_HASH = 0x89d3c54a;   // Prüfsumme des Freischalt-Codes

function codeHash(str) {
  let h = 0x811c9dc5;                     // FNV-1a, 32 Bit
  for (const ch of str.trim().toUpperCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
function isUnlocked() {
  try { return localStorage.getItem(UNLOCK_KEY) === '1'; } catch { return false; }
}
function showPaywall(onDone) {
  G.state = 'start';
  const scr = $('#screen-paywall'), msg = $('#pay-msg'), input = $('#pay-input'), note = scr.querySelector('.pay-note');
  scr.hidden = false;
  $('#screen-start').hidden = true;
  const say = (text, cls) => { msg.textContent = text; msg.className = 'pay-msg ' + (cls || ''); };
  $('#pay-buy').onclick = () => say('Bezahlen kommt bald – nutze bis dahin einen Code.');
  $('#pay-form').onsubmit = e => {
    e.preventDefault();
    if (!input.value.trim()) { say('Bitte gib einen Code ein.', 'err'); return; }
    if (codeHash(input.value) === CODE_HASH) {
      try { localStorage.setItem(UNLOCK_KEY, '1'); } catch { /* privat-Modus: gilt nur jetzt */ }
      say('Freigeschaltet – viel Spaß!', 'ok');
      input.blur();
      setTimeout(() => { scr.hidden = true; onDone(); }, 700);
    } else {
      say('Dieser Code stimmt leider nicht.', 'err');
      note.classList.remove('shake'); void note.offsetWidth; note.classList.add('shake');
      input.select();
    }
  };
}

runSplash();
const saved = loadSave();
if (saved) restoreGame(saved); else newGame(worldPref.get());
if (isUnlocked()) showStart(saved); else showPaywall(() => showStart(saved));
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
  openShop,
  showBalance,
  showFocus,
  updateEvent,
  get cam() { return cam; },
  get HANNOVER() { return HANNOVER; },
  get SC() { return SC; },
  applyScenario,
  addStation,
  tierOfDistrict,
  rebuildRoutes,
};
