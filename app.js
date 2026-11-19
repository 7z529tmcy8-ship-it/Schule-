/* =====================================================================
   Chronothek – Uhrensammel-Spiel mit Spielgeld.
   Seiten: Start, Marktplatz, Angebot, Modell, Auktionen, Sammlung,
   Merkliste, Profil. Alles läuft lokal, Spielstand in localStorage.
   ===================================================================== */
'use strict';

const SAVE_KEY = 'chronothek.v1';
const DAY_MS = 30000;          // ein Markttag dauert 30 Sekunden
const MAX_CATCHUP = 40;        // höchstens so viele Tage nachholen, wenn die App zu war
const HISTORY = 90;            // Kursverlauf in Tagen
const START_MONEY = 3000;
const FEE_SELL = 0.06;         // Verkaufsgebühr Marktplatz
const DEALER = 0.8;            // Sofortverkauf an Händler
const PREMIUM = 0.05;          // Aufgeld bei Auktionen
const LISTINGS = 60;           // mehr Angebote auf dem Markt
const AUCTIONS = 6;

/* ---------- Zustände ---------- */
const COND = [
  { name: 'Ungetragen', f: 1.08, color: 'green' },
  { name: 'Sehr gut', f: 1.0, color: 'blue' },
  { name: 'Gut', f: 0.9, color: 'light' },
  { name: 'Getragen', f: 0.8, color: 'light' },
  { name: 'Revisionsbedürftig', f: 0.62, color: 'red' },
];
const NO_PAPERS = 0.88;

/* ---------- Uhren (Preise = grobe Schätzung Gebrauchtmarkt, Sehr gut, mit Papieren) ----------
   look: s = Form, d = Zifferblatt, b = Lünette, m = Metall, st = Band,
         c = Chronograph, dt = Datum, dive = Taucherlünette, dig = Digital … */
const MODELS = [
  ['casio-f91w', 'Casio', 'F-91W', 'F-91W-1YEG', 18, 'Einsteiger', 35, 'Harz', 1989, { s: 'digital', m: 'black', st: 'ru' }],
  ['casio-dw5600', 'Casio', 'G-Shock DW-5600E', 'DW-5600E-1VER', 95, 'Sport', 48, 'Harz', 1996, { s: 'gshock', m: 'black', st: 'ru' }],
  ['swatch-moonswatch', 'Swatch', 'MoonSwatch Mission to the Moon', 'SO33M100', 290, 'Chronograph', 42, 'Bioceramic', 2022, { d: '#16191f', m: 'gray', c: 1, tachy: 1, b: '#16191f', st: 'ru' }],
  ['seiko-5', 'Seiko', '5 Sports', 'SRPD55K1', 260, 'Sport', 42.5, 'Edelstahl', 2019, { d: '#1d2b47', b: '#1d2b47', m: 'steel', st: 'br', dt: 1, dive: 1 }],
  ['hamilton-khaki', 'Hamilton', 'Khaki Field Mechanical', 'H69439931', 430, 'Feld', 38, 'Edelstahl', 2018, { d: '#1d1d1d', m: 'steel', st: 'nato', nums: 1 }],
  ['tissot-prx', 'Tissot', 'PRX Powermatic 80', 'T137.407.11.041.00', 520, 'Sport', 40, 'Edelstahl', 2021, { s: 'tv', d: '#1f3d75', m: 'steel', st: 'int', dt: 1, tap: 1 }],
  ['seiko-spb143', 'Seiko', 'Prospex SPB143J1', 'SPB143J1', 850, 'Taucher', 40.5, 'Edelstahl', 2020, { d: '#2b2b2b', b: '#151515', m: 'steel', st: 'br', dive: 1, dt: 1 }],
  ['sinn-556', 'Sinn', '556 I', '556.010', 1350, 'Fliegeruhr', 38.5, 'Edelstahl', 2005, { d: '#141414', m: 'steel', st: 'le', nums: 1 }],
  ['oris-aquis', 'Oris', 'Aquis Date', '01 733 7766 4135', 1750, 'Taucher', 41.5, 'Edelstahl', 2017, { d: '#163d68', b: '#163d68', m: 'steel', st: 'br', dive: 1, dt: 1 }],
  ['nomos-tangente', 'Nomos Glashütte', 'Tangente 38', '164', 1850, 'Dress', 37.5, 'Edelstahl', 1992, { d: '#f3f0e8', m: 'steel', st: 'le', nums: 1, thin: 1 }],
  ['longines-spirit', 'Longines', 'Spirit 40', 'L3.810.4.53.6', 2300, 'Fliegeruhr', 40, 'Edelstahl', 2020, { d: '#1a1a1a', m: 'steel', st: 'br', dt: 1, nums: 1 }],
  ['cartier-tank-must', 'Cartier', 'Tank Must', 'WSTA0041', 2900, 'Dress', 33.7, 'Edelstahl', 2021, { s: 'tank', d: '#f6f3ec', m: 'steel', st: 'le', roman: 1, strap: '#151515' }],
  ['tudor-bb58', 'Tudor', 'Black Bay 58', 'M79030N-0001', 3300, 'Taucher', 39, 'Edelstahl', 2018, { d: '#131313', b: '#131313', m: 'steel', st: 'br', dive: 1, gilt: 1 }],
  ['tudor-pelagos', 'Tudor', 'Pelagos 39', 'M25407N-0001', 4300, 'Taucher', 39, 'Titan', 2022, { d: '#161616', b: '#161616', m: 'titan', st: 'br', dive: 1 }],
  ['tag-carrera', 'TAG Heuer', 'Carrera Chronograph', 'CBN2A1B.BA0643', 4600, 'Chronograph', 44, 'Edelstahl', 2020, { d: '#151515', m: 'steel', st: 'br', c: 1, dt: 1 }],
  ['omega-seamaster', 'Omega', 'Seamaster Diver 300M', '210.30.42.20.03.001', 4800, 'Taucher', 42, 'Edelstahl', 2018, { d: '#1a3f7a', b: '#1a3f7a', m: 'steel', st: 'br', dive: 1, wave: 1, dt: 1 }],
  ['tag-monaco', 'TAG Heuer', 'Monaco', 'CBL2111.FC6453', 5100, 'Chronograph', 39, 'Edelstahl', 2019, { s: 'square', d: '#1f52a6', m: 'steel', st: 'le', c: 1, strap: '#1b1b1b' }],
  ['omega-aquaterra', 'Omega', 'Seamaster Aqua Terra 150M', '220.10.41.21.03.004', 5100, 'Sport', 41, 'Edelstahl', 2017, { d: '#2c4d80', m: 'steel', st: 'br', dt: 1, teak: 1 }],
  ['gs-snowflake', 'Grand Seiko', 'Snowflake', 'SBGA211', 5200, 'Dress', 41, 'Titan', 2017, { d: '#eef1f4', m: 'titan', st: 'br', dt: 1, snow: 1 }],
  ['omega-speedmaster', 'Omega', 'Speedmaster Moonwatch Professional', '310.30.42.50.01.002', 6300, 'Chronograph', 42, 'Edelstahl', 2021, { d: '#111', b: '#111', m: 'steel', st: 'br', c: 1, tachy: 1 }],
  ['panerai-luminor', 'Panerai', 'Luminor Marina', 'PAM01312', 6300, 'Sport', 44, 'Edelstahl', 2018, { s: 'cushion', d: '#1a1a1a', m: 'steel', st: 'le', guard: 1, nums: 1, strap: '#5a3a20' }],
  ['breitling-navitimer', 'Breitling', 'Navitimer B01 Chronograph 43', 'AB0138211B1A1', 6900, 'Fliegeruhr', 43, 'Edelstahl', 2022, { d: '#111', m: 'steel', st: 'le', c: 1, slide: 1, strap: '#1a1a1a' }],
  ['cartier-santos', 'Cartier', 'Santos de Cartier Large', 'WSSA0018', 7200, 'Sport', 39.8, 'Edelstahl', 2018, { s: 'santos', d: '#f3f1ea', m: 'steel', st: 'br', roman: 1 }],
  ['iwc-portugieser', 'IWC', 'Portugieser Chronograph', 'IW371605', 7200, 'Chronograph', 41, 'Edelstahl', 2020, { d: '#f5f4f0', m: 'steel', st: 'le', c: 2, nums: 1, strap: '#2a2a2a' }],
  ['jlc-reverso', 'Jaeger-LeCoultre', 'Reverso Classic Large Small Seconds', 'Q3858520', 7400, 'Dress', 45.6, 'Edelstahl', 2016, { s: 'reverso', d: '#efede6', m: 'steel', st: 'le', nums: 1, strap: '#3a2414' }],
  ['rolex-op41', 'Rolex', 'Oyster Perpetual 41', '124300', 7800, 'Sport', 41, 'Edelstahl', 2020, { d: '#2f6dc6', m: 'steel', st: 'br' }],
  ['rolex-explorer', 'Rolex', 'Explorer 40', '224270', 8500, 'Sport', 40, 'Edelstahl', 2023, { d: '#111', m: 'steel', st: 'br', ex: 1 }],
  ['iwc-bigpilot', 'IWC', 'Big Pilot’s Watch 43', 'IW329301', 8700, 'Fliegeruhr', 43, 'Edelstahl', 2021, { d: '#121212', m: 'steel', st: 'le', nums: 1, strap: '#4a3020' }],
  ['rolex-sub-nd', 'Rolex', 'Submariner (ohne Datum)', '124060', 11000, 'Taucher', 41, 'Edelstahl', 2020, { d: '#111', b: '#111', m: 'steel', st: 'br', dive: 1 }],
  ['zenith-chronomaster', 'Zenith', 'Chronomaster Sport', '03.3100.3600/69.M3100', 11500, 'Chronograph', 41, 'Edelstahl', 2021, { d: '#f2f2f2', b: '#111', m: 'steel', st: 'br', c: 1, tri: 1 }],
  ['rolex-datejust', 'Rolex', 'Datejust 41', '126334', 12500, 'Dress', 41, 'Edelstahl / Weißgold', 2017, { d: '#5c7090', m: 'steel', st: 'jub', dt: 1, flute: 1 }],
  ['rolex-sub', 'Rolex', 'Submariner Date', '126610LN', 13500, 'Taucher', 41, 'Edelstahl', 2020, { d: '#111', b: '#111', m: 'steel', st: 'br', dive: 1, dt: 1 }],
  ['rolex-gmt-batman', 'Rolex', 'GMT-Master II „Batman“', '126710BLNR', 18500, 'GMT', 40, 'Edelstahl', 2019, { d: '#111', bz: ['#151515', '#1d3c8f'], m: 'steel', st: 'jub', gmt: 1, dt: 1 }],
  ['rolex-gmt-pepsi', 'Rolex', 'GMT-Master II „Pepsi“', '126710BLRO', 20500, 'GMT', 40, 'Edelstahl', 2018, { d: '#111', bz: ['#b5262c', '#1d3c8f'], m: 'steel', st: 'jub', gmt: 1, dt: 1 }],
  ['rolex-daytona', 'Rolex', 'Cosmograph Daytona', '126500LN', 29000, 'Chronograph', 40, 'Edelstahl', 2023, { d: '#f4f4f4', b: '#111', m: 'steel', st: 'br', c: 1, tachy: 1, sub: '#111' }],
  ['vc-overseas', 'Vacheron Constantin', 'Overseas', '4500V/110A-B128', 31000, 'Sport', 41, 'Edelstahl', 2016, { d: '#2a4f8f', m: 'steel', st: 'br', dt: 1, maltese: 1 }],
  ['patek-calatrava', 'Patek Philippe', 'Calatrava', '5227G-010', 32000, 'Dress', 39, 'Weißgold', 2013, { d: '#f1ede2', m: 'white', st: 'le', dt: 1, thin: 1, strap: '#1a1a1a' }],
  ['ap-roo', 'Audemars Piguet', 'Royal Oak Offshore Chronograph', '26470ST.OO.A027CA.01', 32000, 'Chronograph', 42, 'Edelstahl', 2014, { s: 'octagon', d: '#222', m: 'steel', st: 'ru', c: 1, tap: 1 }],
  ['lange-1', 'A. Lange & Söhne', 'Lange 1', '191.032', 34000, 'Dress', 38.5, 'Roségold', 2015, { d: '#ece6da', m: 'rose', st: 'le', lange: 1, strap: '#3a2414' }],
  ['rolex-daydate', 'Rolex', 'Day-Date 40', '228238', 39000, 'Dress', 40, 'Gelbgold', 2015, { d: '#c9a44e', m: 'gold', st: 'br', dt: 1, flute: 1, day: 1 }],
  ['ap-ro', 'Audemars Piguet', 'Royal Oak Selfwinding 41', '15500ST.OO.1220ST.01', 46000, 'Sport', 41, 'Edelstahl', 2019, { s: 'octagon', d: '#1c2c50', m: 'steel', st: 'int', dt: 1, tap: 1 }],
  ['patek-aquanaut', 'Patek Philippe', 'Aquanaut', '5167A-001', 58000, 'Sport', 40, 'Edelstahl', 2007, { s: 'cushion', d: '#2a2a2a', m: 'steel', st: 'ru', dt: 1, tap: 1 }],
  ['patek-nautilus', 'Patek Philippe', 'Nautilus', '5711/1A-010', 115000, 'Sport', 40, 'Edelstahl', 2006, { s: 'nautilus', d: '#1f3a66', m: 'steel', st: 'int', dt: 1, lines: 1 }],
  ['rm-011', 'Richard Mille', 'RM 011 Felipe Massa', 'RM 011', 190000, 'Chronograph', 50, 'Titan', 2007, { s: 'tonneau', d: '#202020', m: 'titan', st: 'ru', c: 1, skel: 1 }],
  ['casio-ae1200', 'Casio', 'AE-1200WH „Royale“', 'AE-1200WH-1AVEF', 32, 'Einsteiger', 42, 'Harz', 2011, { s: 'digital', m: 'gray', st: 'br' }],
  ['casio-ga2100', 'Casio', 'G-Shock GA-2100 „CasiOak“', 'GA-2100-1A1ER', 105, 'Sport', 45.4, 'Harz', 2019, { s: 'octagon', d: '#141414', m: 'black', st: 'ru', tap: 0 }],
  ['timex-marlin', 'Timex', 'Marlin Hand-Wound', 'TW2R47900', 210, 'Dress', 34, 'Edelstahl', 2017, { d: '#efe9dc', m: 'steel', st: 'le', nums: 1, strap: '#3a2414' }],
  ['orient-bambino', 'Orient', 'Bambino Version 2', 'FAC00009N0', 150, 'Dress', 40.5, 'Edelstahl', 2014, { d: '#f2efe6', m: 'gold', st: 'le', roman: 1, strap: '#3a2414' }],
  ['seiko-presage', 'Seiko', 'Presage Cocktail Time', 'SRPB43J1', 380, 'Dress', 40.5, 'Edelstahl', 2017, { d: '#5ea0c8', m: 'steel', st: 'le', dt: 1, strap: '#1b1b1b' }],
  ['citizen-promaster', 'Citizen', 'Promaster Diver Eco-Drive', 'BN0150-28E', 190, 'Taucher', 44, 'Edelstahl', 2014, { d: '#151515', b: '#151515', m: 'steel', st: 'ru', dive: 1, dt: 1 }],
  ['junghans-maxbill', 'Junghans', 'max bill Automatic', '027/4700.02', 820, 'Dress', 38, 'Edelstahl', 2014, { d: '#f4f2ec', m: 'steel', st: 'le', nums: 1, thin: 1, strap: '#2a2a2a' }],
  ['mido-ocean', 'Mido', 'Ocean Star 200', 'M026.430.11.041.00', 690, 'Taucher', 42.5, 'Edelstahl', 2019, { d: '#1d3e70', b: '#1d3e70', m: 'steel', st: 'br', dive: 1, dt: 1 }],
  ['tissot-seastar', 'Tissot', 'Seastar 1000 Powermatic 80', 'T120.407.11.041.03', 560, 'Taucher', 43, 'Edelstahl', 2020, { d: '#0f2a52', b: '#0f2a52', m: 'steel', st: 'br', dive: 1, dt: 1, wave: 1 }],
  ['hamilton-jazz', 'Hamilton', 'Jazzmaster Open Heart', 'H32705141', 640, 'Dress', 40, 'Edelstahl', 2016, { d: '#f1f1f1', m: 'steel', st: 'br', nums: 1 }],
  ['laco-pilot', 'Laco', 'Flieger Augsburg 42', '861688', 340, 'Fliegeruhr', 42, 'Edelstahl', 2018, { d: '#151515', m: 'gray', st: 'le', nums: 1, strap: '#4a3020' }],
  ['stowa-flieger', 'Stowa', 'Flieger Classic 40', 'FK40', 820, 'Fliegeruhr', 40, 'Edelstahl', 2010, { d: '#141414', m: 'steel', st: 'le', nums: 1, strap: '#5a3a20' }],
  ['frederique-slim', 'Frederique Constant', 'Slimline Moonphase', 'FC-705S4S6', 1150, 'Dress', 42, 'Edelstahl', 2015, { d: '#f4f2ec', m: 'steel', st: 'le', roman: 1, thin: 1, strap: '#1b1b1b' }],
  ['tudor-ranger', 'Tudor', 'Ranger', 'M79950-0001', 2400, 'Feld', 39, 'Edelstahl', 2022, { d: '#151515', m: 'steel', st: 'br', nums: 1, gilt: 1 }],
  ['tudor-bb-gmt', 'Tudor', 'Black Bay GMT „Pepsi“', 'M79830RB-0001', 3400, 'GMT', 41, 'Edelstahl', 2018, { d: '#131313', bz: ['#9e2a2b', '#1d2f5c'], m: 'steel', st: 'br', gmt: 1, dt: 1, gilt: 1 }],
  ['breitling-superocean', 'Breitling', 'Superocean Heritage 42', 'AB2010121B1A1', 3700, 'Taucher', 42, 'Edelstahl', 2017, { d: '#141414', b: '#141414', m: 'steel', st: 'br', dive: 1 }],
  ['longines-legend', 'Longines', 'Legend Diver', 'L3.774.4.50.0', 2200, 'Taucher', 42, 'Edelstahl', 2016, { d: '#1b1b1b', m: 'steel', st: 'le', dt: 1, nums: 1, strap: '#2a2a2a' }],
  ['oris-bigcrown', 'Oris', 'Big Crown Pointer Date', '01 754 7741 4065', 1500, 'Fliegeruhr', 40, 'Bronze', 2018, { d: '#2a4a3a', m: 'rose', st: 'le', nums: 1, strap: '#5a3a20' }],
  ['sinn-104', 'Sinn', '104 St Sa I', '104.010', 1600, 'Fliegeruhr', 41, 'Edelstahl', 2014, { d: '#121212', b: '#121212', m: 'steel', st: 'br', nums: 1, dive: 1, dt: 1 }],
  ['nomos-club', 'Nomos Glashütte', 'Club Campus', '708', 1300, 'Sport', 38.5, 'Edelstahl', 2018, { d: '#e9eef4', m: 'steel', st: 'le', nums: 1, strap: '#2a2a2a' }],
  ['omega-constellation', 'Omega', 'Constellation 41', '131.10.41.21.06.001', 4700, 'Dress', 41, 'Edelstahl', 2020, { d: '#555', m: 'steel', st: 'br', dt: 1, roman: 1 }],
  ['omega-railmaster', 'Omega', 'Seamaster Railmaster', '220.10.40.20.01.001', 4000, 'Feld', 40, 'Edelstahl', 2017, { d: '#222', m: 'steel', st: 'br', nums: 1 }],
  ['cartier-ballon', 'Cartier', 'Ballon Bleu 40', 'WSBB0040', 5600, 'Dress', 40, 'Edelstahl', 2019, { d: '#efede6', m: 'steel', st: 'br', roman: 1 }],
  ['iwc-mark', 'IWC', 'Pilot’s Watch Mark XX', 'IW328201', 4600, 'Fliegeruhr', 40, 'Edelstahl', 2022, { d: '#1b2b4d', m: 'steel', st: 'le', nums: 1, dt: 1, strap: '#1b1b1b' }],
  ['gs-spring', 'Grand Seiko', 'Spring Drive GMT „Shunbun“', 'SBGE269', 6200, 'GMT', 44, 'Edelstahl', 2020, { d: '#e8d6dc', m: 'steel', st: 'br', gmt: 1, dt: 1 }],
  ['panerai-radiomir', 'Panerai', 'Radiomir', 'PAM01384', 5400, 'Dress', 45, 'Edelstahl', 2021, { s: 'cushion', d: '#2b2a24', m: 'steel', st: 'le', nums: 1, strap: '#5a3a20' }],
  ['breitling-chronomat', 'Breitling', 'Chronomat B01 42', 'AB0134101B1A1', 6800, 'Chronograph', 42, 'Edelstahl', 2020, { d: '#141414', b: '#ddd', m: 'steel', st: 'br', c: 1, dt: 1 }],
  ['hublot-bigbang', 'Hublot', 'Big Bang Unico', '441.NX.1170.RX', 13500, 'Chronograph', 42, 'Titan', 2015, { d: '#202020', m: 'titan', st: 'ru', c: 1, skel: 1 }],
  ['rolex-airking', 'Rolex', 'Air-King', '126900', 8200, 'Fliegeruhr', 40, 'Edelstahl', 2022, { d: '#111', m: 'steel', st: 'br', nums: 1 }],
  ['rolex-explorer2', 'Rolex', 'Explorer II', '226570', 10500, 'GMT', 42, 'Edelstahl', 2021, { d: '#f4f4f4', m: 'steel', st: 'br', gmt: 1, dt: 1 }],
  ['rolex-yachtmaster', 'Rolex', 'Yacht-Master 40', '126622', 13000, 'Sport', 40, 'Edelstahl / Platin', 2019, { d: '#4a4d52', b: '#cfd3d8', m: 'steel', st: 'br', dt: 1 }],
  ['rolex-seadweller', 'Rolex', 'Sea-Dweller', '126600', 13500, 'Taucher', 43, 'Edelstahl', 2017, { d: '#111', b: '#111', m: 'steel', st: 'br', dive: 1, dt: 1 }],
  ['rolex-gmt-sprite', 'Rolex', 'GMT-Master II „Sprite“', '126720VTNR', 19500, 'GMT', 40, 'Edelstahl', 2022, { d: '#111', bz: ['#151515', '#1f6b3a'], m: 'steel', st: 'jub', gmt: 1, dt: 1 }],
  ['blancpain-ff', 'Blancpain', 'Fifty Fathoms Bathyscaphe', '5000-1110-B52A', 8900, 'Taucher', 43, 'Edelstahl', 2013, { d: '#222', b: '#222', m: 'steel', st: 'le', dive: 1, dt: 1, strap: '#1b1b1b' }],
  ['jlc-polaris', 'Jaeger-LeCoultre', 'Polaris Date', 'Q9068681', 8600, 'Taucher', 42, 'Edelstahl', 2018, { d: '#1d2e52', m: 'steel', st: 'ru', dt: 1, nums: 1 }],
  ['chopard-alpine', 'Chopard', 'Alpine Eagle 41', '298600-3001', 13000, 'Sport', 41, 'Lucent Steel', 2019, { d: '#2c4f80', m: 'steel', st: 'int', dt: 1 }],
  ['bell-ross-br03', 'Bell & Ross', 'BR 03-92 Black Matte', 'BR0392-BL-CE', 2600, 'Fliegeruhr', 42, 'Keramik', 2014, { s: 'square', d: '#111', m: 'black', st: 'ru', nums: 1 }],
  ['ap-code', 'Audemars Piguet', 'Code 11.59 Selfwinding', '15210ST.OO.A002KB.01', 22000, 'Dress', 41, 'Edelstahl', 2019, { d: '#1b2b4d', m: 'steel', st: 'le', dt: 1, strap: '#1b1b1b' }],
  ['vc-fiftysix', 'Vacheron Constantin', 'Fiftysix Self-Winding', '4600E/000A-B442', 12000, 'Dress', 40, 'Edelstahl', 2018, { d: '#f1ede2', m: 'steel', st: 'le', nums: 1, maltese: 1, strap: '#3a2414' }],
  ['patek-nautilus-chrono', 'Patek Philippe', 'Nautilus Chronograph', '5980/1A-001', 140000, 'Chronograph', 40.5, 'Edelstahl', 2006, { s: 'nautilus', d: '#1b2e4f', m: 'steel', st: 'int', c: 1, lines: 1 }],
  ['patek-worldtime', 'Patek Philippe', 'World Time', '5230G-001', 52000, 'GMT', 38.5, 'Weißgold', 2016, { d: '#2a3a5c', m: 'white', st: 'le', gmt: 1, strap: '#1a1a1a' }],
  ['lange-datograph', 'A. Lange & Söhne', 'Datograph Up/Down', '405.035', 72000, 'Chronograph', 41, 'Platin', 2012, { d: '#151515', m: 'white', st: 'le', c: 2, lange: 1, strap: '#1a1a1a' }],
  ['rolex-daytona-panda-gold', 'Rolex', 'Cosmograph Daytona Gelbgold', '126518LN', 42000, 'Chronograph', 40, 'Gelbgold', 2023, { d: '#111', b: '#111', m: 'gold', st: 'ru', c: 1, tachy: 1, sub: '#c9a44e' }],
  ['ap-ro-jumbo', 'Audemars Piguet', 'Royal Oak „Jumbo“ Extra-Thin', '16202ST.OO.1240ST.01', 120000, 'Sport', 39, 'Edelstahl', 2022, { s: 'octagon', d: '#1e3054', m: 'steel', st: 'int', tap: 1, thin: 1 }],
  ['rm-035', 'Richard Mille', 'RM 035 Rafael Nadal', 'RM 035', 260000, 'Sport', 49, 'Carbon TPT', 2011, { s: 'tonneau', d: '#202020', m: 'black', st: 'ru', skel: 1 }],
  ['fpj-chronometre', 'F. P. Journe', 'Chronomètre Bleu', 'CB', 160000, 'Dress', 39, 'Tantal', 2009, { d: '#1d3c78', m: 'gray', st: 'le', nums: 1, strap: '#1a1a1a' }],
].map(([id, brand, name, ref, price, cat, diam, material, year, look]) => ({ id, brand, name, ref, price, cat, diam, material, year, look }));
const MODEL = Object.fromEntries(MODELS.map(m => [m.id, m]));
const BRANDS = [...new Set(MODELS.map(m => m.brand))].sort((a, b) => a.localeCompare(b, 'de'));
const CATS = [...new Set(MODELS.map(m => m.cat))].sort((a, b) => a.localeCompare(b, 'de'));

// Schwankung und Trend pro Tag
function volOf(m) {
  if (m.price < 300) return 0.006;
  if (['Rolex', 'Patek Philippe', 'Audemars Piguet', 'Richard Mille'].includes(m.brand)) return 0.016;
  return 0.011;
}
function trendOf(m) {
  if (m.id === 'patek-nautilus' || m.id === 'rm-011') return 0.0012;
  if (m.brand === 'Rolex') return 0.0007;
  if (['Patek Philippe', 'Audemars Piguet', 'Vacheron Constantin', 'A. Lange & Söhne'].includes(m.brand)) return 0.0006;
  if (['TAG Heuer', 'Breitling', 'Swatch'].includes(m.brand)) return -0.0003;
  return 0.0002;
}

/* ---------- Fiktive Händler ---------- */
const SELLERS = [
  ['Uhrenhaus Lindner', 'München', 1], ['Zeitwerk Rheinland', 'Köln', 1], ['Atelier Brunner', 'Wien', 1],
  ['Haus der Zeit', 'Hamburg', 1], ['Kronen-Uhren', 'Zürich', 1], ['Tick & Tack', 'Berlin', 1],
  ['Chrono Antik', 'Frankfurt', 1], ['Unruh & Co.', 'Dresden', 1],
  ['Privat', 'Stuttgart', 0], ['Privat', 'Hannover', 0], ['Privat', 'Leipzig', 0], ['Privat', 'Düsseldorf', 0],
  ['Privat', 'Salzburg', 0], ['Privat', 'Bremen', 0], ['Privat', 'Nürnberg', 0],
];

/* ---------- Stufen & Erfolge ---------- */
const LEVELS = [
  { name: 'Einsteiger', min: 0 },
  { name: 'Sammler', min: 5000 },
  { name: 'Kenner', min: 25000 },
  { name: 'Connaisseur', min: 100000 },
  { name: 'Grand Collector', min: 500000 },
  { name: 'Legende', min: 2000000 },
];
const ACHIEVEMENTS = [
  { id: 'first', icon: '⌚', name: 'Erste Uhr', desc: 'Kaufe deine erste Uhr.', reward: 100, test: s => s.stats.bought >= 1 },
  { id: 'five', icon: '🗃', name: 'Kleine Box', desc: 'Besitze 5 Uhren gleichzeitig.', reward: 300, test: s => s.owned.length >= 5 },
  { id: 'brands3', icon: '🎨', name: 'Vielfalt', desc: 'Uhren von 3 Marken gleichzeitig.', reward: 300, test: s => new Set(s.owned.map(o => MODEL[o.m].brand)).size >= 3 },
  { id: 'bargain', icon: '🔎', name: 'Schnäppchenjäger', desc: 'Kaufe 15 % unter Marktwert.', reward: 250, test: s => s.stats.bestDeal >= 0.15 },
  { id: 'offer', icon: '🤝', name: 'Verhandlungsprofi', desc: 'Ein Preisvorschlag wird angenommen.', reward: 200, test: s => s.stats.offers >= 1 },
  { id: 'auction', icon: '🔨', name: 'Zuschlag!', desc: 'Gewinne eine Auktion.', reward: 400, test: s => s.stats.auctions >= 1 },
  { id: 'flip', icon: '📈', name: 'Guter Riecher', desc: 'Verkaufe eine Uhr mit 1.000 € Gewinn.', reward: 500, test: s => s.stats.bestFlip >= 1000 },
  { id: 'service', icon: '🔧', name: 'Uhrmacher', desc: 'Lass eine Uhr revidieren.', reward: 150, test: s => s.stats.services >= 1 },
  { id: 'rolex', icon: '👑', name: 'Krone', desc: 'Besitze eine Rolex.', reward: 1000, test: s => s.owned.some(o => MODEL[o.m].brand === 'Rolex') },
  { id: 'trinity', icon: '🏛', name: 'Heilige Dreifaltigkeit', desc: 'Patek Philippe, Audemars Piguet und Vacheron Constantin gleichzeitig.', reward: 25000, test: s => ['Patek Philippe', 'Audemars Piguet', 'Vacheron Constantin'].every(b => s.owned.some(o => MODEL[o.m].brand === b)) },
  { id: 'hundredk', icon: '💎', name: 'Sechsstellig', desc: 'Sammlungswert über 100.000 €.', reward: 5000, test: s => collectionValue(s) >= 100000 },
  { id: 'flash', icon: '⚡', name: 'Blitzmerker', desc: 'Schnapp dir einen Blitz-Deal.', reward: 500, test: s => s.stats.flash >= 1 },
  { id: 'caught', icon: '🕵', name: 'Fälschung entlarvt', desc: 'Die Echtheitsprüfung findet eine Fälschung.', reward: 300, test: s => s.stats.fakesCaught >= 1 },
  { id: 'botboss', icon: '🤖', name: 'Bot-Boss', desc: 'Dein Bot macht 10.000 € netto.', reward: 2000, test: s => s.bot && s.bot.gross - s.bot.losses - s.bot.fees >= 10000 },
  { id: 'podium', icon: '🥉', name: 'Podium', desc: 'Platz 3 in der Rangliste.', reward: 20000, test: s => s.rivals && rankOf(s) <= 3 },
  { id: 'top1', icon: '🥇', name: 'Nummer 1', desc: 'Platz 1 in der Rangliste.', reward: 250000, test: s => s.rivals && rankOf(s) === 1 },
  { id: 'shop', icon: '🏪', name: 'Ladenbesitzer', desc: 'Eröffne deinen eigenen Uhrenladen.', reward: 1000, test: s => !!s.shop },
  { id: 'shop10', icon: '🛍', name: 'Stammkundschaft', desc: '10 Verkäufe im eigenen Laden.', reward: 3000, test: s => s.shop && s.shop.sales >= 10 },
  { id: 'stars', icon: '⭐', name: 'Fünf Sterne', desc: 'Bewertung ab 4,5 bei 10 Bewertungen.', reward: 5000, test: s => s.shop && s.shop.reviews.length >= 10 && s.shop.reviews.reduce((a, b) => a + b.s, 0) / s.shop.reviews.length >= 4.5 },
  { id: 'luxus', icon: '💎', name: 'Luxusmeile', desc: 'Laden in bester Lage.', reward: 20000, test: s => s.shop && s.shop.up.loc >= 3 },
  { id: 'million', icon: '🏆', name: 'Uhren-Millionär', desc: 'Gesamtvermögen über 1 Mio. €.', reward: 50000, test: s => netWorth(s) >= 1e6 },
];

const NEWS = [
  { t: 'brand', up: [0.04, 0.08], text: (m) => `${m.brand} erhöht die Listenpreise – gebrauchte Modelle ziehen nach.` },
  { t: 'model', up: [0.08, 0.15], text: (m) => `Hype um die ${m.brand} ${m.name}: Ein Star zeigt sie in den sozialen Medien.` },
  { t: 'model', up: [0.1, 0.18], text: (m) => `Gerücht: ${m.brand} stellt die ${m.name} bald ein. Sammler kaufen.` },
  { t: 'model', up: [-0.12, -0.06], text: (m) => `Viele ${m.brand} ${m.name} im Angebot – die Preise geben nach.` },
  { t: 'brand', up: [0.03, 0.06], text: (m) => `Uhrenmesse in Genf: Neuheiten von ${m.brand} begeistern.` },
  { t: 'brand', up: [-0.07, -0.03], text: (m) => `${m.brand} bringt eine neue Generation – die Vorgänger werden günstiger.` },
  { t: 'all', up: [-0.04, -0.02], text: () => 'Zinsen steigen – der Markt für Luxusuhren kühlt ab.' },
  { t: 'all', up: [0.02, 0.04], text: () => 'Rekordauktion in Genf: Sammler sind in Kauflaune.' },
];

/* ---------- Rangliste: andere (ausgedachte) Sammler ---------- */
const RIVALS = [
  ['Max K.', 2500, 0.004], ['Uhren-Lisa', 9000, 0.006], ['watchfreak92', 22000, 0.007],
  ['Sammler Henrik', 60000, 0.006], ['Dr. Brenner', 160000, 0.005], ['Gräfin von Tick', 420000, 0.005],
  ['Mr. Tourbillon', 1300000, 0.004], ['Sultan of Time', 6000000, 0.003],
];
function newRivals() { return RIVALS.map(([n, w, g]) => ({ n, w, g })); }
function rankOf(s) { const me = netWorth(s); return 1 + s.rivals.filter(r => r.w > me).length; }

/* ---------- Hilfen ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtEur = (v, dec = 0) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(v);
const fmtPct = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %';
const niceRound = v => v >= 10000 ? Math.round(v / 100) * 100 : v >= 1000 ? Math.round(v / 50) * 50 : v >= 100 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v));
const todayStr = () => new Date().toISOString().slice(0, 10);
let uidCounter = 0;
const uid = p => p + Date.now().toString(36) + (uidCounter++).toString(36) + Math.random().toString(36).slice(2, 5);

/* ---------- Spielstand ---------- */
let S = null;

function price(mId) { const h = S.prices[mId]; return h[h.length - 1]; }
function valueOf(mId, cond, papers) { return price(mId) * COND[cond].f * (papers ? 1 : NO_PAPERS); }
function itemValue(o) { return valueOf(o.m, o.cond, o.papers); }
function collectionValue(s = S) { return s.owned.reduce((sum, o) => sum + valueOfIn(s, o), 0); }
function valueOfIn(s, o) { const h = s.prices[o.m]; return h[h.length - 1] * COND[o.cond].f * (o.papers ? 1 : NO_PAPERS); }
function netWorth(s = S) { return s.money + collectionValue(s); }
function levelIdx(v) { let i = 0; LEVELS.forEach((l, k) => { if (v >= l.min) i = k; }); return i; }
function changeOver(mId, days) { const h = S.prices[mId]; const a = h[Math.max(0, h.length - 1 - days)]; return price(mId) / a - 1; }

function newGame(name) {
  const s = {
    v: 1, name: name || 'Sammler:in', money: START_MONEY, day: 1, lastTick: Date.now(),
    prices: {}, owned: [], listings: [], auctions: [], watch: [], news: [],
    stats: { bought: 0, sold: 0, profit: 0, bestFlip: 0, bestDeal: 0, offers: 0, auctions: 0, services: 0, spent: 0, flash: 0, fakes: 0, fakesCaught: 0 },
    rivals: newRivals(), rank: 9,
    ach: {}, lastBonus: '', jobReady: 0, bot: newBot(), shop: null,
  };
  for (const m of MODELS) {
    const h = []; let p = m.price; const vol = volOf(m), tr = trendOf(m);
    for (let i = 0; i < HISTORY; i++) { h.unshift(p < 1000 ? Math.round(p * 100) / 100 : Math.round(p)); p = p / Math.exp(tr + vol * gauss()); }
    s.prices[m.id] = h;
  }
  S = s;
  while (S.listings.length < LISTINGS) S.listings.push(genListing(true));
  // Damit man am Anfang etwas Bezahlbares findet
  ['casio-f91w', 'seiko-5', 'tissot-prx', 'hamilton-khaki', 'seiko-spb143'].forEach(id => S.listings.push(genListing(true, id)));
  while (S.auctions.length < AUCTIONS) S.auctions.push(genAuction(S.auctions.length));
  S.news.unshift({ day: 1, text: 'Willkommen auf dem Markt! Tipp: Schnäppchen sind grün markiert.' });
  return s;
}

function weightedModel() {
  const r = Math.random();
  const pool = MODELS.filter(m => r < 0.42 ? m.price < 5000 : r < 0.8 ? m.price >= 3000 && m.price < 30000 : m.price >= 20000);
  return pick(pool.length ? pool : MODELS);
}

function genListing(fresh, forceId) {
  const m = forceId ? MODEL[forceId] : weightedModel();
  const cond = pick([0, 1, 1, 1, 2, 2, 2, 3, 3, 4]);
  const papers = Math.random() < 0.7;
  const value = valueOf(m.id, cond, papers);
  const ratio = Math.random() < 0.12 ? rnd(0.76, 0.88) : rnd(0.93, 1.16);
  const [seller, city, dealer] = pick(SELLERS);
  return {
    id: uid('a'), m: m.id, cond, papers, price: niceRound(value * ratio),
    year: rint(m.year, 2025), seller, city, dealer: !!dealer,
    day: fresh ? S.day - rint(0, 6) : S.day, offered: 0,
    fake: !dealer && !papers && Math.random() < 0.15,
  };
}

function aucStep(bid) { return bid < 500 ? 10 : bid < 2000 ? 50 : bid < 10000 ? 100 : bid < 50000 ? 500 : 1000; }

function genAuction(i = 0) {
  const m = weightedModel();
  const cond = pick([0, 1, 1, 2, 2, 3, 4]);
  const papers = Math.random() < 0.65;
  const value = valueOf(m.id, cond, papers);
  const start = niceRound(value * rnd(0.45, 0.6));
  const n = rint(2, 5);
  return {
    id: uid('u'), m: m.id, cond, papers, bid: start, bids: 0, lead: null, me: false,
    // verdeckte Höchstgebote der anderen Bieter
    ai: Array.from({ length: n }, () => Math.round(value * rnd(0.7, 1.04))),
    ends: Date.now() + (150 + i * 45 + rint(0, 120)) * 1000,
  };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* privat-Modus o. Ä. */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !s.prices) return null;
    for (const m of MODELS) if (!s.prices[m.id]) { // neue Modelle nachrüsten
      s.prices[m.id] = Array.from({ length: HISTORY }, () => m.price);
    }
    s.owned = s.owned.filter(o => MODEL[o.m]);
    s.listings = s.listings.filter(l => MODEL[l.m]);
    s.auctions = s.auctions.filter(a => MODEL[a.m]);
    s.watch = s.watch.filter(id => MODEL[id]);
    s.bot = Object.assign(newBot(), s.bot || {});
    s.bot.up = Object.assign(newBot().up, s.bot.up || {});
    s.stats = Object.assign({ flash: 0, fakes: 0, fakesCaught: 0 }, s.stats);
    if (!s.rivals) { s.rivals = newRivals(); s.rank = 9; }
    if (s.shop) { s.shop.up = Object.assign({ slots: 0, staff: 0, ads: 0, loc: 0 }, s.shop.up); s.shop.deco = s.shop.deco || {}; }
    else s.shop = null;
    return s;
  } catch (e) { return null; }
}

/* ---------- Markttag ---------- */
function addNews(text) {
  S.news.unshift({ day: S.day, text });
  S.news = S.news.slice(0, 30);
}

function advanceDay(quiet) {
  S.day++;
  // Kurse
  for (const m of MODELS) {
    const h = S.prices[m.id];
    const p = h[h.length - 1];
    const target = m.price * Math.exp(trendOf(m) * S.day);
    let np = p * Math.exp(trendOf(m) + volOf(m) * gauss()) + 0.015 * (target - p);
    np = Math.max(m.price * 0.25, np);
    h.push(np < 1000 ? Math.round(np * 100) / 100 : Math.round(np));
    if (h.length > HISTORY) h.shift();
  }
  // Nachrichten
  if (Math.random() < 0.22) {
    const n = pick(NEWS); const m = pick(MODELS);
    const f = 1 + rnd(n.up[0], n.up[1]);
    const hit = n.t === 'all' ? MODELS : n.t === 'brand' ? MODELS.filter(x => x.brand === m.brand) : [m];
    hit.forEach(x => { const h = S.prices[x.id]; const v = h[h.length - 1] * f; h[h.length - 1] = v < 1000 ? Math.round(v * 100) / 100 : Math.round(v); });
    addNews(n.text(m));
    if (!quiet) toast(`📰 ${esc(n.text(m))}`);
  }
  // Angebote: manche werden von anderen gekauft, neue kommen
  S.listings = S.listings.filter(l => {
    const ratio = l.price / valueOf(l.m, l.cond, l.papers);
    const sellP = ratio < 0.9 ? 0.4 : ratio < 1 ? 0.18 : 0.08;
    return Math.random() > sellP && S.day - l.day < 25;
  });
  while (S.listings.length < LISTINGS) S.listings.push(genListing(false));
  // Blitz-Deal (nur live, läuft 90 Sekunden)
  if (!quiet && !S.listings.some(l => l.flash) && Math.random() < 0.2) {
    const l = genListing(false);
    l.dealer = true; l.fake = false; l.seller = 'Chronothek Blitz-Deal'; l.city = 'Online';
    l.price = niceRound(valueOf(l.m, l.cond, l.papers) * rnd(0.6, 0.75));
    l.flash = Date.now() + 90000;
    S.listings.push(l);
    toast(`⚡ <b>Blitz-Deal!</b> ${esc(MODEL[l.m].brand)} ${esc(MODEL[l.m].name)} für ${fmtEur(l.price)} – nur 90 Sekunden!`, 6000);
  }
  runBot(quiet);
  botStockShop(quiet);
  runShop(quiet);
  // Rivalen wachsen
  for (const r of S.rivals) r.w *= Math.exp(r.g + 0.02 * gauss());
  const rank = rankOf(S);
  if (rank < S.rank && !quiet) {
    const passed = [...S.rivals].sort((a, b) => b.w - a.w)[rank - 1];
    toast(`🏁 Du hast <b>${esc(passed ? passed.n : 'jemanden')}</b> überholt – jetzt Platz ${rank}!`, 5000);
  }
  S.rank = rank;
  if (S.bot.on) { S.bot.hist.push(botNet()); if (S.bot.hist.length > HISTORY) S.bot.hist.shift(); }
  // Eigene Inserate
  for (const o of [...S.owned]) {
    if (o.service && S.day >= o.service) {
      o.service = 0; o.cond = 1;
      if (!quiet) toast(`🔧 Revision fertig: <b>${esc(MODEL[o.m].name)}</b> ist jetzt „Sehr gut“.`);
    }
    if (!o.ask) continue;
    const ratio = o.ask / itemValue(o) - (o.bot ? 0.04 * S.bot.up.ai : 0);
    const p = ratio <= 0.9 ? 0.85 : ratio <= 1 ? 0.55 : ratio <= 1.05 ? 0.32 : ratio <= 1.15 ? 0.14 : ratio <= 1.3 ? 0.05 : 0.01;
    if (Math.random() < p) {
      const pay = Math.round(o.ask * (1 - FEE_SELL));
      const m = MODEL[o.m];
      if (o.bot) {
        const r = botSold(o, pay);
        BOTDAY.sold++; BOTDAY.profit += r.profit - r.fee;
        if (!quiet) botNote(`🤖 Bot hat <b>${esc(m.brand)} ${esc(m.name)}</b> verkauft: ${r.profit >= 0 ? 'Gewinn' : 'Verlust'} ${fmtEur(r.profit)}${r.fee ? `, Bot-Anteil ${fmtEur(r.fee)}` : ''}`);
        continue;
      }
      sellItem(o, pay);
      const msg = `💶 Verkauft: <b>${esc(m.brand)} ${esc(m.name)}</b> für ${fmtEur(o.ask)} (Auszahlung ${fmtEur(pay)})`;
      addNews(`Deine ${m.brand} ${m.name} wurde verkauft.`);
      if (!quiet) toast(msg);
    }
  }
  botDaySummary(quiet);
}

function sellItem(o, pay) {
  S.owned = S.owned.filter(x => x !== o);
  S.money += pay;
  const profit = pay - o.cost;
  S.stats.sold++;
  S.stats.profit += profit;
  S.stats.bestFlip = Math.max(S.stats.bestFlip, profit);
  flashWallet();
}

/* ---------- Trading-Bot: gratis, behält einen Anteil vom Gewinn ---------- */
const BOT_UPS = [
  { k: 'turbo', icon: '⚡', name: 'Turbo-Modus', max: 6, base: 1500, f: 2.6, desc: l => `${botBuys(l)} Käufe pro Markttag` },
  { k: 'scanner', icon: '🔍', name: 'Deal-Scanner', max: 3, base: 2500, f: 3, desc: l => l ? `findet ${2 * l} % mehr Deals und erkennt Fälschungen` : 'erkennt keine Fälschungen' },
  { k: 'ai', icon: '🧠', name: 'KI-Preisfindung', max: 3, base: 4000, f: 3, desc: l => l ? `verkauft ${l * 4} % „besser“ – schnellere Verkäufe` : 'Standard-Preise' },
  { k: 'sniper', icon: '🎯', name: 'Auktions-Sniper', max: 1, base: 15000, f: 1, desc: l => l ? 'bietet in den letzten 40 s bis 85 % vom Wert' : 'bietet nicht bei Auktionen' },
  { k: 'license', icon: '💼', name: 'Pro-Lizenz', max: 2, base: 20000, f: 4, desc: l => `Bot-Anteil nur noch ${20 - 5 * l} %` },
];
const BOT_TIERS = ['Basic', 'Plus', 'Pro', 'Elite', 'Quant', 'Overlord'];
function botBuys(l) { return 4 + 3 * l; }
function botShare() { return 0.2 - 0.05 * (S.bot.up.license || 0); }
function botUpCost(u, lvl) { return u.base * Math.pow(u.f, lvl); }
function botTier() { const n = Object.values(S.bot.up).reduce((a, b) => a + b, 0); return BOT_TIERS[Math.min(BOT_TIERS.length - 1, Math.floor(n / 2.2))]; }
function botNet() { return S.bot.gross - S.bot.losses - S.bot.fees; }
const BOT_MODES = [
  { name: 'Vorsichtig', buyBelow: 0.86, perTrade: 0.35, markup: 1.0, desc: 'Kauft nur echte Schnäppchen (14 % unter Wert) und verkauft schnell zum Marktwert.' },
  { name: 'Ausgewogen', buyBelow: 0.91, perTrade: 0.5, markup: 1.03, desc: 'Kauft ab 9 % unter Wert und verkauft etwas über Marktwert.' },
  { name: 'Riskant', buyBelow: 0.96, perTrade: 1, markup: 1.08, desc: 'Kauft fast alles leicht unter Wert, auch teure Uhren, und will mehr Gewinn. Dauert länger, kann auch Verlust bringen.' },
  { name: '🦈 Hai', buyBelow: 1.0, perTrade: 1, markup: 1.12, momentum: true, desc: 'Kauft auch zum vollen Preis, wenn ein Modell gerade steigt (Momentum), und will 12 % mehr. Großer Gewinn – oder großer Verlust.' },
];
function newBot() { return { notify: 1, on: false, stock: false, focus: '', maxPrice: 0, snipeOff: false, budget: 2000, mode: 1, trades: 0, gross: 0, fees: 0, losses: 0, log: [], hist: [], up: { turbo: 0, scanner: 0, ai: 0, sniper: 0, license: 0 } }; }
function botItems() { return S.owned.filter(o => o.bot); }
function botInUse() { return botItems().reduce((s, o) => s + o.cost, 0); }
// Bot-Meldungen: 0 = aus, 1 = nur eine kurze Zusammenfassung pro Markttag, 2 = alle
const BOT_NOTIFY = ['Aus', 'Kurz', 'Alle'];
let BOTDAY = { buy: 0, sold: 0, profit: 0 };
function botNote(html, ms) { if (S.bot.notify === 2) toast(html, ms); }
function botDaySummary(quiet) {
  const d = BOTDAY; BOTDAY = { buy: 0, sold: 0, profit: 0 };
  if (quiet || S.bot.notify !== 1 || (!d.buy && !d.sold)) return;
  const parts = [];
  if (d.buy) parts.push(`${d.buy} gekauft`);
  if (d.sold) parts.push(`${d.sold} verkauft (${d.profit >= 0 ? '+' : ''}${fmtEur(d.profit)})`);
  toast(`🤖 Bot heute: ${parts.join(', ')}`, 3000);
}
function botLog(text) { S.bot.log.unshift({ day: S.day, text }); S.bot.log = S.bot.log.slice(0, 25); }

function runBot(quiet) {
  const B = S.bot;
  if (!B.on) return;
  const mode = BOT_MODES[B.mode] || BOT_MODES[1];
  // 1. Eigene Positionen inserieren bzw. Preis senken, wenn es zu lange dauert
  for (const o of botItems()) {
    if (o.service) continue;
    const v = itemValue(o);
    const age = S.day - o.day;
    if (!o.shop && o.cond >= 3 && S.money >= serviceCost(o) && serviceCost(o) < v * 0.25 && !o.serviced) {
      S.money -= serviceCost(o); o.cost += serviceCost(o); o.service = S.day + 2; o.serviced = 1; o.ask = 0;
      botLog(`Revision für ${MODEL[o.m].brand} ${MODEL[o.m].name} beauftragt.`);
      continue;
    }
    if (o.shop) { // liegt im Laden: Preis mit der Zeit senken
      o.shop = niceRound(Math.max(1, v * shopTol() * (age > 10 ? 0.92 : age > 5 ? 0.97 : 1)));
      continue;
    }
    const target = age > 8 ? v * 0.97 : age > 4 ? v * Math.max(1, mode.markup - 0.03) : v * mode.markup;
    o.ask = niceRound(Math.max(target, 1));
  }
  // 2. Schnäppchen kaufen (Turbo = mehr Käufe pro Tag)
  let free = Math.min(S.money, B.budget - botInUse());
  const thr = Math.min(0.99, mode.buyBelow + 0.02 * B.up.scanner) + (mode.momentum ? 0.01 : 0);
  for (let n = 0; n < botBuys(B.up.turbo); n++) {
    const cands = S.listings
      .map(l => ({ l, r: l.price / valueOf(l.m, l.cond, l.papers) }))
      .filter(c => !c.l.flash && !(c.l.fake && B.up.scanner > 0) && botMatches(c.l))
      .filter(c => c.l.price <= free && c.l.price <= B.budget * mode.perTrade)
      .filter(c => c.r <= thr && (!mode.momentum || c.r <= 0.92 || changeOver(c.l.m, 7) > 0.02))
      .sort((a, b) => a.r - b.r);
    if (!cands.length) break;
    const { l, r } = cands[0];
    free -= l.price;
    botBuy(l, r, quiet);
  }
}
function botMatches(l) {
  const B = S.bot, m = MODEL[l.m];
  if (B.focus && !`${m.brand} ${m.name} ${m.cat}`.toLowerCase().includes(B.focus)) return false;
  if (B.maxPrice && l.price > B.maxPrice) return false;
  return true;
}
function botBuy(l, r, quiet) {
  const B = S.bot;
  S.money -= l.price;
  S.listings = S.listings.filter(x => x !== l);
  if (l.fake) {
    B.trades++; B.losses += l.price; S.stats.fakes++;
    botLog(`Reingefallen! ${MODEL[l.m].brand} ${MODEL[l.m].name} war eine Fälschung – ${fmtEur(l.price)} weg. (Tipp: Deal-Scanner)`);
    if (!quiet && S.bot.notify > 0) toast(`😱 Dein Bot hat eine <b>Fälschung</b> gekauft: −${fmtEur(l.price)}. Der Deal-Scanner hätte das erkannt.`, 6000);
    return 'fake';
  }
  S.owned.push({ id: uid('o'), m: l.m, cond: l.cond, papers: l.papers, cost: l.price, day: S.day, source: 'Trading-Bot', ask: 0, service: 0, bot: true });
  const m = MODEL[l.m];
  botLog(`Gekauft: ${m.brand} ${m.name} für ${fmtEur(l.price)} (${r <= 1 ? `${Math.round((1 - r) * 100)} % unter` : `${Math.round((r - 1) * 100)} % über`} Wert).`);
  BOTDAY.buy++;
  if (!quiet) botNote(`🤖 Bot kauft <b>${esc(m.brand)} ${esc(m.name)}</b> für ${fmtEur(l.price)}`);
  return true;
}

// Bot legt seine Uhren in freie Vitrinen deines Ladens (statt Marktplatz)
function botStockShop(quiet) {
  const B = S.bot;
  if (!S.shop || !B.stock || S.shop.closed) return 0;
  let free = shopSlots() - shopItems().length, n = 0;
  const cands = botItems().filter(o => !o.shop && !o.service).sort((a, b) => itemValue(b) - itemValue(a));
  for (const o of cands) {
    if (free <= 0) break;
    o.ask = 0; o.shop = niceRound(itemValue(o) * shopTol()); free--; n++;
    botLog(`In den Laden gelegt: ${MODEL[o.m].brand} ${MODEL[o.m].name} für ${fmtEur(o.shop)}.`);
  }
  if (n && !quiet) botNote(`🤖🏪 Bot hat <b>${n} Uhr${n === 1 ? '' : 'en'}</b> in deine Vitrinen gelegt.`);
  return n;
}

function botSold(o, pay) {
  S.owned = S.owned.filter(x => x !== o);
  const profit = pay - o.cost;
  const fee = profit > 0 ? Math.round(profit * botShare()) : 0;
  S.money += pay - fee;
  const B = S.bot;
  B.trades++; B.fees += fee;
  if (profit >= 0) B.gross += profit; else B.losses += -profit;
  S.stats.sold++; S.stats.profit += profit - fee;
  const m = MODEL[o.m];
  botLog(`Verkauft${o.shop ? ' im Laden' : ''}: ${m.brand} ${m.name} für ${fmtEur(o.shop || o.ask)} → ${profit >= 0 ? 'Gewinn' : 'Verlust'} ${fmtEur(profit)}${fee ? `, Bot-Anteil ${fmtEur(fee)}` : ''}.`);
  flashWallet();
  return { profit, fee };
}

/* ---------- Eigener Uhrenladen ---------- */
const SHOP_COST = 15000;
const SHOP_FEE = 0.02;          // Kartenzahlung im Laden statt 6 % Marktplatz-Gebühr
const SHOP_THEMES = [
  { k: 'apple', name: 'Weiß & Ahorn', wall: '#f4f4f2', wall2: '#e4e4e0', accent: '#8a8f96', text: '#333', font: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { k: 'boutique', name: 'Schwarz & Gold', wall: '#1d1b18', wall2: '#2c2822', accent: '#c9a44e', text: '#f3e3b5', font: 'Didot, "Bodoni 72", Georgia, serif' },
  { k: 'werkstatt', name: 'Alte Werkstatt', wall: '#6b4a2e', wall2: '#5a3d25', accent: '#d9b98a', text: '#fff3df', font: 'Georgia, "Times New Roman", serif' },
  { k: 'retro', name: 'Retro 70er', wall: '#e9a23b', wall2: '#c8742a', accent: '#5a3418', text: '#fff6e0', font: '"Cooper Black", "Arial Rounded MT Bold", Georgia, serif' },
  { k: 'neon', name: 'Neon Tokio', wall: '#14122a', wall2: '#1f1b40', accent: '#ff3ea5', text: '#5ff3ff', font: '"Avenir Next", "Helvetica Neue", sans-serif' },
  { k: 'mint', name: 'Mint Pastell', wall: '#d8efe6', wall2: '#bfe1d3', accent: '#3b8f74', text: '#24584a', font: '"Gill Sans", "Trebuchet MS", sans-serif' },
];
const SHOP_SIGNS = ['#2d6fd6', '#b5262c', '#1f6b3a', '#1b1b1b', '#c9a44e', '#7a3fb5'];
const SHOP_FLOORS = [
  { k: 'parkett', name: 'Parkett' }, { k: 'marmor', name: 'Marmor' }, { k: 'beton', name: 'Beton' },
  { k: 'teppich', name: 'Roter Teppich' }, { k: 'schach', name: 'Schachbrett' },
];
const SHOP_CASES = [{ k: 'glas', name: 'Glasvitrine' }, { k: 'holz', name: 'Holzkasten' }, { k: 'samt', name: 'Samtkissen' }];
const SHOP_LIGHTS = [{ k: 'warm', name: 'Warmweiß' }, { k: 'kalt', name: 'Tageslicht' }, { k: 'spot', name: 'Spots' }];
const SHOP_DECO = [
  { k: 'plant', icon: '🪴', name: 'Pflanze', cost: 300, amb: 1 },
  { k: 'sofa', icon: '🛋', name: 'Ledersofa', cost: 2500, amb: 2 },
  { k: 'clock', icon: '🕰', name: 'Standuhr', cost: 4000, amb: 2 },
  { k: 'art', icon: '🖼', name: 'Kunstwerk', cost: 6000, amb: 3 },
  { k: 'bar', icon: '🥂', name: 'Champagner-Bar', cost: 12000, amb: 4 },
  { k: 'lamp', icon: '💡', name: 'Kronleuchter', cost: 20000, amb: 5 },
];
const SHOP_UPS = [
  { k: 'slots', icon: '🗄', name: 'Vitrinen', max: 5, base: 4000, f: 2.5, desc: l => `${shopSlots(l)} Plätze im Laden` },
  { k: 'staff', icon: '🧑‍💼', name: 'Personal', max: 3, base: 3000, f: 4, desc: l => ['Nur du selbst', '1 Aushilfe (+Verkaufschance)', '2 Verkäufer:innen', 'Top-Verkaufsteam'][l] + (l ? ` · Lohn ${fmtEur(SHOP_WAGE[l])}/Tag` : '') },
  { k: 'ads', icon: '📣', name: 'Werbung', max: 4, base: 1500, f: 3, desc: l => ['Keine Werbung', 'Flyer', 'Zeitungsanzeige', 'Social Media', 'Plakate in der Stadt'][l] + ` · ca. ${Math.round(shopVisitorsBase(l, S.shop ? S.shop.up.loc : 0))} Besucher/Tag` },
  { k: 'loc', icon: '📍', name: 'Lage', max: 3, base: 12000, f: 4, desc: l => SHOP_LOCS[l].name + ` · Miete ${fmtEur(SHOP_LOCS[l].rent)}/Tag` },
];
const SHOP_WAGE = [0, 60, 180, 450];
const SHOP_LOCS = [
  { name: 'Seitenstraße', rent: 40, tol: 0, vis: 1 },
  { name: 'Einkaufsstraße', rent: 120, tol: 0.04, vis: 1.5 },
  { name: 'Innenstadt-Passage', rent: 350, tol: 0.08, vis: 2.2 },
  { name: 'Luxusmeile', rent: 900, tol: 0.14, vis: 3 },
];
const FIRST_NAMES = ['Anna', 'Ben', 'Clara', 'David', 'Elif', 'Finn', 'Greta', 'Hakan', 'Ida', 'Jonas', 'Kim', 'Lena', 'Mehmet', 'Nora', 'Ole', 'Paula', 'Rafael', 'Sofia', 'Tom', 'Yuki', 'Herr Weber', 'Frau Schmidt', 'ein Tourist', 'eine Sammlerin'];
const CITIES = ['Köln', 'München', 'Hamburg', 'Wien', 'Zürich', 'Berlin', 'Dubai', 'Paris', 'Mailand', 'New York', 'Tokio'];

function newShop(name) {
  return { name, theme: 'apple', sign: 0, floor: 'parkett', vit: 'glas', light: 'warm', deco: {}, up: { slots: 0, staff: 0, ads: 0, loc: 0 },
    opened: S.day, sales: 0, revenue: 0, profit: 0, costs: 0, visitors: 0, reviews: [], log: [], tradeins: [], whole: [], wholeDay: 0, closed: false };
}
function shopSlots(l = S.shop.up.slots) { return [4, 8, 12, 16, 24, 32][l]; }
function shopItems() { return S.owned.filter(o => o.shop); }
function shopAmb() { return SHOP_DECO.reduce((a, d) => a + (S.shop.deco[d.k] ? d.amb : 0), 0); }
function shopVisitorsBase(ads, loc) { return (6 + 7 * ads) * SHOP_LOCS[loc].vis; }
function shopRating() { const r = S.shop.reviews; return r.length ? r.reduce((a, b) => a + b.s, 0) / r.length : 0; }
function shopDailyCost() { return SHOP_LOCS[S.shop.up.loc].rent + SHOP_WAGE[S.shop.up.staff]; }
// So viel über Marktwert zahlen Kund:innen im Laden gerne (Beratung, Ambiente, Lage)
function shopTol() { const sh = S.shop; return 1.04 + SHOP_LOCS[sh.up.loc].tol + 0.025 * sh.up.staff + 0.006 * shopAmb(); }
function shopLog(text) { S.shop.log.unshift({ day: S.day, text }); S.shop.log = S.shop.log.slice(0, 30); }
function shopChance(o, askP = o.shop) {
  const r = askP / itemValue(o) / shopTol();
  return r <= 0.9 ? 0.6 : r <= 1 ? 0.42 : r <= 1.06 ? 0.22 : r <= 1.15 ? 0.08 : 0.02;
}

function runShop(quiet) {
  const sh = S.shop; if (!sh) return;
  // Laufende Kosten
  const cost = shopDailyCost();
  if (S.money < cost) {
    sh.closed = true;
    shopLog(`Laden geschlossen: Miete/Lohn (${fmtEur(cost)}) konnte nicht bezahlt werden.`);
    if (!quiet) toast(`🔒 Dein Laden bleibt heute zu – es fehlen ${fmtEur(cost)} für Miete und Lohn.`, 5000);
    return;
  }
  sh.closed = false;
  S.money -= cost; sh.costs += cost; sh.profit -= cost;
  // Besucher
  const rating = shopRating();
  const vis = Math.max(1, Math.round(shopVisitorsBase(sh.up.ads, sh.up.loc) * (1 + 4 * (shopSale() ? shopSale().pct : 0)) * (0.8 + (rating ? rating / 5 : 0.6) * 0.4 + 0.03 * shopAmb()) * rnd(0.75, 1.25)));
  sh.visitors = vis;
  const traffic = clamp(vis / 18, 0.25, 3);
  const sale = shopSale();
  let soldToday = 0;
  for (const o of shopItems()) {
    const eff = salePrice(o);
    const p = clamp(shopChance(o, eff) * traffic * (1 + 0.15 * sh.up.staff), 0, 0.95);
    if (Math.random() >= p) continue;
    const pay = Math.round(eff * (1 - SHOP_FEE));
    const m = MODEL[o.m];
    const r = eff / itemValue(o) / shopTol();
    const stars = clamp(Math.round((r <= 0.95 ? 5 : r <= 1.03 ? 4.6 : r <= 1.1 ? 3.8 : 3) + 0.08 * shopAmb() + (sale ? 0.4 : 0) + rnd(-0.6, 0.4)), 1, 5);
    const who = pick(FIRST_NAMES), city = pick(CITIES);
    sh.reviews.unshift({ s: stars, who, day: S.day }); sh.reviews = sh.reviews.slice(0, 20);
    sh.sales++; sh.revenue += eff; soldToday++;
    const isBot = o.bot;
    if (isBot) { o.shop = eff; const res = botSold(o, pay); sh.profit += pay - res.fee - o.cost; BOTDAY.profit += res.profit - res.fee; }
    else { sh.profit += pay - o.cost; sellItem(o, pay); }
    shopLog(`${who} aus ${city} kauft ${m.brand} ${m.name} für ${fmtEur(eff)}${sale ? ' (Sale)' : ''}${isBot ? ' [Bot-Ware]' : ''} · ${'★'.repeat(stars)}`);
    if (isBot) { BOTDAY.sold++; }
    if (!quiet) (isBot ? botNote : toast)(`🏪 <b>${esc(who)}</b> hat in deinem Laden die <b>${esc(m.brand)} ${esc(m.name)}</b> für ${fmtEur(eff)} gekauft!${isBot ? ' 🤖' : ''} ${'★'.repeat(stars)}`, 5000);
  }
  if (!soldToday) shopLog(`${vis} Besucher, heute nichts verkauft.`);
  // Ankauf: Kund:innen bieten dir ihre Uhren an
  sh.tradeins = sh.tradeins.filter(t => S.day - t.day < 3);
  const nT = Math.random() < Math.min(0.9, vis / 25) ? rint(1, 1 + sh.up.loc) : 0;
  for (let i = 0; i < nT && sh.tradeins.length < 6; i++) {
    const m = weightedModel();
    const cond = pick([0, 1, 1, 2, 2, 3]); const papers = Math.random() < 0.75;
    sh.tradeins.push({ id: uid('t'), m: m.id, cond, papers, price: niceRound(valueOf(m.id, cond, papers) * rnd(0.7, 0.88)), who: pick(FIRST_NAMES), day: S.day });
  }
  // Großhändler: neue Liste alle 3 Tage
  if (!sh.whole.length || S.day - sh.wholeDay >= 3) shopRestock();
}
// Sale-Aktion: Rabatt auf alle Ladenpreise, dafür viel mehr Besucher
const SALES = [{ pct: 0.1, days: 2 }, { pct: 0.2, days: 2 }, { pct: 0.3, days: 1 }];
const SALE_COOLDOWN = 6;
function shopSale() { const sh = S.shop; return sh && sh.sale && S.day <= sh.sale.until ? sh.sale : null; }
function salePrice(o) { const sl = shopSale(); return sl ? niceRound(o.shop * (1 - sl.pct)) : o.shop; }
function saleReady() { const sh = S.shop; return !shopSale() && (!sh.sale || S.day >= sh.sale.start + SALE_COOLDOWN); }

function shopRestock() {
  const sh = S.shop;
  sh.wholeDay = S.day;
  sh.whole = Array.from({ length: 6 }, () => { const m = weightedModel(); return { id: uid('g'), m: m.id, price: niceRound(valueOf(m.id, 0, true) * rnd(0.86, 0.94)), qty: rint(1, 3) }; });
}

function catchUp() {
  const now = Date.now();
  let n = Math.floor((now - S.lastTick) / DAY_MS);
  if (n <= 0) return 0;
  const done = Math.min(n, MAX_CATCHUP);
  for (let i = 0; i < done; i++) advanceDay(true);
  S.lastTick += n * DAY_MS;
  return done;
}

/* ---------- Auktions-Sniper des Bots ---------- */
function botSnipe(now) {
  const B = S.bot;
  if (!B.on || !B.up.sniper || B.snipeOff) return false;
  let changed = false;
  for (const a of S.auctions) {
    if (a.me || a.ends - now > 40000 || a.ends <= now || (B.focus || B.maxPrice) && !botMatches({ m: a.m, price: a.bid })) continue;
    const max = valueOf(a.m, a.cond, a.papers) * 0.85;
    const next = a.bid + aucStep(a.bid);
    const free = Math.min(S.money, B.budget - botInUse());
    if (next > max || next * (1 + PREMIUM) > free) continue;
    a.bid = next; a.bids++; a.me = true; a.byBot = true; a.lead = '🤖 Dein Bot';
    if (a.ends - now < 20000) a.ends = now + 20000;
    changed = true;
  }
  return changed;
}

/* ---------- Auktionen ---------- */
function tickAuctions(now, live) {
  let changed = false;
  for (const a of [...S.auctions]) {
    if (now >= a.ends) {
      // Wer offline überboten worden wäre, verliert
      if (a.me && !live && a.ai.some(x => x >= a.bid + aucStep(a.bid))) { a.me = false; a.lead = 'Bieter ' + rint(10, 99); }
      finishAuction(a, live);
      changed = true;
      continue;
    }
    if (!live) continue;
    const left = (a.ends - now) / 1000;
    const next = a.bid + aucStep(a.bid);
    const able = a.ai.filter(x => x >= next);
    if (!able.length) continue;
    const chance = a.me ? (left < 20 ? 0.45 : 0.12) : (left < 30 ? 0.12 : 0.03);
    if (Math.random() < chance) {
      a.bid = next; a.bids++; a.me = false; a.byBot = false; a.lead = 'Bieter ' + rint(10, 99);
      if (left < 20) a.ends = now + 20000; // Schutz vor Last-Second-Geboten
      changed = true;
    }
  }
  return changed;
}

function finishAuction(a, live) {
  const m = MODEL[a.m];
  S.auctions = S.auctions.filter(x => x !== a);
  if (a.me) {
    const total = Math.round(a.bid * (1 + PREMIUM));
    if (S.money >= total) {
      S.money -= total;
      addOwned(a.m, a.cond, a.papers, total, a.byBot ? 'Bot-Auktion' : 'Auktion');
      if (a.byBot) { S.owned[S.owned.length - 1].bot = true; botLog(`Auktion gewonnen: ${m.brand} ${m.name} für ${fmtEur(total)}.`); }
      S.stats.auctions++;
      addNews(`Zuschlag! Du hast die ${m.brand} ${m.name} ersteigert.`);
      if (live) toast(`🔨 <b>Zuschlag!</b> ${esc(m.brand)} ${esc(m.name)} für ${fmtEur(total)} (inkl. Aufgeld)`);
    } else if (live) toast('Zuschlag verfallen – du hattest nicht mehr genug Geld.');
  } else if (a.bids > 0) {
    addNews(`Auktion beendet: ${m.brand} ${m.name} ging für ${fmtEur(a.bid)} weg.`);
  }
  S.auctions.push(genAuction(rint(0, 2)));
}

function placeBid(id, steps) {
  const a = S.auctions.find(x => x.id === id);
  if (!a || Date.now() >= a.ends) return;
  let bid = a.bid;
  for (let i = 0; i < steps; i++) bid += aucStep(bid);
  if (a.me && steps === 0) return;
  if (S.money < bid * (1 + PREMIUM)) { toast('Dafür reicht dein Kontostand nicht (inkl. 5 % Aufgeld).'); return; }
  a.bid = bid; a.bids++; a.me = true; a.byBot = false; a.lead = S.name;
  if (a.ends - Date.now() < 20000) a.ends = Date.now() + 20000;
  save(); render();
}

/* ---------- Kaufen, Verkaufen, Werkstatt ---------- */
function addOwned(mId, cond, papers, cost, source) {
  S.owned.push({ id: uid('o'), m: mId, cond, papers, cost, day: S.day, source, ask: 0, service: 0 });
  S.stats.bought++;
  S.stats.spent += cost;
}

function buyListing(id, priceOverride) {
  const l = S.listings.find(x => x.id === id);
  if (!l) return false;
  const p = priceOverride || l.price;
  if (S.money < p) { toast('Dafür reicht dein Kontostand nicht.'); return false; }
  const deal = 1 - p / valueOf(l.m, l.cond, l.papers);
  S.money -= p;
  S.listings = S.listings.filter(x => x !== l);
  if (l.fake) {
    S.stats.fakes++; save(); flashWallet();
    modal('Oh nein …', `<div class="shot">${watchImg(l.m)}</div><p class="center"><b>Die Uhr ist eine Fälschung!</b><br>Das Werk ist billig, die Gravur schief. ${fmtEur(p)} sind weg.</p><p class="muted center" style="font-size:12px">Tipp: Bei Privatverkäufen ohne Papiere lieber die Echtheitsprüfung dazubuchen.</p>`,
      '<button class="btn blue" data-act="close">Lehrgeld …</button>');
    return 'fake';
  }
  if (l.flash) S.stats.flash++;
  addOwned(l.m, l.cond, l.papers, p, l.seller);
  S.stats.bestDeal = Math.max(S.stats.bestDeal, deal);
  checkAchievements();
  save();
  return true;
}

function serviceCost(o) { return Math.max(60, niceRound(price(o.m) * 0.06)); }

/* ---------- Erfolge ---------- */
function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (S.ach[a.id] || !a.test(S)) continue;
    S.ach[a.id] = S.day;
    S.money += a.reward;
    toast(`🏅 Erfolg: <b>${esc(a.name)}</b> – Belohnung ${fmtEur(a.reward)}`);
  }
  const li = levelIdx(collectionValue());
  if (li > (S.level || 0)) {
    S.level = li;
    toast(`⭐ Neue Stufe: <b>${LEVELS[li].name}</b>`);
  }
}

/* =====================================================================
   Uhren-Grafik (SVG), komplett gezeichnet – keine Logos.
   ===================================================================== */
let gid = 0;
const METALS = {
  steel: ['#fbfbfb', '#a9adb2', '#e9ebee', '#7d8186'],
  white: ['#ffffff', '#b8bcc2', '#eef0f3', '#8a8e94'],
  gold: ['#fff1c1', '#c2953a', '#f3d98e', '#8a6420'],
  rose: ['#ffe0cf', '#b9775a', '#f2c2a6', '#80482f'],
  titan: ['#dcdcd8', '#86867f', '#c4c4bf', '#5f5f5a'],
  black: ['#5a5a5a', '#161616', '#3a3a3a', '#000'],
  gray: ['#c7ccd2', '#6f757c', '#aab0b7', '#4b5056'],
};

function watchSVG(m, opts = {}) {
  const L = m.look || {};
  const id = 'w' + (++gid);
  const M = METALS[L.m || 'steel'];
  const shape = L.s || 'round';
  const out = [];
  const defs = `
    <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${M[0]}"/><stop offset=".45" stop-color="${M[1]}"/><stop offset=".7" stop-color="${M[2]}"/><stop offset="1" stop-color="${M[3]}"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${M[3]}"/><stop offset=".25" stop-color="${M[2]}"/><stop offset=".5" stop-color="${M[0]}"/><stop offset=".75" stop-color="${M[2]}"/><stop offset="1" stop-color="${M[3]}"/></linearGradient>
    <radialGradient id="${id}d" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${shade(L.d || '#222', 0.28)}"/><stop offset=".7" stop-color="${L.d || '#222'}"/><stop offset="1" stop-color="${shade(L.d || '#222', -0.3)}"/></radialGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset=".51" stop-color="#fff" stop-opacity="0"/></linearGradient>
    ${L.tap ? `<pattern id="${id}p" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${L.d}"/><rect x=".6" y=".6" width="3.8" height="3.8" fill="${shade(L.d, 0.12)}"/></pattern>` : ''}
  `;
  // ---- Band ----
  out.push(strap(L, id, shape));
  // ---- Gehäuse + Zifferblatt ----
  const cx = 100, cy = 130;
  const dark = isDark(L.d || '#222');
  const ink = dark ? '#f4f4f4' : '#1d1d1d';
  if (shape === 'digital' || shape === 'gshock') {
    const w = shape === 'gshock' ? 118 : 96, h = shape === 'gshock' ? 112 : 86;
    out.push(`<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${shape === 'gshock' ? 24 : 12}" fill="url(#${id}m)" stroke="#000" stroke-opacity=".5"/>`);
    if (shape === 'gshock') {
      [[-62, -30], [-62, 22], [58, -30], [58, 22]].forEach(([x, y]) => out.push(`<rect x="${cx + x}" y="${cy + y}" width="5" height="10" rx="2" fill="#2a2a2a"/>`));
      out.push(`<rect x="${cx - 46}" y="${cy - 40}" width="92" height="80" rx="14" fill="#0e0e0e" stroke="#444"/>`);
    }
    out.push(`<rect x="${cx - 36}" y="${cy - 22}" width="72" height="44" rx="4" fill="#9fae8f" stroke="#555"/>`);
    out.push(`<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="Menlo, Courier New, monospace" font-size="24" font-weight="700" fill="#1f261b">10:10</text>`);
    out.push(`<text x="${cx}" y="${cy - 28}" text-anchor="middle" font-family="Helvetica" font-size="${shape === 'gshock' ? 7 : 5.5}" fill="#ccc" letter-spacing=".5">${shape === 'gshock' ? 'SHOCK RESIST' : 'ALARM CHRONOGRAPH'}</text>`);
    out.push(`<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h / 2}" rx="12" fill="url(#${id}g)"/>`);
  } else {
    // Krone
    if (shape !== 'reverso') out.push(`<rect x="${shape === 'tonneau' ? 160 : 163}" y="${cy - 8}" width="10" height="16" rx="3" fill="url(#${id}b)" stroke="#000" stroke-opacity=".35"/>`);
    if (L.guard) out.push(`<path d="M160 112 q14 4 14 18 q0 14 -14 18 z" fill="url(#${id}m)" stroke="#000" stroke-opacity=".3"/>`);
    if (L.c && shape === 'round') {
      out.push(`<rect x="160" y="${cy - 36}" width="9" height="10" rx="2" fill="url(#${id}b)" transform="rotate(-25 160 ${cy - 31})"/>`);
      out.push(`<rect x="160" y="${cy + 26}" width="9" height="10" rx="2" fill="url(#${id}b)" transform="rotate(25 160 ${cy + 31})"/>`);
    }
    const dial = caseAndDial(shape, L, id, cx, cy, out);
    // Zifferblatt-Details
    out.push(`<g clip-path="url(#${id}c)">`);
    if (L.lines) for (let y = dial.y0; y < dial.y1; y += 4) out.push(`<line x1="${cx - 60}" x2="${cx + 60}" y1="${y}" y2="${y}" stroke="#000" stroke-opacity=".18"/>`);
    if (L.snow) for (let i = 0; i < 40; i++) out.push(`<circle cx="${cx + rnd(-45, 45)}" cy="${cy + rnd(-45, 45)}" r="${rnd(2, 6)}" fill="#fff" opacity=".35"/>`);
    if (L.teak) for (let x = cx - 50; x < cx + 50; x += 5) out.push(`<line x1="${x}" x2="${x}" y1="${cy - 50}" y2="${cy + 50}" stroke="#fff" stroke-opacity=".12"/>`);
    if (L.skel) {
      out.push(`<rect x="${cx - 60}" y="${cy - 60}" width="120" height="120" fill="#151515"/>`);
      for (let i = 0; i < 9; i++) out.push(`<circle cx="${cx + rnd(-28, 28)}" cy="${cy + rnd(-34, 34)}" r="${rnd(5, 14)}" fill="none" stroke="${i % 2 ? '#c9a04a' : '#8a8a8a'}" stroke-width="2"/>`);
      out.push(`<path d="M${cx - 30} ${cy - 40} L${cx + 30} ${cy + 40} M${cx + 30} ${cy - 40} L${cx - 30} ${cy + 40}" stroke="#9b9b9b" stroke-width="3"/>`);
    }
    out.push(`</g>`);
    markers(L, dial, cx, cy, ink, out, shape);
    if (L.c) subdials(L, cx, cy, dial, ink, dark, out);
    if (L.dt && !L.lange) {
      const dx = L.c ? cx + dial.r * 0.0 : cx + dial.r * 0.62, dy = L.c ? cy + dial.r * 0.62 : cy;
      if (!L.c || L.c === 2) out.push(`<rect x="${(L.c ? cx - 6 : dx - 7)}" y="${(L.c ? cy + dial.r * 0.5 : dy - 5)}" width="${L.day ? 14 : 13}" height="10" fill="#fff" stroke="#666" stroke-width=".6"/><text x="${(L.c ? cx : dx - 0.5)}" y="${(L.c ? cy + dial.r * 0.5 : dy - 5) + 8}" font-size="7.5" text-anchor="middle" font-family="Helvetica" fill="#111">18</text>`);
      if (L.flute || L.wave || L.day) out.push(`<rect x="${dx - 10}" y="${dy - 9}" width="20" height="18" rx="7" fill="#fff" opacity=".18"/>`);
    }
    if (L.day) out.push(`<rect x="${cx - 18}" y="${cy - dial.r * 0.62 - 6}" width="36" height="11" fill="#fff" stroke="#888" stroke-width=".6"/><text x="${cx}" y="${cy - dial.r * 0.62 + 3}" font-size="7" text-anchor="middle" font-family="Times, serif" fill="#111" letter-spacing=".5">FREITAG</text>`);
    if (L.lange) {
      out.push(`<circle cx="${cx - 12}" cy="${cy}" r="${dial.r * 0.48}" fill="none" stroke="#9a8f7a" stroke-width="1"/>`);
      out.push(`<rect x="${cx + 12}" y="${cy - 26}" width="24" height="16" fill="#fff" stroke="#9a8f7a"/><line x1="${cx + 24}" x2="${cx + 24}" y1="${cy - 26}" y2="${cy - 10}" stroke="#9a8f7a"/>`);
      out.push(`<text x="${cx + 18}" y="${cy - 14}" font-size="10" text-anchor="middle" fill="#111" font-family="Helvetica">1</text><text x="${cx + 30}" y="${cy - 14}" font-size="10" text-anchor="middle" fill="#111" font-family="Helvetica">8</text>`);
      out.push(`<circle cx="${cx + 26}" cy="${cy + 26}" r="10" fill="none" stroke="#9a8f7a"/>`);
    }
    hands(L, cx + (L.lange ? -12 : 0), cy, dial.r * (L.lange ? 0.5 : 1), ink, out, L.gmt);
    // Glasreflex
    out.push(`<g clip-path="url(#${id}c)"><path d="M${cx - 80} ${cy - 80} L${cx + 50} ${cy - 80} L${cx - 70} ${cy + 20} Z" fill="#fff" opacity=".1"/></g>`);
  }
  const w = opts.w ? `width="${opts.w}"` : '';
  return `<svg viewBox="0 0 200 260" ${w} role="img" aria-label="${esc(m.brand + ' ' + m.name)}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${out.join('')}</svg>`;
}

function caseAndDial(shape, L, id, cx, cy, out) {
  const metal = `url(#${id}m)`;
  const dialFill = L.tap ? `url(#${id}p)` : `url(#${id}d)`;
  let r = 50, y0 = cy - 50, y1 = cy + 50;
  const clip = (inner) => out.push(`<clipPath id="${id}c">${inner}</clipPath>`);
  if (shape === 'round') {
    for (const [lx, ly] of [[-40, -78], [26, -78], [-40, 50], [26, 50]]) out.push(`<rect x="${cx + lx}" y="${cy + ly}" width="14" height="28" rx="5" fill="${metal}" stroke="#000" stroke-opacity=".25"/>`); // Bandanstöße
    out.push(`<circle cx="${cx}" cy="${cy}" r="64" fill="${metal}" stroke="#000" stroke-opacity=".35"/>`);
    let dr = 52;
    if (L.bz) {
      out.push(`<path d="M${cx - 60} ${cy} A60 60 0 0 1 ${cx + 60} ${cy} Z" fill="${L.bz[0]}"/><path d="M${cx - 60} ${cy} A60 60 0 0 0 ${cx + 60} ${cy} Z" fill="${L.bz[1]}"/>`);
      out.push(`<circle cx="${cx}" cy="${cy}" r="60" fill="url(#${id}g)"/>`);
      ticksRing(cx, cy, 60, 50, 24, '#eee', out); dr = 48;
    } else if (L.b) {
      out.push(`<circle cx="${cx}" cy="${cy}" r="60" fill="${L.b}"/><circle cx="${cx}" cy="${cy}" r="60" fill="url(#${id}g)"/>`);
      if (L.dive) { ticksRing(cx, cy, 60, 51, 12, '#eee', out); out.push(`<path d="M${cx - 5} ${cy - 59} L${cx + 5} ${cy - 59} L${cx} ${cy - 51} Z" fill="#eee"/>`); }
      if (L.tachy) ticksRing(cx, cy, 60, 54, 48, '#ddd', out);
      if (L.tri) ticksRing(cx, cy, 60, 53, 60, '#ddd', out);
      dr = 49;
    } else if (L.flute) {
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * Math.PI * 2;
        out.push(`<line x1="${cx + Math.cos(a) * 52}" y1="${cy + Math.sin(a) * 52}" x2="${cx + Math.cos(a) * 60}" y2="${cy + Math.sin(a) * 60}" stroke="${i % 2 ? '#fff' : '#000'}" stroke-opacity="${i % 2 ? .6 : .25}" stroke-width="2.5"/>`);
      }
      dr = 50;
    } else if (L.maltese) {
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; out.push(`<circle cx="${cx + Math.cos(a) * 57}" cy="${cy + Math.sin(a) * 57}" r="5" fill="${metal}" stroke="#000" stroke-opacity=".25"/>`); }
      out.push(`<circle cx="${cx}" cy="${cy}" r="56" fill="${metal}" stroke="#000" stroke-opacity=".2"/>`); dr = 50;
    } else {
      out.push(`<circle cx="${cx}" cy="${cy}" r="${L.thin ? 58 : 57}" fill="none" stroke="#000" stroke-opacity=".18"/>`);
      dr = L.thin ? 56 : 54;
    }
    out.push(`<circle cx="${cx}" cy="${cy}" r="${dr}" fill="${dialFill}"/>`);
    clip(`<circle cx="${cx}" cy="${cy}" r="${dr}"/>`);
    r = dr; y0 = cy - dr; y1 = cy + dr;
    return { kind: 'round', r, y0, y1 };
  }
  // eckige und besondere Formen
  const shapes = {
    tank: { cw: 84, ch: 112, rx: 6, dw: 58, dh: 88, drx: 2 },
    reverso: { cw: 82, ch: 116, rx: 6, dw: 64, dh: 88, drx: 3 },
    square: { cw: 112, ch: 112, rx: 16, dw: 86, dh: 86, drx: 8 },
    santos: { cw: 116, ch: 116, rx: 22, dw: 82, dh: 82, drx: 10 },
    cushion: { cw: 122, ch: 122, rx: 40, dw: 92, dh: 92, drx: 30 },
    tv: { cw: 116, ch: 112, rx: 34, dw: 88, dh: 86, drx: 26 },
    tonneau: { cw: 112, ch: 138, rx: 46, dw: 86, dh: 110, drx: 34 },
    octagon: { cw: 124, ch: 124, rx: 0, dw: 86, dh: 86, drx: 8 },
    nautilus: { cw: 124, ch: 118, rx: 50, dw: 88, dh: 84, drx: 34 },
  };
  const g = shapes[shape] || shapes.square;
  if (shape === 'tank') {
    out.push(`<rect x="${cx - 46}" y="${cy - 60}" width="16" height="120" rx="4" fill="${metal}" stroke="#000" stroke-opacity=".3"/><rect x="${cx + 30}" y="${cy - 60}" width="16" height="120" rx="4" fill="${metal}" stroke="#000" stroke-opacity=".3"/>`);
    out.push(`<rect x="${cx - 32}" y="${cy - 56}" width="64" height="112" rx="3" fill="${metal}"/>`);
  } else if (shape === 'octagon') {
    out.push(`<rect x="${cx - 70}" y="${cy - 52}" width="140" height="104" rx="18" fill="${metal}" stroke="#000" stroke-opacity=".3"/>`); // Gehäuse hinten
    const pts = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; pts.push(`${cx + Math.cos(a) * 64},${cy + Math.sin(a) * 64}`); }
    out.push(`<polygon points="${pts.join(' ')}" fill="${metal}" stroke="#000" stroke-opacity=".35"/>`);
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; out.push(`<circle cx="${cx + Math.cos(a) * 54}" cy="${cy + Math.sin(a) * 54}" r="3.4" fill="url(#${id}b)" stroke="#000" stroke-opacity=".4"/>`); }
  } else if (shape === 'nautilus') {
    out.push(`<rect x="${cx - 70}" y="${cy - 26}" width="140" height="52" rx="16" fill="${metal}" stroke="#000" stroke-opacity=".3"/>`); // „Ohren“
    out.push(`<rect x="${cx - g.cw / 2}" y="${cy - g.ch / 2}" width="${g.cw}" height="${g.ch}" rx="${g.rx}" fill="${metal}" stroke="#000" stroke-opacity=".35"/>`);
  } else {
    out.push(`<rect x="${cx - g.cw / 2}" y="${cy - g.ch / 2}" width="${g.cw}" height="${g.ch}" rx="${g.rx}" fill="${metal}" stroke="#000" stroke-opacity=".35"/>`);
    if (shape === 'santos') [[-46, -46], [0, -50], [46, -46], [50, 0], [46, 46], [0, 50], [-46, 46], [-50, 0]].forEach(([x, y]) => out.push(`<circle cx="${cx + x}" cy="${cy + y}" r="3.5" fill="url(#${id}b)" stroke="#000" stroke-opacity=".4"/>`));
    if (shape === 'reverso') for (let i = 0; i < 3; i++) { out.push(`<line x1="${cx - 34}" x2="${cx + 34}" y1="${cy - 54 + i * 4}" y2="${cy - 54 + i * 4}" stroke="#000" stroke-opacity=".3"/><line x1="${cx - 34}" x2="${cx + 34}" y1="${cy + 46 + i * 4}" y2="${cy + 46 + i * 4}" stroke="#000" stroke-opacity=".3"/>`); }
  }
  const dx = cx - g.dw / 2, dy = cy - g.dh / 2;
  out.push(`<rect x="${dx}" y="${dy}" width="${g.dw}" height="${g.dh}" rx="${g.drx}" fill="${dialFill}"/>`);
  clip(`<rect x="${dx}" y="${dy}" width="${g.dw}" height="${g.dh}" rx="${g.drx}"/>`);
  return { kind: 'rect', r: Math.min(g.dw, g.dh) / 2, rx: g.dw / 2, ry: g.dh / 2, y0: dy, y1: dy + g.dh };
}

function ticksRing(cx, cy, r1, r2, n, color, out) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 - Math.PI / 2;
    const long = i % (n / 12 >= 1 ? Math.round(n / 12) : 1) === 0;
    const rr = long ? r2 : r2 + (r1 - r2) * 0.45;
    out.push(`<line x1="${cx + Math.cos(a) * (r1 - 2)}" y1="${cy + Math.sin(a) * (r1 - 2)}" x2="${cx + Math.cos(a) * rr}" y2="${cy + Math.sin(a) * rr}" stroke="${color}" stroke-width="${long ? 1.8 : 0.9}"/>`);
  }
}

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
function markers(L, dial, cx, cy, ink, out, shape) {
  if (L.skel) return;
  const rect = dial.kind === 'rect';
  const pos = (i, k) => {
    const a = i / 12 * Math.PI * 2 - Math.PI / 2;
    if (!rect) return [cx + Math.cos(a) * dial.r * k, cy + Math.sin(a) * dial.r * k];
    // auf Rechteck projizieren
    const c = Math.cos(a), s = Math.sin(a);
    const t = Math.min(Math.abs(dial.rx / (c || 1e-9)), Math.abs(dial.ry / (s || 1e-9)));
    return [cx + c * t * k, cy + s * t * k];
  };
  const lume = L.gilt ? '#e8d6a8' : '#f8f8f0';
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * 360;
    if (L.roman) {
      const [x, y] = pos(i, 0.78);
      out.push(`<text x="${x}" y="${y + 4}" font-size="${rect ? 10 : 11}" text-anchor="middle" font-family="Times, Georgia, serif" fill="${ink}">${ROMAN[i]}</text>`);
      continue;
    }
    if ((L.nums && (i % 3 === 0 || shape === 'cushion')) || (L.ex && [0, 3, 6, 9].includes(i) && i !== 0)) {
      if (L.c && (i === 3 || i === 9 || i === 6) && L.c !== 2) continue;
      const [x, y] = pos(i, 0.74);
      out.push(`<text x="${x}" y="${y + 5}" font-size="${L.thin ? 10 : 14}" font-weight="${L.thin ? 300 : 600}" text-anchor="middle" font-family="Helvetica, Arial" fill="${L.ex ? lume : ink}">${i === 0 ? 12 : i}</text>`);
      continue;
    }
    const [x1, y1] = pos(i, 0.94), [x2, y2] = pos(i, i % 3 === 0 ? 0.72 : 0.8);
    if (L.dive || L.ex || L.gilt) {
      if (i % 3 === 0) {
        if (i === 0) out.push(`<path d="M${cx - 6} ${cy - dial.r * 0.92} L${cx + 6} ${cy - dial.r * 0.92} L${cx} ${cy - dial.r * 0.74} Z" fill="${lume}" stroke="#999" stroke-width=".5"/>`);
        else if (!(L.dt && i === 3 && !L.c)) out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lume}" stroke-width="6"/>`);
      } else {
        const [px, py] = pos(i, 0.85);
        out.push(`<circle cx="${px}" cy="${py}" r="4" fill="${lume}" stroke="#999" stroke-width=".5"/>`);
      }
    } else {
      if (L.dt && i === 3 && !L.c) continue;
      out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${i % 3 === 0 ? 3.4 : 2}" stroke-linecap="round" opacity=".9" data-a="${a}"/>`);
    }
  }
  // Minuten-Teilung
  if (!rect && !L.thin) for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = i / 60 * Math.PI * 2 - Math.PI / 2;
    out.push(`<line x1="${cx + Math.cos(a) * dial.r * 0.97}" y1="${cy + Math.sin(a) * dial.r * 0.97}" x2="${cx + Math.cos(a) * dial.r * 0.92}" y2="${cy + Math.sin(a) * dial.r * 0.92}" stroke="${ink}" stroke-width=".6" opacity=".6"/>`);
  }
  if (L.slide) out.push(`<circle cx="${cx}" cy="${cy}" r="${dial.r * 0.99}" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width="5" stroke-dasharray="1 2"/>`);
}

function subdials(L, cx, cy, dial, ink, dark, out) {
  const r = dial.r * 0.24;
  const pts = L.c === 2 ? [[0, -0.42], [0, 0.45]] : [[-0.45, 0.05], [0.45, 0.05], [0, 0.45]];
  for (const [x, y] of pts) {
    const sx = cx + x * dial.r, sy = cy + y * dial.r;
    const fill = L.sub || (dark ? '#2e2e2e' : '#e4e4e4');
    out.push(`<circle cx="${sx}" cy="${sy}" r="${r}" fill="${fill}" stroke="${ink}" stroke-opacity=".4"/>`);
    out.push(`<circle cx="${sx}" cy="${sy}" r="${r}" fill="none" stroke="${L.sub ? '#ddd' : ink}" stroke-opacity=".5" stroke-dasharray="1 2.4"/>`);
    out.push(`<line x1="${sx}" y1="${sy}" x2="${sx + r * 0.6}" y2="${sy - r * 0.55}" stroke="${L.sub ? '#fff' : ink}" stroke-width="1.2"/>`);
  }
}

function hands(L, cx, cy, r, ink, out, gmt) {
  const hand = (deg, len, w, color, tail = 0.15) => {
    const a = deg * Math.PI / 180;
    const x = cx + Math.sin(a) * r * len, y = cy - Math.cos(a) * r * len;
    const tx = cx - Math.sin(a) * r * tail, ty = cy + Math.cos(a) * r * tail;
    return `<line x1="${tx}" y1="${ty}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const handColor = isDark(L.d || '#222') ? '#f2f2f2' : '#1d1d1d';
  const shadow = `<g opacity=".25" transform="translate(1.5 2)">${hand(305, 0.55, 5, '#000')}${hand(60, 0.82, 3.5, '#000')}</g>`;
  out.push(shadow);
  if (gmt) out.push(hand(140, 0.86, 1.6, '#c62a22') + (() => { const a = 140 * Math.PI / 180; const x = cx + Math.sin(a) * r * 0.86, y = cy - Math.cos(a) * r * 0.86; return `<circle cx="${x}" cy="${y}" r="3.2" fill="#c62a22"/>`; })());
  out.push(hand(305, 0.55, 5.4, handColor));
  out.push(hand(60, 0.82, 3.6, handColor));
  if (!L.thin && !L.lange) out.push(hand(200, 0.9, 1.1, L.c ? '#c62a22' : (L.dive ? '#d23' : handColor), 0.22));
  out.push(`<circle cx="${cx}" cy="${cy}" r="3.4" fill="${handColor}" stroke="#000" stroke-opacity=".3"/>`);
  void ink;
}

function strap(L, id, shape) {
  const top = shape === 'tonneau' ? 58 : 60, x = 100 - 33, w = 66;
  const bandY1 = 0, bandH = 80, bandY2 = 180;
  const parts = [];
  if (L.st === 'br' || L.st === 'jub' || L.st === 'int') {
    const cols = L.st === 'jub' ? 5 : 3;
    for (const y0 of [bandY1, bandY2]) {
      parts.push(`<rect x="${x}" y="${y0}" width="${w}" height="${bandH}" fill="url(#${id}b)"/>`);
      for (let y = y0 + 6; y < y0 + bandH; y += L.st === 'int' ? 9 : 12) parts.push(`<line x1="${x}" x2="${x + w}" y1="${y}" y2="${y}" stroke="#000" stroke-opacity=".22"/>`);
      for (let c = 1; c < cols; c++) parts.push(`<line x1="${x + w * c / cols}" x2="${x + w * c / cols}" y1="${y0}" y2="${y0 + bandH}" stroke="#000" stroke-opacity=".2"/>`);
    }
  } else {
    const col = L.st === 'ru' ? '#1b1b1b' : L.st === 'nato' ? '#4f5a3a' : (L.strap || '#5b3a22');
    for (const y0 of [bandY1, bandY2]) {
      parts.push(`<rect x="${x + 3}" y="${y0}" width="${w - 6}" height="${bandH}" rx="${y0 ? 0 : 0}" fill="${col}"/>`);
      parts.push(`<rect x="${x + 3}" y="${y0}" width="${(w - 6) / 2}" height="${bandH}" fill="#fff" opacity=".07"/>`);
      if (L.st === 'le') parts.push(`<rect x="${x + 7}" y="${y0 - 4}" width="${w - 14}" height="${bandH + 8}" fill="none" stroke="#e8dcc8" stroke-opacity=".5" stroke-dasharray="3 3"/>`);
      if (L.st === 'nato') parts.push(`<rect x="${x + 3 + (w - 6) * 0.42}" y="${y0}" width="${(w - 6) * 0.16}" height="${bandH}" fill="#8b8f66"/>`);
      if (L.st === 'ru') for (let y = y0 + 8; y < y0 + bandH; y += 10) parts.push(`<line x1="${x + 10}" x2="${x + w - 10}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".06" stroke-width="3"/>`);
    }
  }
  void top;
  return parts.join('');
}

function shade(hex, amt) {
  const n = parseInt(hex.replace('#', '').padEnd(6, hex.slice(-1)), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = v => clamp(Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function isDark(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

// Damit nicht jedes Mal neu gezeichnet wird (Schneeflocken wären sonst immer anders)
const svgCache = new Map();
function watchImg(mId) {
  if (!svgCache.has(mId)) svgCache.set(mId, watchSVG(MODEL[mId]));
  return svgCache.get(mId);
}

/* =====================================================================
   Kursgrafik
   ===================================================================== */
function chartSVG(series, w = 900, h = 280) {
  const pad = { l: 8, r: 64, t: 12, b: 20 };
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const X = i => pad.l + i / (series.length - 1) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const pts = series.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const up = series[series.length - 1] >= series[0];
  const col = up ? '#3c8f18' : '#c2281f';
  const id = 'c' + (++gid);
  const grid = [0, 0.5, 1].map(f => {
    const v = min + span * (1 - f); const y = pad.t + f * (h - pad.t - pad.b);
    return `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#e3e3e3"/><text x="${w - pad.r + 6}" y="${y + 4}" font-size="11" fill="#888" font-family="Helvetica">${esc(fmtEur(v, span < 20 ? 2 : 0))}</text>`;
  }).join('');
  const lx = X(series.length - 1), ly = Y(series[series.length - 1]);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Preisverlauf">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <polygon points="${pad.l},${h - pad.b} ${pts} ${lx},${h - pad.b}" fill="url(#${id})"/>
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="4" fill="#fff" stroke="${col}" stroke-width="2"/>
    <text x="${pad.l}" y="${h - 4}" font-size="11" fill="#888" font-family="Helvetica">vor ${series.length - 1} Tagen</text>
    <text x="${w - pad.r}" y="${h - 4}" font-size="11" fill="#888" text-anchor="end" font-family="Helvetica">heute</text>
  </svg>`;
}

function sparkSVG(series) {
  const w = 80, h = 24;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1) * w).toFixed(1)},${(2 + (1 - (v - min) / span) * (h - 4)).toFixed(1)}`).join(' ');
  const col = series[series.length - 1] >= series[0] ? '#3c8f18' : '#c2281f';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6"/></svg>`;
}

/* =====================================================================
   Oberfläche
   ===================================================================== */
const view = $('#view');
const UI = { brand: '', cat: '', cond: -1, papers: false, max: 0, sort: 'neu', q: '', range: 30, show: 24, shopTab: 'fenster' };

function toast(html, ms = 4200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function flashWallet() {
  const w = $('.wallet'); if (!w) return;
  w.classList.add('flash'); setTimeout(() => w.classList.remove('flash'), 900);
}

const heartIcon = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
function heartBtn(mId) {
  const on = S.watch.includes(mId);
  return `<button class="heart-btn ${on ? 'on' : ''}" data-act="watch" data-m="${mId}" aria-label="${on ? 'Von Merkliste entfernen' : 'Merken'}" title="Merken">${heartIcon}</button>`;
}
const condBadge = c => `<span class="badge ${COND[c].color}">${COND[c].name}</span>`;
function dealBadge(l) {
  const r = l.price / valueOf(l.m, l.cond, l.papers);
  if (r <= 0.9) return `<span class="badge green">${Math.round((1 - r) * 100)} % unter Wert</span>`;
  if (r >= 1.1) return `<span class="badge red">über Wert</span>`;
  return '';
}

function listingCard(l) {
  const m = MODEL[l.m];
  return `<a class="card" href="#/angebot/${l.id}">
    <span class="heart">${heartBtn(l.m)}</span>
    <div class="shot">${watchImg(l.m)}</div>
    <div class="brandname">${esc(m.brand)}</div>
    <div class="model">${esc(m.name)}</div>
    <div class="ref">Ref. ${esc(m.ref)} · ${l.year}</div>
    <div class="meta">${condBadge(l.cond)}${l.papers ? '<span class="badge light">Box &amp; Papiere</span>' : ''}${dealBadge(l)}</div>
    <div class="price">${fmtEur(l.price)}</div>
  </a>`;
}

function updateTop() {
  $('#wallet-money').textContent = fmtEur(S.money);
  $('#day-label').textContent = `Markttag ${S.day}`;
  const route = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) || '';
  document.querySelectorAll('.globalnav a[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === route && route !== ''));
}

/* ---------- Seiten ---------- */
function pageHome() {
  const cv = collectionValue(), nw = netWorth();
  const li = levelIdx(cv); const next = LEVELS[li + 1];
  const prog = next ? clamp((cv - LEVELS[li].min) / (next.min - LEVELS[li].min), 0, 1) : 1;
  const hero = S.owned.length ? [...S.owned].sort((a, b) => itemValue(b) - itemValue(a))[0].m : 'rolex-sub';
  const heroM = MODEL[hero];
  const movers = MODELS.map(m => ({ m, c: changeOver(m.id, 7) })).sort((a, b) => b.c - a.c);
  const top = [...movers.slice(0, 3), ...movers.slice(-3).reverse()];
  const fresh = [...S.listings].sort((a, b) => b.day - a.day).slice(0, 4);
  const bonusReady = S.lastBonus !== todayStr();
  const jobLeft = Math.max(0, Math.ceil((S.jobReady - Date.now()) / 1000));
  return `
  <section class="hero">
    <div>
      <h1>Hallo <b>${esc(S.name)}</b>.</h1>
      <p>${S.owned.length ? `Deine wertvollste Uhr: die <b>${esc(heroM.brand)} ${esc(heroM.name)}</b> – aktuell rund ${fmtEur(price(hero))} wert.` : 'Deine Sammlung ist noch leer. Starte mit einem bezahlbaren Klassiker und arbeite dich zur Traumuhr hoch.'}</p>
      <div class="btn-row">
        <a class="btn blue big" href="#/markt">Zum Marktplatz</a>
        <a class="btn big" href="#/auktionen">Live-Auktionen</a>
      </div>
    </div>
    <div class="product">${watchImg(hero)}<div class="reflect" aria-hidden="true">${watchImg(hero)}</div></div>
  </section>

  <div class="stats">
    <div class="stat"><small>Kontostand</small><strong>${fmtEur(S.money)}</strong></div>
    <div class="stat"><small>Sammlungswert</small><strong>${fmtEur(cv)}</strong><div class="sub muted">${S.owned.length} Uhr${S.owned.length === 1 ? '' : 'en'}</div></div>
    <div class="stat"><small>Gesamtvermögen</small><strong>${fmtEur(nw)}</strong><div class="sub ${nw >= START_MONEY ? 'up' : 'down'}">${fmtPct(nw / START_MONEY - 1)} seit Start</div></div>
    <div class="stat"><small>Stufe</small><strong>${LEVELS[li].name}</strong>
      <div class="progress"><span style="width:${(prog * 100).toFixed(1)}%"></span></div>
      <div class="sub muted">${next ? `nächste: ${next.name} ab ${fmtEur(next.min)}` : 'höchste Stufe!'}</div></div>
  </div>

  <div class="cols">
    <div class="panel">
      <div class="panel-head"><h2>Tagesbonus</h2></div>
      <div class="job">
        <div>${bonusReady ? `Heute gibt’s <b>${fmtEur(dailyBonus())}</b> geschenkt.` : 'Schon abgeholt – morgen wieder!'}</div>
        <button class="btn green" data-act="bonus" ${bonusReady ? '' : 'disabled'}>Abholen</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Nebenjob in der Werkstatt</h2></div>
      <div class="job">
        <div>Armbänder reinigen: <b>+${fmtEur(jobPay())}</b> alle 10 Sek.</div>
        <button class="btn" data-act="job" id="job-btn" ${jobLeft ? 'disabled' : ''}>${jobLeft ? `Noch ${jobLeft} s` : 'Polieren'}</button>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><h2>Rangliste der Sammler</h2><a href="#/profil">Ganze Liste ›</a></div>
    ${rankingHTML(true)}
  </div>

  <div class="panel">
    <div class="panel-head"><h2>Neu eingetroffen</h2><a href="#/markt">Alle Angebote ›</a></div>
    <div class="grid">${fresh.map(listingCard).join('')}</div>
  </div>

  <div class="cols">
    <div class="panel">
      <div class="panel-head"><h2>Marktbewegungen (7 Tage)</h2></div>
      <ul class="list">${top.map(({ m, c }) => `
        <li><a class="thumb" href="#/modell/${m.id}">${watchImg(m.id)}</a>
          <div class="grow"><a class="title" href="#/modell/${m.id}">${esc(m.brand)} ${esc(m.name)}</a><div class="sub">${fmtEur(price(m.id))}</div></div>
          ${sparkSVG(S.prices[m.id].slice(-8))}
          <span class="${c >= 0 ? 'up' : 'down'} nowrap">${fmtPct(c)}</span></li>`).join('')}
      </ul>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Uhren-News</h2></div>
      <ul class="list news">${S.news.slice(0, 7).map(n => `<li><span class="badge dark day">Tag ${n.day}</span><div class="grow">${esc(n.text)}</div></li>`).join('')}</ul>
    </div>
  </div>`;
}

function dailyBonus() { return niceRound(250 + Math.min(5000, collectionValue() * 0.005)); }
function jobPay() { return 20 + levelIdx(collectionValue()) * 15; }

function filteredListings() {
  const q = UI.q.trim().toLowerCase();
  let arr = S.listings.filter(l => {
    const m = MODEL[l.m];
    if (UI.brand && m.brand !== UI.brand) return false;
    if (UI.cat && m.cat !== UI.cat) return false;
    if (UI.cond >= 0 && l.cond > UI.cond) return false;
    if (UI.papers && !l.papers) return false;
    if (UI.max && l.price > UI.max) return false;
    if (q && !`${m.brand} ${m.name} ${m.ref} ${m.cat}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const deal = l => l.price / valueOf(l.m, l.cond, l.papers);
  const sorts = {
    neu: (a, b) => b.day - a.day,
    auf: (a, b) => a.price - b.price,
    ab: (a, b) => b.price - a.price,
    deal: (a, b) => deal(a) - deal(b),
  };
  return arr.sort(sorts[UI.sort] || sorts.neu);
}

function activeFilters() { return (UI.cat ? 1 : 0) + (UI.max ? 1 : 0) + (UI.cond >= 0 ? 1 : 0) + (UI.papers ? 1 : 0); }

function pageMarket() {
  const list = filteredListings();
  const brandCount = b => S.listings.filter(l => MODEL[l.m].brand === b).length;
  const maxOpts = [0, 500, 2000, 5000, 10000, 25000, 50000, 100000];
  return `
  <div class="market">
    <aside class="sidebar ${UI.filtersOpen ? '' : 'sticky'}">
      <h4>Marken</h4>
      <div class="brand-list">
      <button class="src ${UI.brand === '' ? 'on' : ''}" data-act="f-brand" data-v="">Alle Marken <span class="count">${S.listings.length}</span></button>
      ${BRANDS.map(b => { const n = brandCount(b); return n ? `<button class="src ${UI.brand === b ? 'on' : ''}" data-act="f-brand" data-v="${esc(b)}">${esc(b)} <span class="count">${n}</span></button>` : ''; }).join('')}
      </div>
      <button class="filter-toggle" data-act="f-toggle">⚙︎ Filter${activeFilters() ? ` (${activeFilters()})` : ''} <span>${UI.filtersOpen ? '▲' : '▼'}</span></button>
      <div class="more-filters ${UI.filtersOpen ? 'open' : ''}">
      <div><h4>Kategorie</h4>
      <div class="field"><select data-act="f-cat" aria-label="Kategorie"><option value="">Alle</option>${CATS.map(c => `<option ${UI.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      </div><div><h4>Preis bis</h4>
      <div class="field"><select data-act="f-max" aria-label="Höchstpreis">${maxOpts.map(v => `<option value="${v}" ${UI.max === v ? 'selected' : ''}>${v ? fmtEur(v) : 'egal'}</option>`).join('')}</select></div>
      </div><div><h4>Zustand mindestens</h4>
      <div class="field"><select data-act="f-cond" aria-label="Zustand"><option value="-1">egal</option>${COND.map((c, i) => `<option value="${i}" ${UI.cond === i ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
      </div><div><h4>Extras</h4>
      <label class="check"><input type="checkbox" data-act="f-papers" ${UI.papers ? 'checked' : ''}> Nur mit Box &amp; Papieren</label></div>
      </div>
    </aside>
    <section>
      <div class="toolbar">
        <span class="count">${list.length} Angebot${list.length === 1 ? '' : 'e'}${UI.q ? ` für „${esc(UI.q)}“ <a href="#" data-act="clear-q">✕</a>` : ''}</span>
        <div class="segmented" role="group" aria-label="Sortierung">
          ${[['neu', 'Neueste'], ['auf', 'Preis ↑'], ['ab', 'Preis ↓'], ['deal', 'Schnäppchen']].map(([k, n]) => `<button data-act="sort" data-v="${k}" class="${UI.sort === k ? 'on' : ''}">${n}</button>`).join('')}
        </div>
      </div>
      ${list.length ? `<div class="grid">${list.slice(0, UI.show).map(listingCard).join('')}</div>${list.length > UI.show ? `<div class="center" style="margin:16px 0"><button class="btn big" data-act="more">Weitere ${Math.min(24, list.length - UI.show)} Angebote anzeigen</button></div>` : ''}` : '<div class="empty">Keine passenden Angebote. Morgen kommen neue rein!</div>'}
    </section>
  </div>`;
}

function chartPanel(mId) {
  const h = S.prices[mId];
  const series = h.slice(-UI.range - 1);
  const ch = series[series.length - 1] / series[0] - 1;
  return `<div class="panel">
    <div class="panel-head"><h2>Marktwert-Verlauf</h2>
      <div class="segmented">${[[7, '7 T'], [30, '30 T'], [89, '90 T']].map(([d, n]) => `<button data-act="range" data-v="${d}" class="${UI.range === d ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <div class="chart-head"><span class="big">${fmtEur(price(mId))}</span><span class="${ch >= 0 ? 'up' : 'down'}">${fmtPct(ch)}</span>
      <span class="muted">Hoch ${fmtEur(Math.max(...series))} · Tief ${fmtEur(Math.min(...series))}</span></div>
    ${chartSVG(series)}
    <p class="muted" style="font-size:12px;margin:6px 0 0">Marktwert für „Sehr gut“ mit Box &amp; Papieren.</p>
  </div>`;
}

function specRows(m, extra = []) {
  return [
    ['Marke', m.brand], ['Modell', m.name], ['Referenz', m.ref], ['Kategorie', m.cat],
    ['Durchmesser', `${String(m.diam).replace('.', ',')} mm`], ['Material', m.material], ...extra,
  ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

function pageListing(id) {
  const l = S.listings.find(x => x.id === id);
  if (!l) return `<div class="panel empty"><h2>Schon weg!</h2><p>Dieses Angebot wurde leider schon verkauft.</p><a class="btn blue" href="#/markt">Zurück zum Marktplatz</a></div>`;
  const m = MODEL[l.m];
  const val = valueOf(l.m, l.cond, l.papers);
  const similar = S.listings.filter(x => x.id !== l.id && (x.m === l.m || MODEL[x.m].brand === m.brand)).slice(0, 4);
  const offerUsed = l.offered === S.day;
  return `
  <div class="crumbs"><a href="#/">Start</a> › <a href="#/markt">Marktplatz</a> › <a href="#/markt" data-act="f-brand-go" data-v="${esc(m.brand)}">${esc(m.brand)}</a> › ${esc(m.name)}</div>
  <div class="panel">
    <div class="detail">
      <div class="product">${watchImg(l.m)}<div class="reflect" aria-hidden="true">${watchImg(l.m)}</div></div>
      <div>
        <div class="brandname">${esc(m.brand)}</div>
        <h1>${esc(m.name)}</h1>
        <div class="muted">Ref. ${esc(m.ref)} · Baujahr ${l.year}</div>
        <div class="meta" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${condBadge(l.cond)}${l.papers ? '<span class="badge light">Box &amp; Papiere</span>' : '<span class="badge light">ohne Papiere</span>'}${dealBadge(l)}</div>
        <div class="bigprice">${fmtEur(l.price)}</div>
        <div class="muted" style="font-size:12px">Geschätzter Marktwert: ${fmtEur(val)} · Verkäufer: ${esc(l.seller)} (${esc(l.city)})${l.dealer ? ' <span class="badge blue">Händler</span>' : ''}</div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn blue big" data-act="buy" data-id="${l.id}">Kaufen</button>
          <button class="btn big" data-act="offer" data-id="${l.id}" ${offerUsed ? 'disabled' : ''}>${offerUsed ? 'Vorschlag gesendet' : 'Preisvorschlag'}</button>
          ${heartBtn(l.m)}
        </div>
        ${l.dealer ? `<div class="trust">
          <div>Echtheit von Chronothek-Uhrmachern geprüft</div>
          <div>Versicherter Versand, 14 Tage Rückgabe</div>
          <div>Käuferschutz: Geld erst nach Prüfung beim Verkäufer</div>
        </div>` : `<div class="trust warn">
          <div>Privatverkauf – Echtheitsprüfung nicht inklusive</div>
          ${l.papers ? '<div>Box &amp; Papiere vorhanden</div>' : '<div>Ohne Papiere: Fälschungen kommen vor!</div>'}
        </div>`}
        ${l.flash ? `<div class="flash-inline">⚡ Blitz-Deal – endet in <span class="timer" data-ends="${l.flash}">${fmtTime(Math.max(0, Math.ceil((l.flash - Date.now()) / 1000)))}</span></div>` : ''}
        <table class="specs">${specRows(m, [['Zustand', COND[l.cond].name], ['Lieferumfang', l.papers ? 'Box, Papiere' : 'nur Uhr'], ['Inseriert', `Markttag ${Math.max(1, l.day)}`]])}</table>
      </div>
    </div>
  </div>
  ${chartPanel(l.m)}
  ${similar.length ? `<div class="panel"><div class="panel-head"><h2>Das könnte dir auch gefallen</h2></div><div class="grid">${similar.map(listingCard).join('')}</div></div>` : ''}`;
}

function pageModel(mId) {
  const m = MODEL[mId];
  if (!m) return '<div class="panel empty">Modell nicht gefunden.</div>';
  const ls = S.listings.filter(l => l.m === mId);
  const own = S.owned.filter(o => o.m === mId).length;
  return `
  <div class="crumbs"><a href="#/">Start</a> › Modelle › ${esc(m.brand)} ${esc(m.name)}</div>
  <div class="panel">
    <div class="detail">
      <div class="product">${watchImg(mId)}<div class="reflect" aria-hidden="true">${watchImg(mId)}</div></div>
      <div>
        <div class="brandname">${esc(m.brand)}</div>
        <h1>${esc(m.name)}</h1>
        <div class="muted">Ref. ${esc(m.ref)} · seit ${m.year}</div>
        <div class="bigprice">${fmtEur(price(mId))}</div>
        <div class="${changeOver(mId, 30) >= 0 ? 'up' : 'down'}">${fmtPct(changeOver(mId, 30))} in 30 Tagen</div>
        <div class="btn-row" style="margin-top:14px">${heartBtn(mId)} <span class="muted">${own ? `Du besitzt ${own}×` : 'Nicht in deiner Sammlung'}</span></div>
        <table class="specs">${specRows(m)}</table>
      </div>
    </div>
  </div>
  ${chartPanel(mId)}
  <div class="panel"><div class="panel-head"><h2>Aktuelle Angebote (${ls.length})</h2></div>
    ${ls.length ? `<div class="grid">${ls.map(listingCard).join('')}</div>` : '<div class="empty">Gerade nicht im Angebot. Setz sie auf die Merkliste und schau später wieder rein.</div>'}</div>`;
}

function aucCard(a) {
  const m = MODEL[a.m];
  const left = Math.max(0, Math.ceil((a.ends - Date.now()) / 1000));
  const s1 = a.bid + aucStep(a.bid);
  let s5 = a.bid; for (let i = 0; i < 5; i++) s5 += aucStep(s5);
  return `<div class="card auction" data-auc="${a.id}">
    <span class="heart">${heartBtn(a.m)}</span>
    <a class="shot" href="#/modell/${a.m}">${watchImg(a.m)}</a>
    <div class="brandname">${esc(m.brand)}</div>
    <div class="model">${esc(m.name)}</div>
    <div class="meta">${condBadge(a.cond)}${a.papers ? '<span class="badge light">Papiere</span>' : ''}</div>
    <div class="timer ${left < 30 ? 'hot' : ''}" data-ends="${a.ends}">${fmtTime(left)}</div>
    <div class="bid">${fmtEur(a.bid)}</div>
    <div class="bidinfo">${a.me ? '<span class="badge green">Du führst!</span>' : a.bids ? `${a.bids} Gebot${a.bids === 1 ? '' : 'e'} · ${esc(a.lead)}` : 'Startpreis'}</div>
    <div class="muted" style="font-size:11px">Marktwert ca. ${fmtEur(valueOf(a.m, a.cond, a.papers))}</div>
    <div class="btn-row">
      <button class="btn blue small" data-act="bid" data-id="${a.id}" data-n="1" ${a.me ? 'disabled' : ''}>${fmtEur(s1)}</button>
      <button class="btn small" data-act="bid" data-id="${a.id}" data-n="5">${fmtEur(s5)}</button>
    </div>
  </div>`;
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function pageAuctions() {
  return `
  <div class="panel">
    <div class="panel-head"><h2>Live-Auktionen</h2><span class="muted" style="font-size:12px">5 % Aufgeld · Gebote in den letzten 20 s verlängern</span></div>
    <p class="muted" style="margin-top:0">Hier kannst du Uhren oft unter Marktwert ergattern – aber andere Sammler bieten mit. Bezahlt wird erst beim Zuschlag.</p>
    <div class="grid" id="auc-grid">${[...S.auctions].sort((a, b) => a.ends - b.ends).map(aucCard).join('')}</div>
  </div>`;
}

function pageCollection() {
  const items = [...S.owned].sort((a, b) => itemValue(b) - itemValue(a));
  const cv = collectionValue();
  const cost = S.owned.reduce((s, o) => s + o.cost, 0);
  const slots = Math.max(8, Math.ceil((items.length + 1) / 4) * 4);
  return `
  <div class="stats">
    <div class="stat"><small>Sammlungswert</small><strong>${fmtEur(cv)}</strong></div>
    <div class="stat"><small>Einkaufswert</small><strong>${fmtEur(cost)}</strong></div>
    <div class="stat"><small>Gewinn / Verlust</small><strong class="${cv - cost >= 0 ? 'up' : 'down'}">${fmtEur(cv - cost)}</strong></div>
    <div class="stat"><small>Realisiert</small><strong class="${S.stats.profit >= 0 ? 'up' : 'down'}">${fmtEur(S.stats.profit)}</strong><div class="sub muted">${S.stats.sold} verkauft</div></div>
  </div>
  <div class="watchbox">
    <div class="watchbox-lid"><span>${esc(S.name)}s Uhrenbox</span><span>${items.length} Uhr${items.length === 1 ? '' : 'en'}</span></div>
    <div class="watchbox-inner">
      ${items.map(o => `<button class="cushion" data-act="item" data-id="${o.id}">
        ${o.bot ? '<span class="tag badge dark">Bot</span>' : o.shop ? '<span class="tag badge green">Im Laden</span>' : o.ask ? '<span class="tag badge blue">Inseriert</span>' : o.service ? '<span class="tag badge gold">Revision</span>' : ''}
        ${watchImg(o.m)}<span class="lbl">${esc(MODEL[o.m].brand)} ${esc(MODEL[o.m].name)}</span></button>`).join('')}
      ${Array.from({ length: slots - items.length }, () => '<div class="cushion empty-slot"></div>').join('')}
    </div>
  </div>
  ${items.length ? `<div class="panel"><div class="panel-head"><h2>Depot-Übersicht</h2></div>
    <div class="table-wrap"><table class="table">
      <tr><th>Uhr</th><th>Zustand</th><th class="num">Gekauft</th><th class="num">Wert</th><th class="num">G/V</th><th></th></tr>
      ${items.map(o => { const v = itemValue(o); return `<tr>
        <td><a href="#/modell/${o.m}">${esc(MODEL[o.m].brand)} ${esc(MODEL[o.m].name)}</a><div class="muted" style="font-size:11px">${o.papers ? 'mit Papieren' : 'ohne Papiere'} · ${esc(o.source)}</div></td>
        <td>${condBadge(o.cond)}</td>
        <td class="num">${fmtEur(o.cost)}</td><td class="num">${fmtEur(v)}</td>
        <td class="num ${v - o.cost >= 0 ? 'up' : 'down'}">${fmtPct(v / o.cost - 1)}</td>
        <td class="num"><button class="btn small" data-act="item" data-id="${o.id}">Verwalten</button></td></tr>`; }).join('')}
    </table></div></div>` : `<div class="panel empty">Noch keine Uhren. <a href="#/markt">Jetzt stöbern ›</a></div>`}`;
}

function pageWatchlist() {
  const ids = S.watch;
  return `<div class="panel"><div class="panel-head"><h2>Merkliste</h2></div>
    ${ids.length ? `<ul class="list">${ids.map(id => { const m = MODEL[id]; const n = S.listings.filter(l => l.m === id).length; const c = changeOver(id, 30); return `
      <li><a class="thumb" href="#/modell/${id}">${watchImg(id)}</a>
        <div class="grow"><a class="title" href="#/modell/${id}">${esc(m.brand)} ${esc(m.name)}</a><div class="sub">Ref. ${esc(m.ref)} · ${n ? `<b>${n} Angebot${n === 1 ? '' : 'e'}</b>` : 'kein Angebot'}</div></div>
        ${sparkSVG(S.prices[id].slice(-30))}
        <div style="text-align:right"><div>${fmtEur(price(id))}</div><div class="${c >= 0 ? 'up' : 'down'}" style="font-size:12px">${fmtPct(c)}</div></div>
        ${heartBtn(id)}</li>`; }).join('')}</ul>`
      : '<div class="empty">Tippe bei einer Uhr auf das Herz, um sie hier zu sammeln. Du siehst dann sofort, wenn sie im Angebot ist.</div>'}
  </div>
  <div class="panel"><div class="panel-head"><h2>Alle Modelle</h2></div>
    <div class="table-wrap"><table class="table">
      <tr><th>Modell</th><th class="num">Marktwert</th><th class="num">30 Tage</th><th></th></tr>
      ${[...MODELS].sort((a, b) => price(b.id) - price(a.id)).map(m => `<tr><td><a href="#/modell/${m.id}">${esc(m.brand)} ${esc(m.name)}</a></td><td class="num">${fmtEur(price(m.id))}</td><td class="num ${changeOver(m.id, 30) >= 0 ? 'up' : 'down'}">${fmtPct(changeOver(m.id, 30))}</td><td class="num">${heartBtn(m.id)}</td></tr>`).join('')}
    </table></div></div>`;
}

function pageBot() {
  const B = S.bot, mode = BOT_MODES[B.mode] || BOT_MODES[1];
  const items = botItems();
  const inUse = botInUse();
  const net = botNet();
  const maxBudget = Math.max(1000, Math.ceil((S.money + inUse) / 500) * 500);
  const share = Math.round(botShare() * 100);
  return `
  <section class="hero bot-hero">
    <div>
      <h1>Trading-<b>Bot</b> <span class="badge gold" style="vertical-align:middle">${botTier()}</span></h1>
      <p>Lass den Bot für dich handeln: Er scannt jeden Markttag alle Angebote, kauft Schnäppchen und verkauft sie mit Gewinn weiter.</p>
      <p><b>Gratis.</b> Nur wenn er Gewinn macht, behält er <b>${share} %</b> davon. Bei Verlust zahlst du nichts extra.</p>
    </div>
    <div class="bot-switch">
      <button class="switch ${B.on ? 'on' : ''}" data-act="bot-toggle" role="switch" aria-checked="${B.on}" aria-label="Bot an oder aus"><span class="knob"></span><span class="lbl-on">AN</span><span class="lbl-off">AUS</span></button>
      <div class="muted" style="margin-top:8px">${B.on ? 'Bot läuft' : 'Bot ist aus'}</div>
    </div>
  </section>

  <div class="terminal bot-term" aria-label="Bot-Terminal">
    <div class="terminal-bar"><i></i><i></i><i></i><span>chronobot — ${botTier().toLowerCase()} — ${B.on ? 'aktiv' : 'pausiert'}</span></div>
    <div class="terminal-body">
      ${B.log.slice(0, 7).reverse().map(n => `<div><span class="t-dim">[Tag ${n.day}]</span> ${esc(n.text)}</div>`).join('') || '<div class="t-dim">Noch keine Aktionen.</div>'}
      <div id="bot-live" class="t-live">${B.on ? '&gt; starte Scan …' : '&gt; Bot pausiert. Schalter oben umlegen.'}</div>
      <div id="bot-con">${CON.map(conLine).join('')}</div>
      <form data-form="botcmd" class="t-prompt"><label for="bot-cmd">chronobot $</label><input id="bot-cmd" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="z. B. deals, kaufe rolex, verkaufen …"></form>
    </div>
    ${botMenuHTML()}
  </div>

  <div class="cols">
    <div class="panel"><div class="panel-head"><h2>Einstellungen</h2></div>
      <h3>Strategie</h3>
      <div class="segmented">${BOT_MODES.map((m, i) => `<button data-act="bot-mode" data-v="${i}" class="${B.mode === i ? 'on' : ''}">${m.name}</button>`).join('')}</div>
      <p class="muted" style="font-size:12px">${mode.desc}</p>
      <h3>Meldungen vom Bot</h3>
      <div class="segmented">${BOT_NOTIFY.map((n, i) => `<button data-act="bot-notify" data-v="${i}" class="${B.notify === i ? 'on' : ''}">${n}</button>`).join('')}</div>
      <p class="muted" style="font-size:12px">${['Keine Einblendungen – alles steht nur im Terminal.', 'Eine kurze Meldung pro Markttag (z. B. „3 gekauft, 2 verkauft“).', 'Jeder Kauf und Verkauf wird eingeblendet.'][B.notify]}</p>
      <h3>Budget</h3>
      <div class="center" style="font-size:22px;font-weight:300" id="budget-val">${fmtEur(B.budget)}</div>
      <input type="range" data-act="f-budget" id="budget-range" min="500" max="${maxBudget}" step="500" value="${Math.min(B.budget, maxBudget)}">
      ${S.shop ? `<h3>Laden beliefern</h3><label class="check"><input type="checkbox" data-act="bot-stock" ${B.stock ? 'checked' : ''}> Schnäppchen in meinen Laden legen</label>` : ''}
      <p class="muted" style="font-size:12px">So viel darf der Bot höchstens gleichzeitig in Uhren stecken. Gerade gebunden: <b>${fmtEur(inUse)}</b>.</p>
    </div>
    <div class="panel"><div class="panel-head"><h2>Ergebnis</h2></div>
      <table class="sum">
        <tr><td>Abgeschlossene Trades</td><td>${B.trades}</td></tr>
        <tr><td>Gewinne</td><td class="up">${fmtEur(B.gross)}</td></tr>
        <tr><td>Verluste</td><td class="${B.losses ? 'down' : ''}">${B.losses ? fmtEur(-B.losses) : fmtEur(0)}</td></tr>
        <tr><td>Bot-Anteil</td><td>${B.fees ? fmtEur(-B.fees) : fmtEur(0)}</td></tr>
        <tr class="total"><td>Dein Netto</td><td class="${net >= 0 ? 'up' : 'down'}">${fmtEur(net)}</td></tr>
      </table>
      ${B.hist.length > 2 ? chartSVG(B.hist.slice(-60), 480, 200) : '<p class="muted" style="font-size:12px">Die Gewinnkurve erscheint nach ein paar Markttagen.</p>'}
    </div>
  </div>

  <div class="panel"><div class="panel-head"><h2>Bot-Upgrades</h2><span class="muted" style="font-size:12px">einmal kaufen, wirkt für immer</span></div>
    <div class="up-grid">${BOT_UPS.map(u => {
      const lvl = B.up[u.k] || 0, maxed = lvl >= u.max, cost = botUpCost(u, lvl);
      return `<div class="up-card ${maxed ? 'maxed' : ''}">
        <div class="up-icon">${u.icon}</div>
        <div class="up-name">${u.name}</div>
        <div class="up-lvl">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        <div class="up-desc">${esc(u.desc(lvl))}</div>
        ${maxed ? '<span class="badge gold">Maximal</span>' : `<div class="up-next muted">Nächste Stufe: ${esc(u.desc(lvl + 1))}</div>
        <button class="btn ${S.money >= cost ? 'blue' : ''} small" data-act="bot-up" data-k="${u.k}" ${S.money >= cost ? '' : 'disabled'}>${fmtEur(cost)}</button>`}
      </div>`; }).join('')}</div>
  </div>

  <div class="panel"><div class="panel-head"><h2>Positionen des Bots (${items.length})</h2></div>
    ${items.length ? `<div class="table-wrap"><table class="table">
      <tr><th>Uhr</th><th>Zustand</th><th class="num">Gekauft</th><th class="num">Wert</th><th class="num">Verkaufspreis</th><th></th></tr>
      ${items.map(o => `<tr><td><a href="#/modell/${o.m}">${esc(MODEL[o.m].brand)} ${esc(MODEL[o.m].name)}</a></td><td>${condBadge(o.cond)}</td>
        <td class="num">${fmtEur(o.cost)}</td><td class="num">${fmtEur(itemValue(o))}</td><td class="num">${o.service ? 'in Revision' : o.shop ? `🏪 ${fmtEur(o.shop)}` : o.ask ? fmtEur(o.ask) : '–'}</td>
        <td class="num"><button class="btn small" data-act="item" data-id="${o.id}">Verwalten</button></td></tr>`).join('')}
    </table></div>` : '<div class="empty">Noch keine Positionen. Schalte den Bot ein – er kauft ab dem nächsten Markttag.</div>'}
  </div>
  <p class="muted" style="font-size:11px">Hinweis: Das ist ein Spiel. Echte „Trading-Bots“, die Gewinn versprechen, sind oft unseriös – im echten Leben lieber vorsichtig sein.</p>`;
}

/* ---------- Seite: Mein Laden ---------- */
function storeHTML(sh, opts = {}) {
  const th = SHOP_THEMES.find(t => t.k === sh.theme) || SHOP_THEMES[0];
  const items = opts.demo ? ['rolex-sub', 'omega-speedmaster', 'cartier-tank-must', 'tudor-bb58'].map(m => ({ m, shop: price(m) })) : shopItems();
  const slots = opts.demo ? 4 : shopSlots();
  const deco = SHOP_DECO.filter(d => sh.deco[d.k]);
  const vis = opts.demo ? 3 : Math.min(5, Math.ceil((sh.visitors || 0) / 8));
  const people = ['🚶', '🚶‍♀️', '🧍', '🚶‍♂️', '🧍‍♀️'];
  return `<div class="store theme-${th.k} floor-${sh.floor} vit-${sh.vit} light-${sh.light}${sh.closed ? ' closed' : ''}" style="--wall:${th.wall};--wall2:${th.wall2};--acc:${th.accent};--txt:${th.text};--sign:${SHOP_SIGNS[sh.sign] || SHOP_SIGNS[0]}">
    <div class="store-awning"></div>
    <div class="store-sign" style="font-family:${th.font}"><span>${esc(sh.name)}</span><small>Uhren · An- &amp; Verkauf</small></div>
    <div class="store-window">
      <div class="store-room">
        <div class="store-shelf">${Array.from({ length: Math.min(slots, 8) }, (_, i) => { const o = items[i]; return `<div class="store-case">${o ? `${watchImg(o.m)}<span class="store-price">${!opts.demo && shopSale() ? `<s>${fmtEur(o.shop)}</s> ${fmtEur(salePrice(o))}` : fmtEur(o.shop)}</span>${o.bot ? '<span class="store-bot">🤖</span>' : ''}` : ''}</div>`; }).join('')}</div>
        <div class="store-deco">${deco.map(d => `<span title="${esc(d.name)}">${d.icon}</span>`).join('')}</div>
        <div class="store-floor"></div>
        <div class="store-people">${Array.from({ length: vis }, (_, i) => `<span style="animation-delay:${i * -2.3}s;animation-duration:${9 + i * 1.7}s">${people[i % people.length]}</span>`).join('')}</div>
        <div class="store-light"></div>
      </div>
      <div class="store-glass"></div>
      ${!opts.demo && shopSale() ? `<div class="store-sale">SALE −${Math.round(shopSale().pct * 100)} %</div>` : ''}
      ${sh.closed ? '<div class="store-closed">Heute geschlossen</div>' : '<div class="store-open">Geöffnet</div>'}
    </div>
    <div class="store-base"></div>
  </div>`;
}

function stars(v) { const f = Math.round(v * 2) / 2; return `<span class="stars" title="${v.toFixed(1)} von 5">${'★'.repeat(Math.floor(f))}${f % 1 ? '½' : ''}<i>${'★'.repeat(5 - Math.ceil(f))}</i></span>`; }

function pageShop() {
  const sh = S.shop;
  if (!sh) {
    const demo = { name: `${S.name}s Uhren`, theme: 'boutique', sign: 4, floor: 'marmor', vit: 'glas', light: 'spot', deco: { plant: 1, clock: 1 }, visitors: 20 };
    return `
    <section class="hero shop-hero"><div>
      <h1>Dein eigener <b>Uhrenladen</b>.</h1>
      <p>Eröffne ein Geschäft, gestalte es so, wie du willst, und verkauf deine Uhren direkt an Kund:innen – ohne 6 % Marktplatz-Gebühr. Mit guter Lage, Personal und schönem Ambiente zahlen Kund:innen sogar <b>mehr als den Marktwert</b>.</p>
      <ul class="feat"><li>🎨 Stil, Schild, Boden, Vitrinen &amp; Licht frei wählbar</li><li>🛋 Deko kaufen für mehr Ambiente</li><li>⭐ Kund:innen geben Bewertungen</li><li>🔁 Ankauf: Kund:innen bieten dir ihre Uhren günstig an</li><li>📦 Großhändler liefert neue Ware</li></ul>
      <button class="btn blue big" data-act="shop-open" ${S.money >= SHOP_COST ? '' : 'disabled'}>Laden eröffnen – ${fmtEur(SHOP_COST)}</button>
      ${S.money >= SHOP_COST ? '' : `<p class="muted" style="font-size:12px">Dir fehlen noch ${fmtEur(SHOP_COST - S.money)}.</p>`}
    </div><div>${storeHTML(demo, { demo: true })}</div></section>`;
  }
  const items = shopItems();
  const rating = shopRating();
  const tab = UI.shopTab || 'fenster';
  const free = S.owned.filter(o => !o.shop && !o.bot && !o.ask && !o.service);
  let body = '';
  if (tab === 'fenster') {
    body = `<div class="panel"><div class="panel-head"><h2>Im Laden (${items.length}/${shopSlots()})</h2><span class="muted" style="font-size:12px">Kund:innen zahlen gern bis ca. ${fmtPct(shopTol() - 1)} über Marktwert</span></div>
      ${items.length ? `<div class="table-wrap"><table class="table"><tr><th>Uhr</th><th>Zustand</th><th class="num">Wert</th><th class="num">Ladenpreis</th><th class="num">Chance/Tag</th><th></th></tr>
      ${items.map(o => { const v = itemValue(o); const c = shopChance(o); return `<tr><td><a href="#/modell/${o.m}">${esc(MODEL[o.m].brand)} ${esc(MODEL[o.m].name)}</a></td><td>${condBadge(o.cond)}</td><td class="num">${fmtEur(v)}</td><td class="num"><b>${fmtEur(o.shop)}</b> <span class="${o.shop >= v ? 'up' : 'down'}" style="font-size:11px">${fmtPct(o.shop / v - 1)}</span></td><td class="num">${c >= 0.4 ? 'hoch' : c >= 0.2 ? 'mittel' : 'niedrig'}</td>
        <td class="num"><button class="btn small" data-act="shop-put" data-id="${o.id}">Preis</button> <button class="btn small" data-act="shop-take" data-id="${o.id}">Raus</button></td></tr>`; }).join('')}</table></div>` : '<div class="empty">Deine Vitrinen sind leer. Leg unten Uhren aus deiner Sammlung hinein.</div>'}
    </div>
    <div class="panel"><div class="panel-head"><h2>Aus deiner Sammlung</h2></div>
      ${free.length ? `<ul class="list">${free.map(o => `<li><span class="thumb">${watchImg(o.m)}</span><div class="grow"><div class="title">${esc(MODEL[o.m].brand)} ${esc(MODEL[o.m].name)}</div><div class="sub">${COND[o.cond].name} · Wert ${fmtEur(itemValue(o))} · gekauft ${fmtEur(o.cost)}</div></div>
        <button class="btn small ${items.length < shopSlots() ? 'blue' : ''}" data-act="shop-put" data-id="${o.id}" ${items.length < shopSlots() ? '' : 'disabled'}>In den Laden</button></li>`).join('')}</ul>` : '<div class="empty">Keine freien Uhren. Kauf welche auf dem <a href="#/markt">Marktplatz</a>, beim Großhändler oder über den Ankauf.</div>'}
    </div>`;
  } else if (tab === 'design') {
    const opt = (key, list, label) => `<h3>${label}</h3><div class="chips">${list.map(x => `<button class="chip ${sh[key] === x.k ? 'on' : ''}" data-act="shop-set" data-k="${key}" data-v="${x.k}">${esc(x.name)}</button>`).join('')}</div>`;
    body = `<div class="cols"><div class="panel"><div class="panel-head"><h2>Gestalten</h2><span class="muted" style="font-size:12px">Ändern ist kostenlos</span></div>
      <h3>Name</h3><form data-form="shop-name" class="form-row"><input class="input" id="shop-name" maxlength="22" value="${esc(sh.name)}"><button class="btn">Speichern</button></form>
      ${opt('theme', SHOP_THEMES, 'Stil')}
      <h3>Schild-Farbe</h3><div class="chips">${SHOP_SIGNS.map((c, i) => `<button class="swatch ${sh.sign === i ? 'on' : ''}" style="background:${c}" data-act="shop-set" data-k="sign" data-v="${i}" aria-label="Farbe ${i + 1}"></button>`).join('')}</div>
      ${opt('floor', SHOP_FLOORS, 'Boden')}${opt('vit', SHOP_CASES, 'Vitrinen')}${opt('light', SHOP_LIGHTS, 'Licht')}
    </div>
    <div class="panel"><div class="panel-head"><h2>Deko &amp; Ambiente</h2><span class="muted" style="font-size:12px">Ambiente: ${shopAmb()} Punkte</span></div>
      <p class="muted" style="font-size:12px;margin-top:0">Mehr Ambiente = bessere Bewertungen und Kund:innen zahlen etwas mehr.</p>
      <ul class="list">${SHOP_DECO.map(d => `<li><span class="deco-icon">${d.icon}</span><div class="grow"><div class="title">${esc(d.name)}</div><div class="sub">+${d.amb} Ambiente</div></div>
        ${sh.deco[d.k] ? '<span class="badge green">Gekauft</span>' : `<button class="btn small ${S.money >= d.cost ? 'blue' : ''}" data-act="shop-deco" data-k="${d.k}" ${S.money >= d.cost ? '' : 'disabled'}>${fmtEur(d.cost)}</button>`}</li>`).join('')}</ul>
    </div></div>`;
  } else if (tab === 'ausbau') {
    body = `<div class="panel"><div class="panel-head"><h2>Ausbau</h2><span class="muted" style="font-size:12px">Laufende Kosten: ${fmtEur(shopDailyCost())} pro Markttag</span></div>
      <div class="up-grid">${SHOP_UPS.map(u => { const lvl = sh.up[u.k] || 0, maxed = lvl >= u.max, cost = Math.round(u.base * Math.pow(u.f, lvl));
        return `<div class="up-card ${maxed ? 'maxed' : ''}"><div class="up-icon">${u.icon}</div><div class="up-name">${u.name}</div>
          <div class="up-lvl">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
          <div class="up-desc">${esc(u.desc(lvl))}</div>
          ${maxed ? '<span class="badge gold">Maximal</span>' : `<div class="up-next muted">Nächste Stufe: ${esc(u.desc(lvl + 1))}</div>
          <button class="btn ${S.money >= cost ? 'blue' : ''} small" data-act="shop-up" data-k="${u.k}" ${S.money >= cost ? '' : 'disabled'}>${fmtEur(cost)}</button>`}</div>`; }).join('')}</div>
    </div>`;
  } else {
    body = `<div class="cols"><div class="panel"><div class="panel-head"><h2>Ankauf von Kund:innen</h2><span class="muted" style="font-size:12px">Angebote gelten 3 Tage</span></div>
      ${sh.tradeins.length ? `<ul class="list">${sh.tradeins.map(t => { const v = valueOf(t.m, t.cond, t.papers); return `<li><span class="thumb">${watchImg(t.m)}</span><div class="grow"><div class="title">${esc(MODEL[t.m].brand)} ${esc(MODEL[t.m].name)}</div>
        <div class="sub">${esc(t.who)} · ${COND[t.cond].name} · ${t.papers ? 'mit Papieren' : 'ohne Papiere'} · Wert ${fmtEur(v)}</div></div>
        <div style="text-align:right"><b>${fmtEur(t.price)}</b><div class="up" style="font-size:11px">${fmtPct(t.price / v - 1)}</div></div>
        <button class="btn small ${S.money >= t.price ? 'green' : ''}" data-act="shop-trade" data-id="${t.id}" ${S.money >= t.price ? '' : 'disabled'}>Ankaufen</button></li>`; }).join('')}</ul>`
        : '<div class="empty">Gerade bietet niemand etwas an. Mehr Besucher = mehr Angebote.</div>'}
    </div>
    <div class="panel"><div class="panel-head"><h2>Großhändler</h2><span class="muted" style="font-size:12px">neu ab Tag ${sh.wholeDay + 3}</span></div>
      <p class="muted" style="font-size:12px;margin-top:0">Fabrikneu mit Box &amp; Papieren, etwas unter Marktwert. Nur für Ladenbesitzer.</p>
      <ul class="list">${sh.whole.map(g => `<li><span class="thumb">${watchImg(g.m)}</span><div class="grow"><div class="title">${esc(MODEL[g.m].brand)} ${esc(MODEL[g.m].name)}</div><div class="sub">noch ${g.qty} Stück · Wert ${fmtEur(valueOf(g.m, 0, true))}</div></div>
        <b>${fmtEur(g.price)}</b> <button class="btn small ${S.money >= g.price && g.qty ? 'blue' : ''}" data-act="shop-whole" data-id="${g.id}" ${S.money >= g.price && g.qty ? '' : 'disabled'}>Bestellen</button></li>`).join('')}</ul>
    </div></div>`;
  }
  return `
  <div class="shop-top">
    ${storeHTML(sh)}
    <div class="stats">
      <div class="stat"><small>Besucher heute</small><strong>${sh.closed ? '–' : sh.visitors}</strong><div class="sub muted">${SHOP_LOCS[sh.up.loc].name}</div></div>
      <div class="stat"><small>Bewertung</small><strong>${rating ? rating.toFixed(1) : '–'}</strong><div class="sub">${rating ? stars(rating) : '<span class="muted">noch keine</span>'}</div></div>
      <div class="stat"><small>Verkäufe</small><strong>${sh.sales}</strong><div class="sub muted">Umsatz ${fmtEur(sh.revenue)}</div></div>
      <div class="stat"><small>Laden-Gewinn</small><strong class="${sh.profit >= 0 ? 'up' : 'down'}">${fmtEur(sh.profit)}</strong><div class="sub muted">nach Miete &amp; Lohn</div></div>
    </div>
  </div>
  ${shopActionsHTML()}
  <div class="segmented shop-tabs">${[['fenster', '🗄 Schaufenster'], ['design', '🎨 Gestalten'], ['ausbau', '🏗 Ausbau'], ['ankauf', '🔁 Einkauf']].map(([k, n]) => `<button data-act="shop-tab" data-v="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
  ${body}
  <div class="terminal shop-log"><div class="terminal-bar"><i></i><i></i><i></i><span>Kassenbuch – ${esc(sh.name)}</span></div>
    <div class="terminal-body">${sh.log.slice(0, 8).map(n => `<div><span class="t-dim">[Tag ${n.day}]</span> ${esc(n.text)}</div>`).join('') || '<div class="t-dim">Noch keine Einträge – am nächsten Markttag kommen die ersten Kund:innen.</div>'}</div></div>`;
}

function shopActionsHTML() {
  const sh = S.shop, sl = shopSale(), B = S.bot;
  const left = sh.sale ? sh.sale.start + SALE_COOLDOWN - S.day : 0;
  const botItemsIn = shopItems().filter(o => o.bot).length;
  return `<div class="cols shop-actions">
    <div class="panel"><div class="panel-head"><h2>🏷 Sale-Aktion</h2>${sl ? `<span class="badge red">läuft bis Tag ${sl.until}</span>` : ''}</div>
      ${sl ? `<p style="margin-top:0">Gerade läuft dein <b>−${Math.round(sl.pct * 100)} %-Sale</b>: alle Ladenpreise reduziert, ca. <b>${Math.round(sl.pct * 400)} % mehr Besucher</b>.</p>`
        : `<p class="muted" style="margin-top:0;font-size:12px">Alle Ladenpreise werden reduziert. Dafür kommen viel mehr Besucher und die Bewertungen werden besser. Weniger Gewinn pro Uhr – aber schneller Umsatz.</p>
        <div class="chips">${SALES.map((x, i) => `<button class="chip" data-act="shop-sale" data-v="${i}" ${saleReady() ? '' : 'disabled'}>−${x.pct * 100} % für ${x.days} Tag${x.days === 1 ? '' : 'e'}</button>`).join('')}</div>
        ${saleReady() ? '' : `<p class="muted" style="font-size:12px">Nächster Sale ab Tag ${sh.sale.start + SALE_COOLDOWN} (noch ${left} Tag${left === 1 ? '' : 'e'}).</p>`}`}
    </div>
    <div class="panel"><div class="panel-head"><h2>🤖 Bot beliefert den Laden</h2>
      <button class="switch small-switch ${B.stock ? 'on' : ''}" data-act="bot-stock" role="switch" aria-checked="${!!B.stock}" aria-label="Bot beliefert Laden"><span class="knob"></span><span class="lbl-on">AN</span><span class="lbl-off">AUS</span></button></div>
      <p class="muted" style="margin-top:0;font-size:12px">Der Bot legt seine Schnäppchen in deine freien Vitrinen statt auf den Marktplatz – so verkauft er zum Ladenpreis (über Marktwert, nur 2 % Gebühr). Sein Anteil (${Math.round(botShare() * 100)} % vom Gewinn) bleibt gleich.</p>
      <div style="font-size:13px">${B.on ? '' : '<span class="down">Bot ist aus – <a href="#/bot">einschalten ›</a></span><br>'}Bot-Uhren im Laden: <b>${botItemsIn}</b> · freie Vitrinen: <b>${Math.max(0, shopSlots() - shopItems().length)}</b></div>
    </div>
  </div>`;
}

function openShopPut(id) {
  const o = S.owned.find(x => x.id === id); if (!o) return;
  const v = itemValue(o);
  const min = niceRound(v * 0.8), max = niceRound(v * 1.6), def = o.shop || niceRound(v * shopTol());
  const upd = (root, p) => {
    $('#sp-val', root).textContent = fmtEur(p);
    $('#sp-pay', root).textContent = fmtEur(p * (1 - SHOP_FEE));
    $('#sp-gain', root).textContent = fmtEur(p * (1 - SHOP_FEE) - o.cost);
    const c = shopChance(o, p); const el = $('#sp-chance', root);
    el.textContent = c >= 0.4 ? 'hoch' : c >= 0.2 ? 'mittel' : c >= 0.08 ? 'niedrig' : 'sehr niedrig'; el.className = c >= 0.4 ? 'up' : c >= 0.2 ? '' : 'down';
  };
  modal('Preisschild', `
    <div class="shot">${watchImg(o.m)}</div>
    <p style="margin-top:0" class="center"><b>${esc(MODEL[o.m].brand)} ${esc(MODEL[o.m].name)}</b><br><span class="muted">Marktwert ${fmtEur(v)} · in deinem Laden zahlen Kund:innen gern bis ${fmtEur(v * shopTol())}</span></p>
    <div class="center" style="font-size:24px;font-weight:300" id="sp-val"></div>
    <input type="range" id="sp-range" min="${min}" max="${max}" step="${v > 5000 ? 50 : 5}" value="${clamp(def, min, max)}">
    <table class="sum"><tr><td>Verkaufschance</td><td id="sp-chance"></td></tr>
      <tr><td>Kartengebühr (2 %)</td><td>abgezogen</td></tr>
      <tr><td>Gewinn ggü. Einkauf</td><td id="sp-gain"></td></tr>
      <tr class="total"><td>Du bekommst</td><td id="sp-pay"></td></tr></table>`,
    `<button class="btn" data-act="close">Abbrechen</button><button class="btn blue" data-act="shop-confirm" data-id="${o.id}">In die Vitrine</button>`,
    root => { const r = $('#sp-range', root); upd(root, +r.value); r.addEventListener('input', () => upd(root, +r.value)); });
}

/* ---------- Bot-Befehle (Terminal) ---------- */
const CON = [];               // Ausgabe der Befehlszeile (nur für diese Sitzung)
const CMD_HIST = []; let cmdPos = 0;
function conLine(l) { return `<div class="${l.c || ''}">${l.h}</div>`; }
function out(h, c = '') { CON.push({ h, c }); while (CON.length > 60) CON.shift(); }
function parseAmount(t) {
  if (!t) return NaN;
  t = t.toLowerCase().replace(/€|eur/g, '').trim();
  let f = 1;
  if (/(k|tsd)$/.test(t)) { f = 1e3; t = t.replace(/(k|tsd)$/, ''); }
  else if (/(m|mio)$/.test(t)) { f = 1e6; t = t.replace(/(m|mio)$/, ''); }
  t = t.replace(/\./g, '').replace(',', '.');
  return parseFloat(t) * f;
}
const BOT_HELP = [
  ['status', 'Überblick: Modus, Budget, Positionen, Gewinn'],
  ['an / aus', 'Bot starten oder pausieren'],
  ['modus vorsichtig|ausgewogen|riskant|hai', 'Strategie wechseln'],
  ['budget 20000 | 20k | max', 'Budget setzen'],
  ['scan', 'die 5 besten Deals gerade auf dem Markt'],
  ['kauf rolex', 'sofort das beste passende Angebot kaufen'],
  ['fokus omega | fokus aus', 'nur noch diese Marke/dieses Modell kaufen'],
  ['maxpreis 5000 | maxpreis aus', 'keine Uhr teurer als …'],
  ['positionen', 'alles, was der Bot gerade hält'],
  ['preis -5% | preis +3%', 'alle Verkaufspreise des Bots ändern'],
  ['verkauf alles', 'alles zum Marktwert inserieren (schneller Verkauf)'],
  ['notverkauf', 'alles sofort an Händler (80 % vom Wert)'],
  ['laden an|aus', 'Bot beliefert deinen Laden'],
  ['sniper an|aus', 'Auktions-Sniper ein/aus'],
  ['clear', 'Terminal leeren'],
];
function modeByName(n) {
  n = (n || '').toLowerCase();
  return BOT_MODES.findIndex(m => m.name.toLowerCase().replace(/[^a-zäöü]/g, '').startsWith(n.replace(/[^a-zäöü]/g, '')) && n);
}
// Einfache Wörter in Befehle übersetzen ("kaufe rolex" → "kauf rolex")
function simplify(t) {
  t = t.replace(/[!?.]+$/, '').trim();
  const A = [
    [/^(start|los|starten|go)$/, 'an'], [/^(stopp?|halt|pause|stoppen)$/, 'aus'],
    [/^(info|wie läufts|wie laeufts|stand)$/, 'status'],
    [/^(deals|angebote|schnäppchen|suchen)$/, 'scan'], [/^(deals|angebote) (.+)$/, 'scan $2'],
    [/^(kaufen|kaufe|kauf mir) (.+)$/, 'kauf $2'],
    [/^nur (.+)$/, 'fokus $1'], [/^(alle|alles kaufen|egal|alle marken)$/, 'fokus aus'],
    [/^geld (.+)$/, 'budget $1'],
    [/^(vorsichtig|ausgewogen|riskant|hai)$/, 'modus $1'],
    [/^(uhren|liste|meine uhren)$/, 'positionen'],
    [/^billiger$/, 'preis -5%'], [/^teurer$/, 'preis +5%'],
    [/^(verkaufen|alles verkaufen)$/, 'verkauf alles'], [/^(sofort verkaufen|alles sofort verkaufen|weg damit)$/, 'notverkauf'],
  ];
  for (const [re, to] of A) if (re.test(t)) return t.replace(re, to);
  // nur ein Markenname → Deals dieser Marke zeigen
  if (BRANDS.some(b => b.toLowerCase().includes(t)) && t.length > 2 && !BOT_WORDS.includes(t.split(' ')[0])) return 'scan ' + t;
  return t;
}
const BOT_WORDS = ['leise', 'laut', 'kurz', 'hilfe', 'help', 'status', 'an', 'aus', 'modus', 'budget', 'scan', 'kauf', 'fokus', 'maxpreis', 'positionen', 'preis', 'verkauf', 'notverkauf', 'laden', 'sniper', 'clear', 'hallo', 'kaffee'];

function runCmd(raw) {
  const B = S.bot;
  const line = raw.trim().replace(/^\//, '');
  if (!line) return;
  CMD_HIST.push(line); cmdPos = CMD_HIST.length;
  out(`<span class="t-me">chronobot $ ${esc(line)}</span>`);
  const [cmd, ...rest] = simplify(line.toLowerCase()).split(/\s+/);
  const arg = rest.join(' ');
  const ok = t => out('✔ ' + t);
  const err = t => out('✖ ' + t, 't-err');
  switch (cmd) {
    case 'hilfe': case 'help': case '?':
      out('So sprichst du mit mir – einfach eins davon tippen:');
      [['start', 'stopp', 'Bot an oder aus'], ['deals', '', 'die besten Angebote'], ['kaufe rolex', '', 'sofort eine Rolex kaufen'],
       ['nur omega', 'alle', 'nur noch Omega kaufen / wieder alles'], ['geld 10000', '', 'so viel darf ich ausgeben'],
       ['vorsichtig', 'hai', 'wie mutig ich bin'], ['uhren', '', 'meine Uhren'], ['billiger', 'teurer', 'Preise ändern'],
       ['verkaufen', '', 'alles schnell verkaufen'], ['leise', 'laut', 'weniger / mehr Einblendungen'], ['info', '', 'wie läuft’s?']]
        .forEach(([a, b, d]) => out(`  <b>${a}</b>${b ? ` / <b>${b}</b>` : ''} <span class="t-dim">→ ${d}</span>`));
      out('<span class="t-dim">Oder einfach die Knöpfe unten benutzen. Profi-Befehle: „profi“</span>');
      break;
    case 'status': {
      const items = botItems();
      out(`Bot: <b>${B.on ? 'AN' : 'AUS'}</b> · Stufe ${botTier()} · Modus ${BOT_MODES[B.mode].name}`);
      out(`Budget ${fmtEur(B.budget)} · gebunden ${fmtEur(botInUse())} · frei ${fmtEur(Math.max(0, Math.min(S.money, B.budget - botInUse())))}`);
      out(`Positionen ${items.length} · Trades ${B.trades} · Netto <b>${fmtEur(botNet())}</b> · Anteil ${Math.round(botShare() * 100)} %`);
      out(`Fokus: ${B.focus ? esc(B.focus) : 'alle'} · Maxpreis: ${B.maxPrice ? fmtEur(B.maxPrice) : 'egal'} · Laden: ${B.stock ? 'an' : 'aus'} · Sniper: ${B.up.sniper ? (B.snipeOff ? 'aus' : 'an') : 'nicht gekauft'}`);
      break;
    }
    case 'an': case 'start': case 'go':
      if (B.on) ok('Läuft schon.'); else { B.on = true; ok('Bot gestartet. Er handelt ab dem nächsten Markttag.'); }
      break;
    case 'aus': case 'stop': case 'pause':
      if (!B.on) ok('Ist schon aus.'); else { B.on = false; ok('Bot pausiert. Seine Uhren bleiben inseriert.'); }
      break;
    case 'modus': case 'mode': case 'strategie': {
      const i = modeByName(arg);
      if (i < 0) { err('Unbekannter Modus. Möglich: vorsichtig, ausgewogen, riskant, hai'); break; }
      B.mode = i; ok(`Modus: ${BOT_MODES[i].name}`);
      break;
    }
    case 'budget': {
      const max = Math.floor((S.money + botInUse()) / 500) * 500;
      const v = arg === 'max' || arg === 'alles' ? max : parseAmount(arg);
      if (!(v > 0)) { err('Beispiel: budget 20000, budget 20k oder budget max'); break; }
      B.budget = Math.max(500, Math.round(v)); ok(`Budget: ${fmtEur(B.budget)}`);
      break;
    }
    case 'scan': {
      const n = clamp(parseInt(arg) || 5, 1, 15);
      const q = isNaN(parseInt(arg)) ? arg : '';
      const deals = S.listings.filter(l => !l.flash && (q ? `${MODEL[l.m].brand} ${MODEL[l.m].name}`.toLowerCase().includes(q) : botMatches(l))).map(l => ({ l, r: l.price / valueOf(l.m, l.cond, l.papers) })).sort((a, b) => a.r - b.r).slice(0, n);
      if (!deals.length) { err('Keine passenden Angebote.'); break; }
      out(`Top ${deals.length} Deals${B.focus ? ` (Fokus: ${esc(B.focus)})` : ''}:`);
      deals.forEach(({ l, r }, i) => out(`  ${i + 1}. ${esc(MODEL[l.m].brand)} ${esc(MODEL[l.m].name)} – ${fmtEur(l.price)} <span class="${r < 1 ? '' : 't-err'}">(${r < 1 ? '−' : '+'}${Math.abs(Math.round((1 - r) * 100))} %)</span>${l.fake && B.up.scanner ? ' <span class="t-err">⚠ Fälschung!</span>' : !l.dealer && !l.papers ? ' <span class="t-dim">privat, ohne Papiere</span>' : ''}`));
      break;
    }
    case 'kauf': case 'kaufe': case 'buy': {
      if (!arg) { err('Was soll ich kaufen? Beispiel: kauf rolex'); break; }
      const free = Math.min(S.money, B.budget - botInUse());
      const c = S.listings.filter(l => !l.flash && `${MODEL[l.m].brand} ${MODEL[l.m].name} ${MODEL[l.m].ref}`.toLowerCase().includes(arg))
        .filter(l => !(l.fake && B.up.scanner > 0))
        .map(l => ({ l, r: l.price / valueOf(l.m, l.cond, l.papers) })).sort((a, b) => a.r - b.r);
      if (!c.length) { err(`Kein Angebot für „${esc(arg)}“ gefunden.`); break; }
      const fit = c.find(x => x.l.price <= free);
      if (!fit) { err(`Zu teuer: günstigstes passendes Angebot ${fmtEur(Math.min(...c.map(x => x.l.price)))}, frei sind ${fmtEur(Math.max(0, free))}. Tipp: budget max`); break; }
      const res = botBuy(fit.l, fit.r, true);
      if (res === 'fake') err(`Gekauft – aber es war eine FÄLSCHUNG. −${fmtEur(fit.l.price)}`);
      else ok(`Gekauft: ${esc(MODEL[fit.l.m].brand)} ${esc(MODEL[fit.l.m].name)} für ${fmtEur(fit.l.price)}. Der Bot verkauft sie weiter.`);
      if (!B.on) out('Hinweis: Der Bot ist aus – er verkauft erst, wenn du „an“ eingibst.', 't-dim');
      checkAchievements();
      break;
    }
    case 'fokus': case 'nur': {
      if (!arg || arg === 'aus' || arg === 'alle') { B.focus = ''; ok('Fokus aufgehoben – der Bot kauft wieder alles.'); break; }
      const n = MODELS.filter(m => `${m.brand} ${m.name} ${m.cat}`.toLowerCase().includes(arg)).length;
      if (!n) { err(`Keine Uhr passt zu „${esc(arg)}“.`); break; }
      B.focus = arg; ok(`Fokus: nur noch „${esc(arg)}“ (${n} Modell${n === 1 ? '' : 'e'}).`);
      break;
    }
    case 'maxpreis': case 'max': {
      if (!arg || arg === 'aus') { B.maxPrice = 0; ok('Kein Maxpreis mehr.'); break; }
      const v = parseAmount(arg);
      if (!(v > 0)) { err('Beispiel: maxpreis 5000'); break; }
      B.maxPrice = Math.round(v); ok(`Maxpreis pro Uhr: ${fmtEur(B.maxPrice)}`);
      break;
    }
    case 'positionen': case 'pos': case 'depot': {
      const items = botItems();
      if (!items.length) { out('Keine Positionen.'); break; }
      items.forEach(o => { const v = itemValue(o); out(`  ${esc(MODEL[o.m].brand)} ${esc(MODEL[o.m].name)} · gekauft ${fmtEur(o.cost)} · Wert ${fmtEur(v)} · ${o.service ? 'Revision' : o.shop ? `Laden ${fmtEur(o.shop)}` : o.ask ? `inseriert ${fmtEur(o.ask)}` : 'wartet'} <span class="${v >= o.cost ? '' : 't-err'}">${fmtPct(v / o.cost - 1)}</span>`); });
      break;
    }
    case 'preis': {
      const pct = parseFloat(arg.replace('%', '').replace(',', '.'));
      if (!isFinite(pct) || Math.abs(pct) > 50) { err('Beispiel: preis -5% oder preis +3%'); break; }
      let n = 0;
      for (const o of botItems()) { if (o.ask) { o.ask = niceRound(o.ask * (1 + pct / 100)); n++; } if (o.shop) { o.shop = niceRound(o.shop * (1 + pct / 100)); n++; } }
      if (!n) { out('Noch nichts inseriert – der Bot setzt seine Preise am nächsten Markttag.'); break; }
      ok(`${n} Preis${n === 1 ? '' : 'e'} um ${pct > 0 ? '+' : ''}${pct} % geändert. (Am nächsten Markttag passt der Bot seine Preise wieder selbst an.)`);
      break;
    }
    case 'verkauf': case 'verkaufe': case 'sell': {
      const items = botItems().filter(o => !o.service);
      if (!items.length) { out('Nichts zu verkaufen.'); break; }
      items.forEach(o => { o.shop = 0; o.ask = niceRound(itemValue(o) * 0.98); });
      ok(`${items.length} Uhr${items.length === 1 ? '' : 'en'} knapp unter Marktwert inseriert – die gehen schnell weg.`);
      break;
    }
    case 'notverkauf': case 'panik': {
      const items = botItems().filter(o => !o.service);
      if (!items.length) { out('Nichts zu verkaufen.'); break; }
      let sum = 0, prof = 0;
      items.forEach(o => { o.shop = 0; o.ask = Math.round(itemValue(o) * DEALER); const pay = o.ask; sum += pay; prof += botSold(o, pay).profit; });
      out(`Alles an Händler verkauft: ${items.length} Uhren für ${fmtEur(sum)} → ${prof >= 0 ? 'Gewinn' : 'Verlust'} ${fmtEur(prof)}`, prof >= 0 ? '' : 't-err');
      break;
    }
    case 'laden': {
      if (!S.shop) { err('Du hast noch keinen Laden. → Menü „Laden“'); break; }
      B.stock = arg !== 'aus';
      if (B.stock) { const n = botStockShop(true); ok(`Bot beliefert den Laden${n ? ` – ${n} Uhr${n === 1 ? '' : 'en'} in die Vitrinen gelegt` : ''}.`); }
      else { botItems().forEach(o => { o.shop = 0; }); ok('Bot verkauft wieder über den Marktplatz.'); }
      break;
    }
    case 'sniper': {
      if (!B.up.sniper) { err('Sniper-Upgrade fehlt (15.000 €, siehe unten).'); break; }
      B.snipeOff = arg === 'aus'; ok(`Sniper ${B.snipeOff ? 'aus' : 'an'}.`);
      break;
    }
    case 'profi':
      out('Profi-Befehle:');
      BOT_HELP.forEach(([c, d]) => out(`  <b>${esc(c)}</b> <span class="t-dim">– ${esc(d)}</span>`));
      break;
    case 'leise': case 'ruhe': B.notify = 0; ok('Okay, ich bin still. Alles steht nur noch hier im Terminal.'); break;
    case 'kurz': B.notify = 1; ok('Ich melde mich nur noch einmal pro Markttag kurz.'); break;
    case 'laut': B.notify = 2; ok('Ich melde jeden Kauf und Verkauf.'); break;
    case 'clear': case 'cls': CON.length = 0; break;
    case 'hallo': case 'hi': out(`Hallo ${esc(S.name)}! Ich bin chronobot ${botTier()}. Tipp „hilfe“ für alle Befehle.`); break;
    case 'kaffee': out('☕ Ich bin ein Bot. Ich trinke nur Marktdaten.'); break;
    default: err(`Unbekannter Befehl „${esc(cmd)}“. Tipp „hilfe“.`);
  }
  save();
}
// Einfaches Knopf-Menü unter dem Terminal
function botMenuHTML() {
  const B = S.bot, pk = UI.botPick;
  const tile = (icon, label, act, v, cls = '') => `<button class="bm-tile ${cls}" data-act="${act}" data-v="${esc(v)}"><span>${icon}</span>${label}</button>`;
  const brandsNow = [...new Set(S.listings.filter(l => !l.flash).map(l => MODEL[l.m].brand))].sort((a, b) => a.localeCompare(b, 'de'));
  let sub = '';
  if (pk === 'kauf') sub = `<div class="bm-q">Welche Marke soll ich kaufen?</div>` + brandsNow.map(b => `<button class="bm-opt" data-act="botcmd" data-v="kaufe ${esc(b.toLowerCase())}">${esc(b)}</button>`).join('');
  if (pk === 'fokus') sub = `<div class="bm-q">Nur noch diese Marke kaufen:</div><button class="bm-opt on" data-act="botcmd" data-v="alle">Alle Marken</button>` + BRANDS.map(b => `<button class="bm-opt ${B.focus === b.toLowerCase() ? 'on' : ''}" data-act="botcmd" data-v="nur ${esc(b.toLowerCase())}">${esc(b)}</button>`).join('');
  if (pk === 'geld') sub = `<div class="bm-q">Wie viel darf ich ausgeben?</div>` + [2000, 5000, 10000, 25000, 50000, 100000, 250000].filter(v => v <= S.money + botInUse()).map(v => `<button class="bm-opt" data-act="botcmd" data-v="geld ${v}">${fmtEur(v)}</button>`).join('') + `<button class="bm-opt" data-act="botcmd" data-v="geld max">Alles</button>`;
  if (pk === 'mut') sub = `<div class="bm-q">Wie mutig soll ich sein?</div>` + BOT_MODES.map((m, i) => `<button class="bm-opt ${B.mode === i ? 'on' : ''}" data-act="botcmd" data-v="modus ${['vorsichtig', 'ausgewogen', 'riskant', 'hai'][i]}">${m.name}</button>`).join('');
  return `<div class="bot-menu">
    <div class="bm-grid">
      ${B.on ? tile('⏸', 'Stopp', 'botcmd', 'stopp', 'red') : tile('▶️', 'Start', 'botcmd', 'start', 'green')}
      ${tile('🔍', 'Beste Deals', 'botcmd', 'deals')}
      ${tile('🛒', 'Kaufen …', 'bot-pick', 'kauf', pk === 'kauf' ? 'on' : '')}
      ${tile('🎯', B.focus ? `Nur ${esc(B.focus)}` : 'Nur Marke …', 'bot-pick', 'fokus', pk === 'fokus' ? 'on' : '')}
      ${tile('💶', `Geld: ${fmtEur(B.budget)}`, 'bot-pick', 'geld', pk === 'geld' ? 'on' : '')}
      ${tile('🦈', `Mut: ${BOT_MODES[B.mode].name.replace('🦈 ', '')}`, 'bot-pick', 'mut', pk === 'mut' ? 'on' : '')}
      ${tile('⌚', 'Meine Uhren', 'botcmd', 'uhren')}
      ${tile('💰', 'Alles verkaufen', 'botcmd', 'verkaufen')}
      ${tile('📊', 'Wie läuft’s?', 'botcmd', 'info')}
      ${tile('❓', 'Hilfe', 'botcmd', 'hilfe')}
    </div>
    ${sub ? `<div class="bm-sub">${sub}<button class="bm-opt x" data-act="bot-pick" data-v="">✕</button></div>` : ''}
  </div>`;
}

function submitCmd(text) {
  UI.botPick = null;
  runCmd(text);
  render();
  const inp = $('#bot-cmd'); if (inp) inp.focus();
  const body = $('.terminal-body'); if (body) body.scrollTop = body.scrollHeight;
}

function botLiveLine() {

  const B = S.bot;
  if (!B.on) return '&gt; Bot pausiert. Schalter oben umlegen.';
  const deals = S.listings.map(l => ({ l, r: l.price / valueOf(l.m, l.cond, l.papers) })).sort((a, b) => a.r - b.r);
  const best = deals[0];
  const lines = [
    `&gt; scanne ${S.listings.length} Angebote …`,
    best ? `&gt; bestes Angebot: ${esc(MODEL[best.l.m].brand)} ${esc(MODEL[best.l.m].name)} ${fmtPct(best.r - 1)}` : '&gt; keine Angebote',
    `&gt; ${S.auctions.length} Auktionen beobachtet${B.up.sniper ? ' · Sniper bereit 🎯' : ''}`,
    `&gt; Budget frei: ${fmtEur(Math.max(0, Math.min(S.money, B.budget - botInUse())))}`,
    `&gt; nächster Handel in ${Math.max(0, Math.ceil((DAY_MS - (Date.now() - S.lastTick)) / 1000))} s`,
    `&gt; Markt-Stimmung: ${changeOver('rolex-sub', 7) > 0 ? 'bullish 📈' : 'bearish 📉'}`,
  ];
  return lines[Math.floor(Date.now() / 2000) % lines.length] + '<span class="cursor">▌</span>';
}

function rankingHTML(compact) {
  const me = netWorth();
  const rows = [...S.rivals.map(r => ({ n: r.n, w: r.w })), { n: S.name, w: me, me: true }].sort((a, b) => b.w - a.w);
  const idx = rows.findIndex(r => r.me);
  const show = compact ? rows.slice(Math.max(0, idx - 2), idx + 3) : rows;
  return `<ol class="ranking">${show.map(r => { const pos = rows.indexOf(r) + 1; return `<li class="${r.me ? 'me' : ''}"><span class="pos ${pos <= 3 ? 'p' + pos : ''}">${pos}</span><span class="grow">${esc(r.n)}${r.me ? ' (du)' : ''}</span><span>${fmtEur(r.w)}</span></li>`; }).join('')}</ol>`;
}

function pageProfile() {
  const li = levelIdx(collectionValue());
  return `
  <div class="panel"><div class="panel-head"><h2>Profil</h2></div>
    <form class="form-row" data-form="name"><label for="nm">Name</label><input class="input" id="nm" maxlength="24" value="${esc(S.name)}"><button class="btn small">Speichern</button></form>
    <table class="specs">
      <tr><td>Stufe</td><td>${LEVELS[li].name}</td></tr>
      <tr><td>Markttag</td><td>${S.day}</td></tr>
      <tr><td>Uhren gekauft / verkauft</td><td>${S.stats.bought} / ${S.stats.sold}</td></tr>
      <tr><td>Bester Verkauf</td><td>${fmtEur(S.stats.bestFlip)}</td></tr>
      <tr><td>Gewonnene Auktionen</td><td>${S.stats.auctions}</td></tr>
      <tr><td>Gesamtvermögen</td><td>${fmtEur(netWorth())}</td></tr>
    </table>
  </div>
  <div class="panel"><div class="panel-head"><h2>Rangliste</h2><span class="muted" style="font-size:12px">nach Gesamtvermögen</span></div>${rankingHTML(false)}</div>
  <div class="panel"><div class="panel-head"><h2>Erfolge</h2><span class="muted" style="font-size:12px">${Object.keys(S.ach).length} von ${ACHIEVEMENTS.length}</span></div>
    <div class="ach-grid">${ACHIEVEMENTS.map(a => `<div class="ach ${S.ach[a.id] ? '' : 'locked'}"><div class="medal">${a.icon}</div><div class="name">${esc(a.name)}</div><div class="desc">${esc(a.desc)}</div><div class="desc">Belohnung ${fmtEur(a.reward)}</div></div>`).join('')}</div>
  </div>
  <div class="panel"><div class="panel-head"><h2>So funktioniert’s</h2></div>
    <ul style="margin:0;padding-left:18px">
      <li>Alle 30 Sekunden beginnt ein neuer <b>Markttag</b>: Preise ändern sich, neue Angebote kommen, deine Inserate können verkauft werden.</li>
      <li><b>Grün markierte Angebote</b> liegen unter Marktwert – ideal zum Weiterverkaufen.</li>
      <li><b>Revisionsbedürftige</b> Uhren sind günstig. Nach einer Revision (2 Tage) sind sie „Sehr gut“ und mehr wert.</li>
      <li>Verkaufen: <b>Inserieren</b> (6 % Gebühr, dauert, bringt mehr) oder <b>Sofort an Händler</b> (80 % vom Wert).</li>
      <li>Auch wenn die App zu ist, laufen bis zu ${MAX_CATCHUP} Markttage weiter.</li>
    </ul>
  </div>
  <div class="panel"><div class="panel-head"><h2>Neu anfangen</h2></div>
    <p class="muted" style="margin-top:0">Löscht deinen Spielstand auf diesem Gerät.</p>
    <button class="btn red" data-act="reset">Spielstand löschen</button></div>`;
}

function flashBanner() {
  const l = S.listings.find(x => x.flash && x.flash > Date.now());
  if (!l) return '';
  const m = MODEL[l.m];
  const pct = Math.round((1 - l.price / valueOf(l.m, l.cond, l.papers)) * 100);
  return `<a class="flash-banner" href="#/angebot/${l.id}"><span class="bolt">⚡</span><span class="grow"><b>Blitz-Deal:</b> ${esc(m.brand)} ${esc(m.name)} für ${fmtEur(l.price)} <span class="badge green">${pct} % unter Wert</span></span><span class="timer" data-ends="${l.flash}">${fmtTime(Math.max(0, Math.ceil((l.flash - Date.now()) / 1000)))}</span></a>`;
}

/* ---------- Router ---------- */
function render() {
  if (!S) return;
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const [page, arg] = path.split('/');
  if (query) { const p = new URLSearchParams(query); if (p.has('q')) UI.q = p.get('q'); }
  let html;
  switch (page) {
    case 'markt': html = pageMarket(); break;
    case 'angebot': html = pageListing(arg); break;
    case 'modell': html = pageModel(arg); break;
    case 'auktionen': html = pageAuctions(); break;
    case 'sammlung': html = pageCollection(); break;
    case 'merkliste': html = pageWatchlist(); break;
    case 'profil': html = pageProfile(); break;
    case 'bot': html = pageBot(); break;
    case 'laden': html = pageShop(); break;
    default: html = pageHome();
  }
  view.innerHTML = flashBanner() + html;
  const tb = $('.bot-term .terminal-body'); if (tb) tb.scrollTop = tb.scrollHeight;
  updateTop();
}

let lastRoute = '';
window.addEventListener('hashchange', () => {
  const r = location.hash;
  render();
  if (r !== lastRoute) window.scrollTo(0, 0);
  lastRoute = r;
});

/* ---------- Dialoge ---------- */
function modal(title, body, foot, onBind) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-act="close-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-title">${esc(title)}</div><div class="modal-body">${body}</div><div class="modal-foot">${foot}</div></div></div>`;
  if (onBind) onBind(root);
}
function closeModal() { $('#modal-root').innerHTML = ''; }

function authFee(l) { return Math.max(25, niceRound(l.price * 0.03)); }

function openBuy(id) {
  const l = S.listings.find(x => x.id === id); if (!l) return;
  const m = MODEL[l.m];
  modal('Kasse', `
    <div class="shot">${watchImg(l.m)}</div>
    <div class="center"><b>${esc(m.brand)} ${esc(m.name)}</b><div class="muted">${COND[l.cond].name} · ${l.papers ? 'Box &amp; Papiere' : 'ohne Papiere'}</div></div>
    <table class="sum">
      <tr><td>Artikel</td><td>${fmtEur(l.price)}</td></tr>
      ${l.dealer ? '<tr><td>Echtheitsprüfung</td><td>gratis</td></tr>' : `<tr><td colspan="2"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="chk-auth"> Echtheitsprüfung dazubuchen (+${fmtEur(authFee(l))})</label><div class="down" style="font-size:12px">Privatverkauf${l.papers ? '' : ' ohne Papiere – Fälschungen möglich!'}</div></td></tr>`}
      <tr><td>Versicherter Versand</td><td>gratis</td></tr>
      <tr class="total"><td>Gesamt</td><td>${fmtEur(l.price)}</td></tr>
      <tr><td class="muted">Kontostand danach</td><td class="${S.money - l.price < 0 ? 'down' : 'muted'}">${fmtEur(S.money - l.price)}</td></tr>
    </table>`,
    `<button class="btn" data-act="close">Abbrechen</button><button class="btn blue" data-act="confirm-buy" data-id="${l.id}" ${S.money < l.price ? 'disabled' : ''}>Jetzt kaufen</button>`);
}

function openOffer(id) {
  const l = S.listings.find(x => x.id === id); if (!l) return;
  const m = MODEL[l.m];
  const min = niceRound(l.price * 0.7), def = niceRound(l.price * 0.9);
  modal('Preisvorschlag', `
    <p style="margin-top:0">Was bietest du für die <b>${esc(m.brand)} ${esc(m.name)}</b>? Der Verkäufer antwortet sofort. Pro Markttag ein Vorschlag.</p>
    <div class="center" style="font-size:24px;font-weight:300" id="offer-val">${fmtEur(def)}</div>
    <input type="range" id="offer-range" min="${min}" max="${l.price}" step="${l.price > 5000 ? 50 : 5}" value="${def}">
    <div class="muted" style="display:flex;justify-content:space-between;font-size:12px"><span>${fmtEur(min)}</span><span>Preis: ${fmtEur(l.price)}</span></div>`,
    `<button class="btn" data-act="close">Abbrechen</button><button class="btn blue" data-act="send-offer" data-id="${l.id}">Vorschlag senden</button>`,
    root => { const r = $('#offer-range', root); r.addEventListener('input', () => { $('#offer-val', root).textContent = fmtEur(+r.value); }); });
}

function sendOffer(id) {
  const l = S.listings.find(x => x.id === id); if (!l) return;
  const offer = +$('#offer-range').value;
  if (S.money < offer) { toast('So viel Geld hast du gerade nicht.'); return; }
  l.offered = S.day;
  const r = offer / l.price;
  const chance = r >= 0.95 ? 1 : r >= 0.88 ? 0.6 : r >= 0.8 ? 0.25 : 0.05;
  closeModal();
  if (Math.random() < chance) {
    const res = buyListing(id, offer);
    if (res === 'fake') { render(); return; }
    if (res) {
      S.stats.offers++;
      checkAchievements(); save();
      toast(`🤝 Angenommen! Du bekommst die Uhr für <b>${fmtEur(offer)}</b>.`);
      location.hash = '#/sammlung';
    }
  } else if (r >= 0.8) {
    const counter = niceRound((offer + l.price) / 2);
    modal('Gegenangebot', `<p style="margin-top:0">${esc(l.seller)} sagt: „${fmtEur(offer)} ist mir zu wenig. Für <b>${fmtEur(counter)}</b> gehört sie dir.“</p>`,
      `<button class="btn" data-act="close">Nein danke</button><button class="btn blue" data-act="accept-counter" data-id="${l.id}" data-p="${counter}">Für ${fmtEur(counter)} kaufen</button>`);
    save();
  } else {
    toast(`${esc(l.seller)} hat abgelehnt. Morgen kannst du es nochmal versuchen.`);
    save(); render();
  }
}

function openItem(id) {
  const o = S.owned.find(x => x.id === id); if (!o) return;
  const m = MODEL[o.m];
  const v = itemValue(o);
  const canService = o.cond >= 2 && !o.service && !o.ask && !o.shop;
  modal(`${m.brand} ${m.name}`, `
    <div class="shot">${watchImg(o.m)}</div>
    <table class="sum">
      <tr><td>Zustand</td><td>${COND[o.cond].name}${o.service ? ` (Revision bis Tag ${o.service})` : ''}</td></tr>
      <tr><td>Lieferumfang</td><td>${o.papers ? 'Box &amp; Papiere' : 'nur Uhr'}</td></tr>
      <tr><td>Gekauft (Tag ${o.day})</td><td>${fmtEur(o.cost)}</td></tr>
      <tr><td>Aktueller Wert</td><td><b>${fmtEur(v)}</b></td></tr>
      <tr><td>Gewinn/Verlust</td><td class="${v - o.cost >= 0 ? 'up' : 'down'}">${fmtEur(v - o.cost)} (${fmtPct(v / o.cost - 1)})</td></tr>
      ${o.ask ? `<tr><td>Dein Inserat</td><td>${fmtEur(o.ask)}</td></tr>` : ''}
      ${o.shop ? `<tr><td>Ladenpreis</td><td>${fmtEur(o.shop)}</td></tr>` : ''}
    </table>`,
    `${S.shop && !o.bot && !o.ask && !o.service ? (o.shop ? `<button class="btn" data-act="shop-take" data-id="${o.id}">Aus dem Laden nehmen</button>` : `<button class="btn green" data-act="shop-put" data-id="${o.id}">In den Laden</button>`) : ''}
     ${o.shop ? '' : o.ask ? `<button class="btn" data-act="unlist" data-id="${o.id}">Inserat zurückziehen</button>` : `<button class="btn blue" data-act="list" data-id="${o.id}" ${o.service ? 'disabled' : ''}>Inserieren</button>`}
     <button class="btn" data-act="dealer" data-id="${o.id}" ${o.service ? 'disabled' : ''}>Sofort an Händler: ${fmtEur(v * DEALER)}</button>
     ${o.cond >= 2 ? `<button class="btn" data-act="service" data-id="${o.id}" ${canService ? '' : 'disabled'}>Revision: ${fmtEur(serviceCost(o))}</button>` : ''}
     ${o.bot ? `<button class="btn" data-act="takeover" data-id="${o.id}">Vom Bot übernehmen</button>` : ''}
     <a class="btn" href="#/modell/${o.m}" data-act="close-link">Kursverlauf</a>`);
}

function openList(id) {
  const o = S.owned.find(x => x.id === id); if (!o) return;
  const v = itemValue(o);
  const min = niceRound(v * 0.7), max = niceRound(v * 1.5), def = niceRound(v * 1.02);
  const chanceTxt = p => { const r = p / v; return r <= 0.9 ? ['sehr hoch', 'up'] : r <= 1 ? ['hoch', 'up'] : r <= 1.05 ? ['mittel', ''] : r <= 1.15 ? ['niedrig', 'down'] : ['sehr niedrig', 'down']; };
  const upd = (root, p) => {
    $('#ask-val', root).textContent = fmtEur(p);
    $('#ask-pay', root).textContent = fmtEur(p * (1 - FEE_SELL));
    const [t, c] = chanceTxt(p); const el = $('#ask-chance', root); el.textContent = t; el.className = c;
  };
  modal('Uhr inserieren', `
    <p style="margin-top:0">Marktwert: <b>${fmtEur(v)}</b>. Je höher dein Preis, desto länger dauert der Verkauf.</p>
    <div class="center" style="font-size:24px;font-weight:300" id="ask-val"></div>
    <input type="range" id="ask-range" min="${min}" max="${max}" step="${v > 5000 ? 50 : 5}" value="${def}">
    <table class="sum"><tr><td>Verkaufschance pro Tag</td><td id="ask-chance"></td></tr>
      <tr><td>Gebühr (6 %)</td><td>abgezogen</td></tr>
      <tr class="total"><td>Du bekommst</td><td id="ask-pay"></td></tr></table>`,
    `<button class="btn" data-act="close">Abbrechen</button><button class="btn blue" data-act="confirm-list" data-id="${o.id}">Inserat einstellen</button>`,
    root => { const r = $('#ask-range', root); upd(root, +r.value); r.addEventListener('input', () => upd(root, +r.value)); });
}

function askName(first) {
  modal(first ? 'Willkommen bei Chronothek' : 'Name', `
    <div class="shot">${watchImg('rolex-sub')}</div>
    <p class="center" style="margin-top:0">Bau dir eine Uhrensammlung auf – von der Casio bis zur Nautilus. Du startest mit <b>${fmtEur(START_MONEY)} Spielgeld</b>.</p>
    <form data-form="start" class="form-row" style="justify-content:center"><input class="input" id="start-name" maxlength="24" placeholder="Dein Name" autocomplete="off"></form>`,
    `<button class="btn blue big" data-act="start">Los geht’s</button>`,
    root => setTimeout(() => $('#start-name', root)?.focus(), 50));
}

/* ---------- Klicks ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const id = t.dataset.id;
  if (act === 'close-bg' && e.target !== t) return; // nur echter Klick auf den Hintergrund
  if (['watch', 'buy', 'offer', 'bid', 'sort', 'f-brand', 'f-brand-go', 'range', 'clear-q', 'bonus', 'job', 'item', 'reset', 'start', 'close', 'close-bg'].includes(act) || t.tagName === 'BUTTON') {
    if (act !== 'close-link' && act !== 'f-brand-go') e.preventDefault();
  }
  switch (act) {
    case 'watch': {
      e.stopPropagation();
      const m = t.dataset.m;
      S.watch = S.watch.includes(m) ? S.watch.filter(x => x !== m) : [...S.watch, m];
      save();
      document.querySelectorAll(`.heart-btn[data-m="${m}"]`).forEach(b => b.classList.toggle('on', S.watch.includes(m)));
      if (location.hash.startsWith('#/merkliste')) render();
      break;
    }
    case 'f-brand': UI.brand = t.dataset.v; render(); break;
    case 'f-toggle': UI.filtersOpen = !UI.filtersOpen; render(); break;
    case 'f-brand-go': UI.brand = t.dataset.v; UI.q = ''; break;
    case 'sort': UI.sort = t.dataset.v; render(); break;
    case 'range': UI.range = +t.dataset.v; render(); break;
    case 'clear-q': UI.q = ''; $('#search-input').value = ''; render(); break;
    case 'buy': openBuy(id); break;
    case 'confirm-buy': {
      const l = S.listings.find(x => x.id === id); if (!l) { closeModal(); render(); break; }
      if ($('#chk-auth')?.checked) {
        const fee = authFee(l);
        if (S.money < l.price + fee) { toast('Dafür reicht dein Kontostand nicht.'); break; }
        S.money -= fee;
        if (l.fake) {
          S.listings = S.listings.filter(x => x !== l); S.stats.fakesCaught++;
          checkAchievements(); save(); render();
          modal('Prüfung: Fälschung!', `<div class="shot">${watchImg(l.m)}</div><p class="center">Unser Uhrmacher hat eine <b>Fälschung</b> entdeckt. Der Kauf ist abgebrochen – du zahlst nur ${fmtEur(fee)} für die Prüfung.</p>`, '<button class="btn blue" data-act="close">Puh, Glück gehabt</button>');
          break;
        }
      }
      const res = buyListing(id);
      if (res === 'fake') { render(); break; }
      if (res) {
        closeModal(); const m = MODEL[S.owned[S.owned.length - 1].m];
        toast(`✅ Gekauft: <b>${esc(m.brand)} ${esc(m.name)}</b> liegt jetzt in deiner Uhrenbox.`);
        location.hash = '#/sammlung';
      }
      break;
    }
    case 'offer': openOffer(id); break;
    case 'send-offer': sendOffer(id); break;
    case 'accept-counter': {
      const res = buyListing(id, +t.dataset.p);
      if (res === 'fake') { render(); break; }
      if (res) { closeModal(); toast('🤝 Deal! Die Uhr gehört dir.'); location.hash = '#/sammlung'; }
      break;
    }
    case 'bid': placeBid(id, +t.dataset.n); break;
    case 'item': openItem(id); break;
    case 'takeover': { const o = S.owned.find(x => x.id === id); if (o) { o.bot = false; o.ask = 0; save(); closeModal(); render(); toast('Die Uhr gehört jetzt zu deiner Sammlung – der Bot fasst sie nicht mehr an.'); } break; }
    case 'bot-toggle': S.bot.on = !S.bot.on; save(); render(); toast(S.bot.on ? '🤖 Bot läuft – er handelt ab dem nächsten Markttag.' : 'Bot pausiert. Seine Uhren bleiben inseriert.'); break;
    case 'bot-mode': S.bot.mode = +t.dataset.v; save(); render(); break;
    case 'bot-notify': S.bot.notify = +t.dataset.v; save(); render(); break;
    case 'bot-up': {
      const u = BOT_UPS.find(x => x.k === t.dataset.k); if (!u) break;
      const lvl = S.bot.up[u.k] || 0; if (lvl >= u.max) break;
      const c = botUpCost(u, lvl);
      if (S.money < c) { toast('Dafür reicht dein Kontostand nicht.'); break; }
      S.money -= c; S.bot.up[u.k] = lvl + 1;
      botLog(`Upgrade installiert: ${u.name} Stufe ${lvl + 1}.`);
      save(); render(); toast(`${u.icon} <b>${u.name}</b> Stufe ${lvl + 1} installiert – Bot ist jetzt <b>${botTier()}</b>.`);
      break;
    }
    case 'shop-open': {
      if (S.shop || S.money < SHOP_COST) break;
      modal('Laden eröffnen', `<p style="margin-top:0">Wie soll dein Laden heißen?</p>
        <form data-form="shop-new" class="form-row"><input class="input" id="shop-new-name" maxlength="22" value="${esc(S.name)}s Uhren" autocomplete="off"></form>
        <p class="muted" style="font-size:12px">Kosten: ${fmtEur(SHOP_COST)} einmalig, danach Miete ab ${fmtEur(SHOP_LOCS[0].rent)} pro Markttag.</p>`,
        `<button class="btn" data-act="close">Abbrechen</button><button class="btn blue" data-act="shop-create">Eröffnen</button>`,
        root => setTimeout(() => $('#shop-new-name', root)?.select(), 50));
      break;
    }
    case 'shop-create': createShop(); break;
    case 'shop-tab': UI.shopTab = t.dataset.v; render(); break;
    case 'botcmd': submitCmd(t.dataset.v); break;
    case 'bot-pick': UI.botPick = UI.botPick === t.dataset.v || !t.dataset.v ? null : t.dataset.v; render(); break;
    case 'bot-stock': {
      S.bot.stock = !S.bot.stock;
      if (S.bot.stock) botStockShop(false);
      else for (const o of botItems()) if (o.shop) o.shop = 0; // zurück auf den Marktplatz
      save(); render();
      toast(S.bot.stock ? '🤖🏪 Der Bot beliefert jetzt deinen Laden.' : 'Bot verkauft wieder über den Marktplatz.');
      break;
    }
    case 'shop-sale': {
      const x = SALES[+t.dataset.v]; if (!x || !saleReady()) break;
      S.shop.sale = { pct: x.pct, start: S.day, until: S.day + x.days };
      shopLog(`Sale gestartet: −${x.pct * 100} % bis Tag ${S.day + x.days}.`);
      save(); render(); toast(`🏷 <b>Sale −${x.pct * 100} %</b> startet! Ab dem nächsten Markttag strömen die Kund:innen.`, 5000);
      break;
    }
    case 'shop-set': {
      const k = t.dataset.k; S.shop[k] = k === 'sign' ? +t.dataset.v : t.dataset.v; save(); render(); break;
    }
    case 'shop-deco': {
      const d = SHOP_DECO.find(x => x.k === t.dataset.k); if (!d || S.shop.deco[d.k]) break;
      if (S.money < d.cost) { toast('Dafür reicht dein Kontostand nicht.'); break; }
      S.money -= d.cost; S.shop.deco[d.k] = 1; shopLog(`Neue Deko: ${d.name}.`);
      save(); render(); toast(`${d.icon} <b>${d.name}</b> steht jetzt in deinem Laden.`); break;
    }
    case 'shop-up': {
      const u = SHOP_UPS.find(x => x.k === t.dataset.k); if (!u) break;
      const lvl = S.shop.up[u.k] || 0; if (lvl >= u.max) break;
      const c = Math.round(u.base * Math.pow(u.f, lvl));
      if (S.money < c) { toast('Dafür reicht dein Kontostand nicht.'); break; }
      S.money -= c; S.shop.up[u.k] = lvl + 1; shopLog(`Ausbau: ${u.name} → ${u.desc(lvl + 1)}`);
      checkAchievements(); save(); render(); toast(`${u.icon} <b>${u.name}</b> ausgebaut: ${esc(u.desc(lvl + 1))}`); break;
    }
    case 'shop-put': {
      const o = S.owned.find(x => x.id === id); if (!o) break;
      if (!o.shop && shopItems().length >= shopSlots()) { toast('Alle Vitrinen sind voll – bau unter „Ausbau“ mehr Plätze.'); break; }
      openShopPut(id); break;
    }
    case 'shop-confirm': {
      const o = S.owned.find(x => x.id === id);
      if (o) { o.shop = +$('#sp-range').value; o.ask = 0; save(); closeModal(); render(); toast('🏷 Preisschild hängt – die Uhr liegt in der Vitrine.'); }
      break;
    }
    case 'shop-take': { const o = S.owned.find(x => x.id === id); if (o) { o.shop = 0; save(); closeModal(); render(); } break; }
    case 'shop-trade': {
      const tr = S.shop.tradeins.find(x => x.id === id); if (!tr) break;
      if (S.money < tr.price) { toast('Dafür reicht dein Kontostand nicht.'); break; }
      S.shop.tradeins = S.shop.tradeins.filter(x => x !== tr);
      S.money -= tr.price; addOwned(tr.m, tr.cond, tr.papers, tr.price, `Ankauf von ${tr.who}`);
      S.stats.bestDeal = Math.max(S.stats.bestDeal, 1 - tr.price / valueOf(tr.m, tr.cond, tr.papers));
      shopLog(`Angekauft von ${tr.who}: ${MODEL[tr.m].brand} ${MODEL[tr.m].name} für ${fmtEur(tr.price)}.`);
      checkAchievements(); save(); render(); toast(`🔁 Angekauft: <b>${esc(MODEL[tr.m].name)}</b> für ${fmtEur(tr.price)}.`); break;
    }
    case 'shop-whole': {
      const g = S.shop.whole.find(x => x.id === id); if (!g || !g.qty) break;
      if (S.money < g.price) { toast('Dafür reicht dein Kontostand nicht.'); break; }
      g.qty--; S.money -= g.price; addOwned(g.m, 0, true, g.price, 'Großhändler');
      checkAchievements(); save(); render(); toast(`📦 Geliefert: <b>${esc(MODEL[g.m].brand)} ${esc(MODEL[g.m].name)}</b> (fabrikneu).`); break;
    }
    case 'more': UI.show += 24; render(); break;
    case 'list': openList(id); break;
    case 'confirm-list': {
      const o = S.owned.find(x => x.id === id);
      if (o) { o.ask = +$('#ask-range').value; save(); closeModal(); render(); toast('📣 Inserat ist online. Verkauft wird an den nächsten Markttagen.'); }
      break;
    }
    case 'unlist': { const o = S.owned.find(x => x.id === id); if (o) { o.ask = 0; save(); closeModal(); render(); } break; }
    case 'dealer': {
      const o = S.owned.find(x => x.id === id); if (!o) break;
      const pay = Math.round(itemValue(o) * DEALER);
      sellItem(o, pay); checkAchievements(); save(); closeModal(); render();
      toast(`💶 An Händler verkauft für <b>${fmtEur(pay)}</b>.`);
      break;
    }
    case 'service': {
      const o = S.owned.find(x => x.id === id); if (!o) break;
      const c = serviceCost(o);
      if (S.money < c) { toast('Für die Revision reicht das Geld nicht.'); break; }
      S.money -= c; o.cost += c; o.service = S.day + 2; S.stats.services++;
      checkAchievements(); save(); closeModal(); render();
      toast('🔧 Die Uhr ist beim Uhrmacher – in 2 Markttagen fertig.');
      break;
    }
    case 'close-link': closeModal(); break;
    case 'close': case 'close-bg': closeModal(); break;
    case 'bonus': {
      if (S.lastBonus === todayStr()) break;
      const b = dailyBonus(); S.money += b; S.lastBonus = todayStr();
      save(); render(); flashWallet(); toast(`🎁 Tagesbonus: <b>${fmtEur(b)}</b>`);
      break;
    }
    case 'job': {
      if (Date.now() < S.jobReady) break;
      const p = jobPay(); S.money += p; S.jobReady = Date.now() + 10000;
      save(); render(); flashWallet();
      break;
    }
    case 'reset': {
      modal('Spielstand löschen?', '<p style="margin-top:0">Deine Sammlung, dein Geld und deine Erfolge gehen verloren.</p>',
        '<button class="btn" data-act="close">Abbrechen</button><button class="btn red" data-act="confirm-reset">Löschen</button>');
      break;
    }
    case 'confirm-reset': {
      try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* egal */ }
      closeModal(); S = null; svgCache.clear(); location.hash = '#/'; askName(true);
      break;
    }
    case 'start': startFromModal(); break;
  }
});

function createShop() {
  if (S.shop || S.money < SHOP_COST) return;
  const name = ($('#shop-new-name')?.value || '').trim() || `${S.name}s Uhren`;
  S.money -= SHOP_COST; S.shop = newShop(name); shopRestock();
  shopLog(`Eröffnung von „${name}“ – herzlich willkommen!`);
  UI.shopTab = 'design';
  checkAchievements(); save(); closeModal(); location.hash = '#/laden'; render();
  toast(`🏪 <b>${esc(name)}</b> ist eröffnet! Gestalte deinen Laden und leg Uhren in die Vitrinen.`, 6000);
}

function startFromModal() {
  const name = ($('#start-name')?.value || '').trim() || 'Sammler:in';
  newGame(name); save(); closeModal(); location.hash = '#/'; render();
}

document.addEventListener('change', e => {
  const t = e.target.closest('[data-act^="f-"]'); if (!t) return;
  if (t.dataset.act === 'f-cat') UI.cat = t.value;
  if (t.dataset.act === 'f-max') UI.max = +t.value;
  if (t.dataset.act === 'f-cond') UI.cond = +t.value;
  if (t.dataset.act === 'f-papers') UI.papers = t.checked;
  if (t.dataset.act === 'f-budget') { S.bot.budget = +t.value; save(); }
  render();
});

document.addEventListener('submit', e => {
  const f = e.target;
  e.preventDefault();
  if (f.id === 'search-form') {
    UI.q = $('#search-input').value.trim(); UI.brand = '';
    if (location.hash.startsWith('#/markt')) render(); else location.hash = '#/markt';
    $('#search-input').blur();
  } else if (f.dataset.form === 'name') {
    S.name = ($('#nm').value || '').trim() || S.name; save(); render(); toast('Gespeichert.');
  } else if (f.dataset.form === 'start') startFromModal();
  else if (f.dataset.form === 'shop-new') createShop();
  else if (f.dataset.form === 'botcmd') submitCmd($('#bot-cmd').value);
  else if (f.dataset.form === 'shop-name') { S.shop.name = ($('#shop-name').value || '').trim() || S.shop.name; save(); render(); toast('Neues Schild hängt.'); }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S) closeModal();
  if (e.target.id === 'bot-cmd' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { // Befehlsverlauf
    e.preventDefault();
    cmdPos = clamp(cmdPos + (e.key === 'ArrowUp' ? -1 : 1), 0, CMD_HIST.length);
    e.target.value = CMD_HIST[cmdPos] || '';
  }
});

/* ---------- Takt ---------- */
function loop() {
  if (!S) return;
  const now = Date.now();
  let dayChanged = false;
  while (now - S.lastTick >= DAY_MS) { S.lastTick += DAY_MS; advanceDay(false); dayChanged = true; }
  const sniped = botSnipe(now);
  const aucChanged = tickAuctions(now, true) || sniped;
  const before = S.listings.length;
  S.listings = S.listings.filter(l => !l.flash || l.flash > now);
  const flashGone = S.listings.length !== before;
  if (dayChanged || aucChanged) { checkAchievements(); save(); }
  // Fortschritt des Markttags
  $('#day-progress').style.width = ((now - S.lastTick) / DAY_MS * 100).toFixed(1) + '%';
  updateTop();
  const typing = document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) && view.contains(document.activeElement);
  const onAuc = location.hash.startsWith('#/auktionen');
  const live = $('#bot-live'); if (live) live.innerHTML = botLiveLine();
  if ((dayChanged || flashGone) && !typing) render();
  else if (aucChanged && onAuc) render();
  else {
    // nur Countdown-Texte aktualisieren
    document.querySelectorAll('.timer[data-ends]').forEach(el => {
      const left = Math.max(0, Math.ceil((+el.dataset.ends - now) / 1000));
      el.textContent = fmtTime(left); el.classList.toggle('hot', left < 30);
    });
    const jb = $('#job-btn');
    if (jb) { const l = Math.max(0, Math.ceil((S.jobReady - now) / 1000)); jb.disabled = l > 0; jb.textContent = l ? `Noch ${l} s` : 'Polieren'; }
  }
}

/* ---------- Start ---------- */
function boot() {
  S = load();
  if (!S) { view.innerHTML = ''; askName(true); return; }
  const missed = catchUp();
  tickAuctions(Date.now(), false);
  checkAchievements();
  save();
  render();
  if (missed) toast(`Willkommen zurück! Während du weg warst, sind <b>${missed} Markttage</b> vergangen.`, 6000);
}

window.addEventListener('pagehide', () => { if (S) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S) save(); });
setInterval(loop, 1000);
boot();

// Für Tests
window.__ch = {
  get state() { return S; },
  tick(n = 1) { for (let i = 0; i < n; i++) { S.lastTick = Date.now(); advanceDay(true); } checkAchievements(); save(); render(); },
  MODELS,
};

// Budget-Anzeige live mitziehen
document.addEventListener('input', e => {
  if (e.target.id === 'budget-range') { const v = $('#budget-val'); if (v) v.textContent = fmtEur(+e.target.value); }
});
