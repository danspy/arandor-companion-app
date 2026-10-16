/**
 * World model: tile grid access, coordinate conversion, terrain pre-render
 * and A* routing between two world points.
 */
import worldData from '../../data/arandor-world.json';
import { C, REGION_STYLE, TILE, TERRAIN, rasterize, treeSprite, type Sprite } from './sprites';

export interface WorldData {
  width: number;
  height: number;
  tilePx: number;
  pct: { bandTop: number; bandH: number; imgWidth: number; imgHeight: number };
  regions: { id: number; name: string; x: number; y: number }[];
  grid: string[];
  regionGrid: string[];
}

export const world = worldData as WorldData;
export const WORLD_W = world.width * TILE;
export const WORLD_H = world.height * TILE;

export const tileAt = (tx: number, ty: number): string =>
  tx < 0 || ty < 0 || tx >= world.width || ty >= world.height ? '~' : world.grid[ty][tx];
export const regionAt = (tx: number, ty: number): number =>
  tx < 0 || ty < 0 || tx >= world.width || ty >= world.height ? 0 : Number(world.regionGrid[ty][tx]);

const WATER = new Set(['~', 'w', 'l']);
export const isWater = (ch: string) => WATER.has(ch);

/* ── Percent (DB) <-> world pixel conversion ─────────────────────── */
export function pctToWorld(mapX: number, mapY: number) {
  const { bandTop, bandH } = world.pct;
  return { x: (mapX / 100) * WORLD_W, y: ((mapY - bandTop) / bandH) * WORLD_H };
}
export function worldToPct(x: number, y: number) {
  const { bandTop, bandH } = world.pct;
  return {
    mapX: Math.max(0, Math.min(100, (x / WORLD_W) * 100)),
    mapY: Math.max(0, Math.min(100, bandTop + (y / WORLD_H) * bandH)),
  };
}

/* ── Deterministic per-tile hash for texture variation ───────────── */
export function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ── Terrain pre-render ──────────────────────────────────────────── */
function speckle(ctx: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number, dark: string, light: string, n = 3) {
  for (let i = 0; i < n; i++) {
    const sx = Math.floor(hash(tx, ty, 20 + i) * TILE), sy = Math.floor(hash(tx, ty, 40 + i) * TILE);
    ctx.fillStyle = hash(tx, ty, 60 + i) < 0.5 ? dark : light;
    ctx.fillRect(px + sx, py + sy, 1, 1);
  }
}

/**
 * Renders the whole world once into an offscreen canvas (WORLD_W × WORLD_H).
 * Everything is drawn with integer pixels so CSS/canvas scaling stays crisp.
 */
export function renderTerrain(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_W; canvas.height = WORLD_H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = false;

  const cache = new Map<string, HTMLCanvasElement>();
  const sprite = (key: string, s: Sprite) => {
    let c = cache.get(key); if (!c) { c = rasterize(s); cache.set(key, c); } return c;
  };

  ctx.fillStyle = C.ocean; ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  for (let ty = 0; ty < world.height; ty++) {
    for (let tx = 0; tx < world.width; tx++) {
      const ch = tileAt(tx, ty), px = tx * TILE, py = ty * TILE;
      const style = REGION_STYLE[regionAt(tx, ty)] || REGION_STYLE[0];

      if (ch === '~' || ch === 'w' || ch === 'l') {
        ctx.fillStyle = ch === '~' ? (hash(tx, ty, 1) < 0.5 ? C.ocean : C.oceanDark) : ch === 'w' ? C.shallow : C.lake;
        ctx.fillRect(px, py, TILE, TILE);
        // wave strokes
        const r = hash(tx, ty, 2);
        if (r < (ch === 'w' ? 0.5 : 0.22)) {
          ctx.fillStyle = ch === 'w' ? C.shallowWave : C.oceanWave;
          const wy = py + 2 + Math.floor(hash(tx, ty, 3) * 8), wx = px + 1 + Math.floor(hash(tx, ty, 4) * 5);
          ctx.fillRect(wx, wy, 4, 1); ctx.fillRect(wx + 5, wy + 1, 2, 1);
        }
        continue;
      }

      // land base
      ctx.fillStyle = ch === 'b' ? C.sand : style.grass;
      ctx.fillRect(px, py, TILE, TILE);
      if (ch === 'b') speckle(ctx, px, py, tx, ty, C.sandDark, C.sand, 3);
      else speckle(ctx, px, py, tx, ty, style.grassDark, style.grassLight, 4);

      switch (ch) {
        case 'y': { // ploughed fields
          ctx.fillStyle = C.field; ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = C.fieldDark;
          for (let r = 2; r < TILE - 1; r += 3) ctx.fillRect(px + 1, py + r, TILE - 2, 1);
          break;
        }
        case 't': case 'f': case 'd': {
          const tree = sprite('tree-' + style.tree, treeSprite(style.tree));
          if (ch === 'd') {
            ctx.fillStyle = style.grassDark; ctx.fillRect(px, py, TILE, TILE);
            ctx.drawImage(tree, px - 3, py - 2); ctx.drawImage(tree, px + 3, py + 1);
          } else if (ch === 'f') {
            const ox = Math.floor(hash(tx, ty, 7) * 3) - 1;
            ctx.drawImage(tree, px + ox, py);
          } else {
            ctx.drawImage(tree, px, py + 1);
          }
          break;
        }
        case 'h': ctx.drawImage(sprite('hill', TERRAIN.HILL), px, py); break;
        case 'm': ctx.drawImage(sprite('mtn', TERRAIN.MOUNTAIN), px, py); break;
        case 's': ctx.drawImage(sprite('snow', TERRAIN.SNOWPEAK), px, py); break;
        case 'r': {
          // river: connect the tile centre to every neighbouring water/river tile
          const cx = px + TILE / 2, cy = py + TILE / 2;
          const n: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          let connected = 0;
          ctx.fillStyle = C.river;
          for (const [dx, dy] of n) {
            const nb = tileAt(tx + dx, ty + dy);
            if (nb === 'r' || isWater(nb)) {
              connected++;
              if (dx) ctx.fillRect(dx > 0 ? cx : px, cy - 1, TILE / 2, 3);
              else ctx.fillRect(cx - 1, dy > 0 ? cy : py, 3, TILE / 2);
            }
          }
          if (!connected) { ctx.fillRect(cx - 2, cy - 2, 5, 4); }
          ctx.fillStyle = C.riverLight; ctx.fillRect(cx - 1, cy - 1, 1, 1);
          break;
        }
      }
    }
  }

  // coast foam line: 1px light rim on water tiles touching land
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let ty = 0; ty < world.height; ty++) {
    for (let tx = 0; tx < world.width; tx++) {
      if (!isWater(tileAt(tx, ty))) continue;
      const px = tx * TILE, py = ty * TILE;
      if (!isWater(tileAt(tx, ty - 1))) ctx.fillRect(px, py, TILE, 1);
      if (!isWater(tileAt(tx, ty + 1))) ctx.fillRect(px, py + TILE - 1, TILE, 1);
      if (!isWater(tileAt(tx - 1, ty))) ctx.fillRect(px, py, 1, TILE);
      if (!isWater(tileAt(tx + 1, ty))) ctx.fillRect(px + TILE - 1, py, 1, TILE);
    }
  }
  return canvas;
}

/** A small repeating ocean swatch (8×8 tiles) used to fill the sea beyond the traced world. */
export function renderOceanSwatch(): HTMLCanvasElement {
  const n = 8, c = document.createElement('canvas');
  c.width = n * TILE; c.height = n * TILE;
  const ctx = c.getContext('2d', { alpha: false })!;
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
    const px = tx * TILE, py = ty * TILE, hx = tx + 1000, hy = ty + 1000;
    ctx.fillStyle = hash(hx, hy, 1) < 0.5 ? C.ocean : C.oceanDark;
    ctx.fillRect(px, py, TILE, TILE);
    if (hash(hx, hy, 2) < 0.22) {
      ctx.fillStyle = C.oceanWave;
      const wy = py + 2 + Math.floor(hash(hx, hy, 3) * 8), wx = px + 1 + Math.floor(hash(hx, hy, 4) * 5);
      ctx.fillRect(wx, wy, 4, 1); ctx.fillRect(wx + 5, wy + 1, 2, 1);
    }
  }
  return c;
}

/* ── A* routing over the tile grid ───────────────────────────────── */
const COST: Record<string, number> = {
  g: 1, y: 1, t: 1.1, b: 1.2, r: 1.4, f: 1.7, d: 2.4, h: 2.0, m: 5.5, s: 8, w: 3.2, l: 3.8, '~': 4.2,
};

class Heap {
  private a: { i: number; f: number }[] = [];
  get size() { return this.a.length; }
  push(n: { i: number; f: number }) {
    this.a.push(n); let k = this.a.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (this.a[p].f <= this.a[k].f) break; [this.a[p], this.a[k]] = [this.a[k], this.a[p]]; k = p; }
  }
  pop() {
    const top = this.a[0], last = this.a.pop()!;
    if (this.a.length) { this.a[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < this.a.length && this.a[l].f < this.a[m].f) m = l; if (r < this.a.length && this.a[r].f < this.a[m].f) m = r; if (m === k) break; [this.a[m], this.a[k]] = [this.a[k], this.a[m]]; k = m; } }
    return top;
  }
}

/** Returns a polyline (world px) from a to b following cheap terrain; falls back to a straight line. */
export function findRoute(ax: number, ay: number, bx: number, by: number): { x: number; y: number }[] {
  const W = world.width, H = world.height;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
  const sx = clamp(Math.floor(ax / TILE), W), sy = clamp(Math.floor(ay / TILE), H);
  const ex = clamp(Math.floor(bx / TILE), W), ey = clamp(Math.floor(by / TILE), H);
  const start = sy * W + sx, goal = ey * W + ex;
  if (start === goal) return [{ x: ax, y: ay }, { x: bx, y: by }];

  const g = new Float32Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const heap = new Heap();
  const hfn = (i: number) => { const x = i % W, y = (i / W) | 0; const dx = Math.abs(x - ex), dy = Math.abs(y - ey); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  g[start] = 0; heap.push({ i: start, f: hfn(start) });
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false, expanded = 0;
  while (heap.size) {
    const { i } = heap.pop();
    if (closed[i]) continue;
    if (i === goal) { found = true; break; }
    closed[i] = 1;
    if (++expanded > 60000) break;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (closed[j]) continue;
      const cost = (COST[tileAt(nx, ny)] ?? 1) * (dx && dy ? 1.414 : 1);
      const ng = g[i] + cost;
      if (ng < g[j]) { g[j] = ng; from[j] = i; heap.push({ i: j, f: ng + hfn(j) }); }
    }
  }
  if (!found) return [{ x: ax, y: ay }, { x: bx, y: by }];
  const tiles: number[] = [];
  for (let i = goal; i !== -1; i = from[i]) tiles.push(i);
  tiles.reverse();
  // string-pull: drop intermediate points that lie on a straight run
  const pts = tiles.map((i) => ({ x: (i % W) * TILE + TILE / 2, y: ((i / W) | 0) * TILE + TILE / 2 }));
  const out: { x: number; y: number }[] = [{ x: ax, y: ay }];
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k - 1], q = pts[k], r = pts[k + 1];
    if ((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) !== 0) out.push(q);
  }
  out.push({ x: bx, y: by });
  return out;
}

/** True when the segment between two route points crosses water (used to draw a "by sea" trail). */
export function segmentOverWater(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  return isWater(tileAt(Math.floor(mx / TILE), Math.floor(my / TILE)));
}
