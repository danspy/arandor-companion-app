#!/usr/bin/env node
/**
 * trace-world.mjs
 *
 * Converts the hand-drawn political map (scripts/map-source/map.png) into a
 * compact tile grid that the browser renders as a pixel-art world.
 *
 * The runtime never loads the PNG; it only reads src/data/arandor-world.json.
 * Re-run this script whenever the source image changes:
 *
 *   node scripts/trace-world.mjs
 *
 * Coordinate contract (must stay stable — Location.mapX/mapY depend on it):
 *   Location pins are stored as 0–100 percentages of a *square* box in which
 *   the 1920×1006 image is letterboxed ("xMidYMid meet"). The JSON carries the
 *   `pct` block the client uses to convert percentages <-> tile coordinates.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'map-source', 'map.png');
const OUT = join(__dirname, '..', 'src', 'data', 'arandor-world.json');

const TILE_PX = 6; // source pixels per tile

// Reference colours sampled from the source image.
const REF = [
  { cls: 'water',    rgb: [176, 208, 240] },
  { cls: 'water',    rgb: [200, 224, 240] },
  { cls: 'water',    rgb: [184, 216, 240] },
  { cls: 'water',    rgb: [192, 216, 240] },
  { cls: 'water',    rgb: [64, 144, 200] },   // thick river strokes
  { cls: 'mountain', rgb: [232, 240, 248] },
  { cls: 'mountain', rgb: [232, 240, 240] },
  { cls: 'mountain', rgb: [224, 232, 240] },
  { cls: 'mountain', rgb: [232, 232, 232] },
  { cls: 'r1', rgb: [240, 232, 152] }, { cls: 'r1', rgb: [216, 200, 104] }, { cls: 'r1', rgb: [224, 224, 144] }, // Requsanien
  { cls: 'r2', rgb: [168, 216, 208] }, { cls: 'r2', rgb: [128, 184, 168] }, { cls: 'r2', rgb: [72, 168, 144] },  // Kongdonien
  { cls: 'r3', rgb: [240, 192, 176] }, { cls: 'r3', rgb: [216, 160, 136] }, { cls: 'r3', rgb: [224, 184, 168] }, // Sianische Lande
  { cls: 'r4', rgb: [200, 232, 168] }, { cls: 'r4', rgb: [168, 200, 128] }, { cls: 'r4', rgb: [184, 224, 168] }, // Mardunien
  { cls: 'r5', rgb: [192, 200, 224] }, { cls: 'r5', rgb: [152, 168, 192] },                                      // Rulik
  { cls: 'r6', rgb: [232, 192, 224] }, { cls: 'r6', rgb: [208, 152, 192] },                                      // Iriles
  { cls: 'ignore', rgb: [120, 96, 88] }, { cls: 'ignore', rgb: [80, 104, 104] }, { cls: 'ignore', rgb: [120, 112, 72] },
];
const REGION_NAMES = ['', 'Requsanien', 'Kongdonien', 'Sianische Lande', 'Mardunien', 'Rulik', 'Iriles'];
// Label anchors in source-image pixels (taken from the drawn names).
const REGION_LABELS = [
  null,
  { x: 325, y: 310 }, { x: 675, y: 245 }, { x: 600, y: 545 },
  { x: 1300, y: 500 }, { x: 1480, y: 235 }, { x: 1570, y: 685 },
];

function classify(r, g, b) {
  let best = null, bd = Infinity;
  for (const ref of REF) {
    const d = (r - ref.rgb[0]) ** 2 + (g - ref.rgb[1]) ** 2 + (b - ref.rgb[2]) ** 2;
    if (d < bd) { bd = d; best = ref.cls; }
  }
  return bd > 40 * 40 ? 'ignore' : best;
}

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const W = Math.floor(info.width / TILE_PX);
const H = Math.ceil(info.height / TILE_PX);

// 1. Majority classification per tile
const base = new Array(W * H).fill('water');  // water | mountain | land
const region = new Uint8Array(W * H);         // 0 = none / sea, 1..6
const riverPx = new Uint16Array(W * H);       // count of blue pixels inside a land tile
for (let ty = 0; ty < H; ty++) {
  for (let tx = 0; tx < W; tx++) {
    const counts = {};
    let total = 0, bluish = 0;
    // mask the printed scale bar in the bottom-right corner
    if (tx * TILE_PX > 1640 && ty * TILE_PX > 950) { base[ty * W + tx] = 'water'; continue; }
    for (let py = 0; py < TILE_PX; py++) {
      const y = ty * TILE_PX + py; if (y >= info.height) continue;
      for (let px = 0; px < TILE_PX; px++) {
        const x = tx * TILE_PX + px;
        const i = (y * info.width + x) * info.channels;
        const cls = classify(data[i], data[i + 1], data[i + 2]);
        // thin river strokes are anti-aliased against the land colour; count anything bluish
        if (data[i + 2] - data[i] >= 42 && data[i + 2] > data[i + 1] + 8) bluish++;
        if (cls === 'ignore') continue;
        counts[cls] = (counts[cls] || 0) + 1; total++;
      }
    }
    const idx = ty * W + tx;
    if (!total) { base[idx] = 'water'; continue; }
    let major = 'water', mc = -1;
    for (const [k, v] of Object.entries(counts)) if (v > mc) { mc = v; major = k; }
    const water = counts.water || 0;
    if (major === 'water' && water >= total * 0.5) { base[idx] = 'water'; continue; }
    if (major === 'water') { // thin river / halo inside land: pick the dominant land class instead
      let lm = null, lc = -1;
      for (const [k, v] of Object.entries(counts)) if (k !== 'water' && v > lc) { lc = v; lm = k; }
      major = lm || 'water';
    }
    if (major === 'mountain') { base[idx] = 'mountain'; }
    else if (major.startsWith('r')) { base[idx] = 'land'; region[idx] = Number(major[1]); }
    else base[idx] = 'water';
    if (base[idx] !== 'water') riverPx[idx] = Math.max(water, bluish);
  }
}

// 2. Give mountains a region (nearest land region by BFS) so they take the regional palette
{
  const q = [];
  const dist = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) if (base[i] === 'land') { dist[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (dist[j] !== -1 || base[j] === 'water') continue;
      dist[j] = dist[i] + 1; region[j] = region[i]; q.push(j);
    }
  }
}

// 3. Ocean vs lake: flood-fill water from the image border
const ocean = new Uint8Array(W * H);
{
  const q = [];
  for (let x = 0; x < W; x++) { q.push(x); q.push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { q.push(y * W); q.push(y * W + W - 1); }
  for (const i of q) if (base[i] === 'water') ocean[i] = 1;
  const seen = new Uint8Array(W * H);
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]; if (base[i] !== 'water' || seen[i]) continue; seen[i] = 1; ocean[i] = 1;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (base[j] === 'water' && !seen[j]) q.push(j);
    }
  }
}

// 4. Deterministic decoration (forests, hills, beaches, snow) — seeded so every build is identical
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { return t * t * (3 - 2 * t); }
function noise(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  return lerp(lerp(hash(x0, y0, s), hash(x0 + 1, y0, s), fx), lerp(hash(x0, y0 + 1, s), hash(x0 + 1, y0 + 1, s), fx), fy);
}
function fbm(x, y, s) { return 0.6 * noise(x / 9, y / 9, s) + 0.3 * noise(x / 4, y / 4, s + 7) + 0.1 * noise(x / 2, y / 2, s + 13); }

const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 'water' : base[y * W + x];
const grid = new Array(H);
// Forest density per region: Requsanien = open plains, Kongdonien = boreal, Mardunien = lush, Rulik = highlands
const FOREST_T = { 1: 0.70, 2: 0.52, 3: 0.62, 4: 0.55, 5: 0.66, 6: 0.60, 0: 0.62 };
for (let y = 0; y < H; y++) {
  let row = '';
  for (let x = 0; x < W; x++) {
    const i = y * W + x, b = base[i];
    let c;
    if (b === 'water') {
      const nearLand = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].some(([dx, dy]) => at(x + dx, y + dy) !== 'water');
      c = ocean[i] ? (nearLand ? 'w' : '~') : 'l';
    } else if (b === 'mountain') {
      const n4 = [[1,0],[-1,0],[0,1],[0,-1]].every(([dx, dy]) => at(x + dx, y + dy) === 'mountain');
      c = n4 && hash(x, y, 3) < 0.75 ? 's' : 'm';
    } else {
      const coast = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => at(x + dx, y + dy) === 'water');
      const nearMtn = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].some(([dx, dy]) => at(x + dx, y + dy) === 'mountain');
      const r = region[i];
      const f = fbm(x, y, 1);
      if (coast) c = hash(x, y, 5) < 0.75 ? 'b' : 'g';
      else if (nearMtn && hash(x, y, 4) < 0.7) c = 'h';
      else if (r === 5 && fbm(x, y, 2) > 0.64) c = 'h';           // Rulik highlands
      else if (f > FOREST_T[r] + 0.1) c = 'd';                    // dense forest
      else if (f > FOREST_T[r]) c = 'f';                           // forest
      else if (r === 1 && fbm(x, y, 9) > 0.62) c = 'y';            // Requsanien fields
      else if (hash(x, y, 6) < 0.04) c = 't';                      // lone tree
      else c = 'g';
      if (riverPx[i] >= 3 && c !== 'b') c = 'r';
    }
    row += c;
  }
  grid[y] = row;
}
const regionRows = [];
for (let y = 0; y < H; y++) { let s = ''; for (let x = 0; x < W; x++) s += String(region[y * W + x]); regionRows.push(s); }

// Percent <-> tile conversion constants (see header comment)
const imgAspect = info.width / info.height;              // 1.908
const bandH = 100 / imgAspect;                            // height of the image band inside the 100×100 box
const bandTop = (100 - bandH) / 2;

const out = {
  version: 1,
  source: 'scripts/map-source/map.png',
  tilePx: TILE_PX,
  width: W,
  height: H,
  pct: { bandTop, bandH, imgWidth: info.width, imgHeight: info.height },
  legend: {
    '~': 'ocean', 'w': 'shallow water', 'l': 'lake', 'r': 'river', 'g': 'grass', 'y': 'fields', 't': 'lone tree',
    'f': 'forest', 'd': 'dense forest', 'h': 'hills', 'm': 'mountain', 's': 'snow peak', 'b': 'beach',
  },
  regions: REGION_NAMES.map((name, id) => id === 0 ? null : ({
    id, name,
    x: REGION_LABELS[id].x / TILE_PX, y: REGION_LABELS[id].y / TILE_PX,
  })).filter(Boolean),
  grid,
  regionGrid: regionRows,
};
writeFileSync(OUT, JSON.stringify(out));
const stats = {};
for (const row of grid) for (const ch of row) stats[ch] = (stats[ch] || 0) + 1;
console.log(`Traced ${W}×${H} tiles →`, OUT);
console.log(stats);
