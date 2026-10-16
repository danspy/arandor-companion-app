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

/* ── Party character sprites (12×16, two walking frames) ─────────── */
export interface CharacterLook {
  skin: string;
  hair: string;
  body: string;     // tunic / robe / armour
  bodyAlt: string;  // belt, trim
  legs: string;
  hat: 'none' | 'wizard' | 'hood' | 'helmet' | 'band' | 'horns';
  weapon: 'none' | 'sword' | 'staff' | 'bow' | 'dagger' | 'axe' | 'mace' | 'lute';
  weaponColor: string;
}

const CLASS_LOOK: Record<string, Partial<CharacterLook>> = {
  fighter:   { body: '#7f8794', bodyAlt: '#b8453a', legs: '#4a4f5a', hat: 'helmet', weapon: 'sword', weaponColor: '#d8dde6' },
  paladin:   { body: '#d9d2c2', bodyAlt: C.gold,    legs: '#5a5f6b', hat: 'helmet', weapon: 'sword', weaponColor: '#f1ecd9' },
  barbarian: { body: '#8e5a3b', bodyAlt: '#5d3922', legs: '#6e4a30', hat: 'horns',  weapon: 'axe',   weaponColor: '#c9ccd4' },
  wizard:    { body: '#3f5fb5', bodyAlt: C.gold,    legs: '#2f4587', hat: 'wizard', weapon: 'staff', weaponColor: C.wood },
  sorcerer:  { body: '#9b3fb5', bodyAlt: '#e5a2ff', legs: '#6c2a80', hat: 'none',   weapon: 'none',  weaponColor: C.wood },
  warlock:   { body: '#3d2e52', bodyAlt: '#8a4ad0', legs: '#2a1f3b', hat: 'hood',   weapon: 'staff', weaponColor: '#5d3f85' },
  cleric:    { body: '#eae2cf', bodyAlt: '#c23b3b', legs: '#8b8578', hat: 'none',   weapon: 'mace',  weaponColor: '#c9ccd4' },
  druid:     { body: '#5d8a3c', bodyAlt: '#8f6a3b', legs: '#4a6b2f', hat: 'none',   weapon: 'staff', weaponColor: C.wood },
  ranger:    { body: '#3f7a46', bodyAlt: '#7c5a36', legs: '#5c4530', hat: 'hood',   weapon: 'bow',   weaponColor: C.wood },
  rogue:     { body: '#3a3a44', bodyAlt: '#6b6b7a', legs: '#2b2b33', hat: 'hood',   weapon: 'dagger', weaponColor: '#d8dde6' },
  monk:      { body: '#d98a3a', bodyAlt: '#8a4b1a', legs: '#b86f2a', hat: 'band',   weapon: 'none',  weaponColor: C.wood },
  bard:      { body: '#b8457a', bodyAlt: C.gold,    legs: '#5a3a6b', hat: 'none',   weapon: 'lute',  weaponColor: C.wood },
  artificer: { body: '#6b5b4b', bodyAlt: '#d0a24a', legs: '#4a3d31', hat: 'none',   weapon: 'mace',  weaponColor: '#c9a24a' },
};

const HAIR_COLORS: [RegExp, string][] = [
  [/blond|blonde|golden|yellow|fair/i, '#e8c565'],
  [/red|ginger|auburn|copper/i, '#b5432c'],
  [/white|silver|grey|gray|platinum/i, '#e4e4ec'],
  [/black|raven|dark/i, '#231a14'],
  [/brown|chestnut|brunette/i, '#6b4225'],
  [/blue/i, '#4a6fd8'], [/green/i, '#3f9a5a'], [/purple|violet/i, '#8a4ad0'], [/pink/i, '#e07aa8'],
];
const SKIN_COLORS: [RegExp, string][] = [
  [/pale|fair|light|ivory|porcelain/i, '#f3d9c4'],
  [/tan|olive|medium|bronze/i, '#d9a470'],
  [/dark|brown|ebony|deep/i, '#8a5a3a'],
  [/grey|gray|ashen|stone/i, '#a9a9b4'],
  [/green/i, '#7fa860'], [/blue/i, '#7f9fd0'], [/red|crimson/i, '#c46a5a'], [/gold|golden/i, '#e0b060'],
];

function pick(table: [RegExp, string][], value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  for (const [re, color] of table) if (re.test(value)) return color;
  return fallback;
}

/** Derive a sprite look from the character record (class, hair, skin, race). */
export function lookFor(ch: { class?: string | null; hair?: string | null; skin?: string | null; race?: string | null }, index = 0): CharacterLook {
  const key = (ch.class || '').toLowerCase().split(/[\s/]/)[0];
  const cls = CLASS_LOOK[key] || CLASS_LOOK[Object.keys(CLASS_LOOK)[index % Object.keys(CLASS_LOOK).length]];
  const race = (ch.race || '').toLowerCase();
  let skinFallback = '#f0c9a6';
  if (/orc/.test(race)) skinFallback = '#7fa860';
  else if (/tiefling/.test(race)) skinFallback = '#c46a5a';
  else if (/dragonborn/.test(race)) skinFallback = '#c99a3a';
  else if (/drow/.test(race)) skinFallback = '#8f88b8';
  return {
    skin: pick(SKIN_COLORS, ch.skin, skinFallback),
    hair: pick(HAIR_COLORS, ch.hair, ['#6b4225', '#231a14', '#e8c565', '#b5432c'][index % 4]),
    body: cls.body || '#7f8794',
    bodyAlt: cls.bodyAlt || C.gold,
    legs: cls.legs || '#4a4f5a',
    hat: cls.hat || 'none',
    weapon: cls.weapon || 'none',
    weaponColor: cls.weaponColor || C.wood,
  };
}

/* Character body template. Letters: H hair, S skin, E eye, B body, b trim, L legs, F feet, W weapon */
const BODY_FRAMES: string[][] = [
  [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSSSH...',
    '...SSESES...',
    '...SSSSSS...',
    '....SSSS....',
    '...BBBBBB...',
    '..BBBBBBBB..',
    '..SBBBBBBS..',
    '..SBBbbBBS..',
    '...BBBBBB...',
    '...LLLLLL...',
    '...LLL.LL...',
    '...LL..LL...',
    '...FF..FF...',
    '............',
  ],
  [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSSSH...',
    '...SSESES...',
    '...SSSSSS...',
    '....SSSS....',
    '...BBBBBB...',
    '..BBBBBBBB..',
    '..SBBBBBBS..',
    '..SBBbbBBS..',
    '...BBBBBB...',
    '...LLLLLL...',
    '..LLL..LLL..',
    '..LL....LL..',
    '..FF....FF..',
    '............',
  ],
];

const HATS: Record<CharacterLook['hat'], string[]> = {
  none: [],
  wizard: [
    '.....B......',
    '....BBB.....',
    '....BBB.....',
    '...BBBBB....',
    '..BBBbBBB...',
    '.BBBBBBBBB..',
  ],
  hood: [
    '....BBBB....',
    '...BBBBBB...',
    '...BBBBBB...',
    '...B....B...',
  ],
  helmet: [
    '....WWWW....',
    '...WWWWWW...',
    '...WWWWWW...',
    '...W....W...',
  ],
  band: [
    '............',
    '............',
    '...bbbbbb...',
  ],
  horns: [
    '..W......W..',
    '..WWHHHHWW..',
    '...HHHHHH...',
  ],
};

const WEAPONS: Record<CharacterLook['weapon'], string[]> = {
  none: [],
  sword: [
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '.........bWb',
    '..........t.',
  ],
  staff: [
    '..........g.',
    '.........gWg',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
  ],
  bow: [
    '.........W..',
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '..........W.',
    '.........W..',
  ],
  dagger: [
    '............', '............', '............', '............', '............', '............', '............',
    '..........W.',
    '..........W.',
    '..........t.',
  ],
  axe: [
    '.........WW.',
    '........WWW.',
    '.........WWW',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
  ],
  mace: [
    '.........WWW',
    '.........WWW',
    '.........WWW',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
    '..........t.',
  ],
  lute: [
    '............', '............', '............', '............', '............', '............',
    '..........t.',
    '..........t.',
    '.........ttt',
    '.........tWt',
    '.........ttt',
  ],
};

/** Build the two walking frames for a character look. */
export function characterSprites(look: CharacterLook): Sprite[] {
  const palette: Palette = {
    H: look.hair, S: look.skin, E: C.black, B: look.body, b: look.bodyAlt, L: look.legs, F: C.black,
    W: look.weaponColor, t: C.wood, g: C.gold,
  };
  return BODY_FRAMES.map((frame) => {
    const rows = frame.map((r) => r.split(''));
    const stamp = (layer: string[], yOffset: number) => {
      layer.forEach((line, y) => {
        const ty = y + yOffset; if (ty < 0 || ty >= rows.length) return;
        line.split('').forEach((ch, x) => { if (ch !== '.') rows[ty][x] = ch; });
      });
    };
    const hat = HATS[look.hat];
    if (look.hat === 'wizard') stamp(hat, -4 + 1); // hat sits above the head; rows above 0 are clipped
    else stamp(hat, 0);
    stamp(WEAPONS[look.weapon], 2);
    return { rows: rows.map((r) => r.join('')), palette };
  });
}

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
