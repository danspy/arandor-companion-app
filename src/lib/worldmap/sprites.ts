/**
 * Pixel-art sprite definitions for the world map.
 *
 * Every sprite is a list of equal-length strings; each character indexes a
 * palette entry ('.' is transparent). Sprites are rasterised once into small
 * canvases and then blitted, so the definitions stay human-editable.
 */

export const TILE = 12; // world pixels per tile

export type Palette = Record<string, string>;

export interface Sprite {
  rows: string[];
  palette: Palette;
}

/* ── Shared colours ──────────────────────────────────────────────── */
export const C = {
  ocean: '#2b63a8',
  oceanDark: '#255a9a',
  oceanWave: '#4a86cc',
  shallow: '#4f93d6',
  shallowWave: '#7db6ea',
  lake: '#3a7fc4',
  river: '#56a0e2',
  riverLight: '#8cc5f0',
  sand: '#ead89d',
  sandDark: '#d5c184',
  grass: '#6db44a',
  grassDark: '#5a9d3b',
  grassLight: '#86c65c',
  trunk: '#6a452a',
  leaf: '#2f8a3f',
  leafLight: '#4faf52',
  leafDark: '#1e6230',
  pine: '#1f6f55',
  pineLight: '#2f8f6c',
  pineDark: '#134d3b',
  blossom: '#e088b4',
  blossomLight: '#f3b4d0',
  hill: '#8aa552',
  hillDark: '#6c8640',
  hillLight: '#a6bd68',
  rock: '#8f8f98',
  rockDark: '#66666f',
  rockLight: '#b6b6bf',
  snow: '#f5f7fb',
  snowShade: '#d6dbe8',
  field: '#d9b94e',
  fieldDark: '#bf9f3c',
  roofRed: '#b8453a',
  roofBlue: '#3f6fb5',
  wall: '#e8d9b8',
  wallDark: '#c9b68e',
  wood: '#8a5a33',
  stoneLight: '#aeb0ba',
  stone: '#7d7f8a',
  stoneDark: '#4f515b',
  black: '#1a1410',
  gold: '#c99032',
  ember: '#ea580c',
  white: '#ffffff',
};

/* Region flavour: base grass tint + preferred tree style */
export interface RegionStyle { grass: string; grassDark: string; grassLight: string; tree: 'leaf' | 'pine' | 'blossom' }
export const REGION_STYLE: Record<number, RegionStyle> = {
  0: { grass: C.grass, grassDark: C.grassDark, grassLight: C.grassLight, tree: 'leaf' },
  1: { grass: '#a3b94f', grassDark: '#8ba140', grassLight: '#bccd66', tree: 'leaf' },     // Requsanien – golden plains
  2: { grass: '#5fae72', grassDark: '#4c955f', grassLight: '#7cc48c', tree: 'pine' },     // Kongdonien – boreal
  3: { grass: '#8fb84f', grassDark: '#79a040', grassLight: '#a8cb66', tree: 'leaf' },     // Sianische Lande – warm
  4: { grass: '#62b24a', grassDark: '#4f9b3a', grassLight: '#7fc862', tree: 'leaf' },     // Mardunien – lush
  5: { grass: '#7ea86d', grassDark: '#68905a', grassLight: '#97bd86', tree: 'pine' },     // Rulik – highlands
  6: { grass: '#7cb75a', grassDark: '#669f48', grassLight: '#97cb74', tree: 'blossom' },  // Iriles – blossom groves
};

/* ── Terrain sprites (12×12) ─────────────────────────────────────── */
const TREE: Sprite = {
  rows: [
    '....dd......',
    '...dLLd.....',
    '..dLlLLd....',
    '.dLLlLLLd...',
    '.dLlLLLLd...',
    'dLLLLlLLLd..',
    'dLLLLLLLLd..',
    '.dLLLLLLd...',
    '..ddLLdd....',
    '....tt......',
    '....tt......',
    '...stts.....',
  ],
  palette: { d: C.leafDark, L: C.leaf, l: C.leafLight, t: C.trunk, s: C.grassDark },
};

const PINE: Sprite = {
  rows: [
    '.....d......',
    '....dPd.....',
    '....dPd.....',
    '...dPpPd....',
    '...dPPPd....',
    '..dPpPPPd...',
    '..dPPPPPd...',
    '.dPpPPPPPd..',
    '.dPPPPPPPd..',
    'dPPPPPPPPPd.',
    '.....tt.....',
    '....stts....',
  ],
  palette: { d: C.pineDark, P: C.pine, p: C.pineLight, t: C.trunk, s: C.grassDark },
};

const BLOSSOM: Sprite = {
  rows: [
    '....dd......',
    '...dBBd.....',
    '..dBbBBd....',
    '.dBBbBBBd...',
    '.dBbBBBBd...',
    'dBBBBbBBBd..',
    'dBBBBBBBBd..',
    '.dBBBBBBd...',
    '..ddBBdd....',
    '....tt......',
    '....tt......',
    '...stts.....',
  ],
  palette: { d: '#b45c8c', B: C.blossom, b: C.blossomLight, t: C.trunk, s: C.grassDark },
};

const HILL: Sprite = {
  rows: [
    '............',
    '............',
    '............',
    '.....lll....',
    '....lHHHl...',
    '...lHHHHHl..',
    '..lHHHHHHHd.',
    '.lHHHHHHHHd.',
    '.HHHHHHHHHdd',
    '............',
    '............',
    '............',
  ],
  palette: { l: C.hillLight, H: C.hill, d: C.hillDark },
};

const MOUNTAIN: Sprite = {
  rows: [
    '.....ll.....',
    '....lRRd....',
    '....lRRd....',
    '...lRRRRd...',
    '...lRRRRd...',
    '..lRRRRRRd..',
    '..lRRdRRRd..',
    '.lRRRRdRRRd.',
    '.lRRRRRRRRd.',
    'lRRRRRRRRRRd',
    'RRRRRRRRRRRd',
    'ddddddddddd.',
  ],
  palette: { l: C.rockLight, R: C.rock, d: C.rockDark },
};

const SNOWPEAK: Sprite = {
  rows: [
    '.....ss.....',
    '....sSSs....',
    '....sSSs....',
    '...sSSSSs...',
    '...sSShSs...',
    '..lRSSSSRd..',
    '..lRRdRRRd..',
    '.lRRRRdRRRd.',
    '.lRRRRRRRRd.',
    'lRRRRRRRRRRd',
    'RRRRRRRRRRRd',
    'ddddddddddd.',
  ],
  palette: { l: C.rockLight, R: C.rock, d: C.rockDark, s: C.snowShade, S: C.snow, h: C.snowShade },
};

/* ── Location icons (16×16, anchored bottom-centre) ──────────────── */
export const CITY: Sprite = {
  rows: [
    '.......g........',
    '......gg........',
    '......ww........',
    '.....wwww.......',
    '.....w..w.rrrr..',
    '..rrrw..wrrrrrr.',
    '.rrrrw..wwwwwww.',
    'rrrrrrw.wwkwwkw.',
    'wwwwwwwwwwwwwww.',
    'wwkwwwkwwwwwwww.',
    'wwwwwwwwwwkwwww.',
    'wwwwwwkwwwwwwww.',
    'ddddddddddddddd.',
    'dKKKKKKKKKKKKKd.',
    'dKKdKKKdKKKdKKd.',
    'ddddddddddddddd.',
  ],
  palette: { g: C.gold, w: C.wall, k: C.black, r: C.roofRed, d: C.stoneDark, K: C.stone },
};

export const BUILDING: Sprite = {
  rows: [
    '................',
    '................',
    '................',
    '......cc........',
    '......cc........',
    '....rrrrrrrr....',
    '...rrrrrrrrrr...',
    '..rrrrrrrrrrrr..',
    '.rrrrrrrrrrrrrr.',
    '..wwwwwwwwwwww..',
    '..wwkkwwwwkkww..',
    '..wwkkwwwwkkww..',
    '..wwwwwDDwwwww..',
    '..wwwwwDDwwwww..',
    '..wwwwwDDwwwww..',
    '..dddddddddddd..',
  ],
  palette: { c: C.stone, r: C.roofBlue, w: C.wall, k: C.black, D: C.wood, d: C.stoneDark },
};

export const DUNGEON: Sprite = {
  rows: [
    '................',
    '................',
    '......SSSS......',
    '....SSssssSS....',
    '...SssssssssS...',
    '..SsssKKKKsssS..',
    '..SssKKKKKKssS..',
    '.SssKKKKKKKKssS.',
    '.SssKKKKKKKKssS.',
    '.SssKKpKKpKKssS.',
    '.SssKKKKKKKKssS.',
    '.SssKKKKKKKKssS.',
    'SsssKKKKKKKKsssS',
    'SsssKKKKKKKKsssS',
    'SSSSKKKKKKKKSSSS',
    '................',
  ],
  palette: { S: C.stoneDark, s: C.stone, K: C.black, p: '#a24bd8' },
};

export const WILDERNESS: Sprite = {
  rows: [
    '................',
    '................',
    '.....d..........',
    '....dLd.........',
    '...dLlLd........',
    '..dLLlLLd....RR.',
    '..dLLLLLd...RRRR',
    '.dLLLLLLLd..RrRR',
    '.dLlLLLLLd..RRRR',
    '..dLLLLLd...RRRR',
    '...ddLdd....RRRR',
    '.....tt.....RRRR',
    '.....tt..RR.RRRR',
    '.....tt..RR.RRRR',
    '....stts.RR.RRRR',
    '................',
  ],
  palette: { d: C.leafDark, L: C.leaf, l: C.leafLight, t: C.trunk, s: C.grassDark, R: C.stone, r: C.stoneLight },
};

export const OTHER: Sprite = {
  rows: [
    '................',
    '................',
    '.......pp.......',
    '.......pEEEEE...',
    '.......pEEEEEE..',
    '.......pEEEEE...',
    '.......pEEEE....',
    '.......pEEE.....',
    '.......pp.......',
    '.......pp.......',
    '.......pp.......',
    '.......pp.......',
    '.......pp.......',
    '.......pp.......',
    '......dppd......',
    '......dddd......',
  ],
  palette: { p: C.wood, E: C.ember, d: C.stoneDark },
};

export const LOCATION_SPRITES: Record<string, Sprite> = {
  city: CITY,
  building: BUILDING,
  dungeon: DUNGEON,
  wilderness: WILDERNESS,
  other: OTHER,
};

/* ── Rasterisation helpers ───────────────────────────────────────── */
export function rasterize(sprite: Sprite, scale = 1): HTMLCanvasElement {
  const h = sprite.rows.length, w = sprite.rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = sprite.rows[y][x];
      if (ch === '.' || !sprite.palette[ch]) continue;
      ctx.fillStyle = sprite.palette[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

export function treeSprite(kind: RegionStyle['tree']): Sprite {
  return kind === 'pine' ? PINE : kind === 'blossom' ? BLOSSOM : TREE;
}

export const TERRAIN = { HILL, MOUNTAIN, SNOWPEAK };
