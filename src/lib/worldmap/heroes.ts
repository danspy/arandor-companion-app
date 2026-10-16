/**
 * Hand-drawn pixel heroes (16×24, two walking frames).
 *
 * A hero is described by a `HeroLook` (hair, beard, ears, tusks, outfit,
 * prop …) and composed from small pixel layers. Known heroes of the
 * campaign have hand-tuned looks in `HERO_LOOKS` (matched by name); every
 * other character gets a look derived from class, race, hair and skin.
 */

export const HERO_W = 16;
export const HERO_H = 24;

export type HairStyle = 'none' | 'short' | 'shaggy' | 'long' | 'wavy' | 'topknot' | 'tiedback' | 'braids';
export type BeardStyle = 'none' | 'scruff' | 'full' | 'long';
export type Headwear = 'none' | 'helmet' | 'hood' | 'wizardhat' | 'band';
export type Outfit = 'armor' | 'chain' | 'robe' | 'coat' | 'leather' | 'bare' | 'tunic' | 'dress';
export type Prop = 'none' | 'sword' | 'staff' | 'glaive' | 'log' | 'book' | 'magic' | 'instrument' | 'wraps' | 'mace' | 'bow' | 'dagger' | 'lute' | 'axe';

export interface HeroLook {
  skin: string;
  eyes: string;
  hair: { style: HairStyle; color: string };
  beard: { style: BeardStyle; color: string };
  ears: 'round' | 'pointed';
  tusks: boolean;
  headwear: Headwear;
  outfit: { style: Outfit; main: string; trim: string };
  cloak?: string;
  fur?: string;
  legs: string;
  boots: string;
  prop: Prop;
  propColor: string;
  glow?: string;
  stout?: boolean;
}

export interface HeroSource {
  id?: string; name?: string | null; class?: string | null; race?: string | null;
  hair?: string | null; skin?: string | null; gender?: string | null;
}

/* ── colour helpers ──────────────────────────────────────────────── */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
const OUTLINE = '#1a1410';
const WHITE = '#f8f8f4';

/* ── hand-tuned looks for the campaign's heroes (matched by name) ─── */
export const HERO_LOOKS: Record<string, HeroLook> = {
  sinatah: {
    skin: '#f2d7c3', eyes: '#2a1f1a',
    hair: { style: 'wavy', color: '#d4512b' }, beard: { style: 'none', color: '' },
    ears: 'pointed', tusks: false, headwear: 'none',
    outfit: { style: 'coat', main: '#3a2a52', trim: '#b88a3a' },
    legs: '#2a1f3b', boots: '#1a1410', prop: 'magic', propColor: '#e05cff', glow: '#ffa6f5',
  },
  alvar: {
    skin: '#e8c2a0', eyes: '#2a1f1a',
    hair: { style: 'none', color: '#c9c9c9' }, beard: { style: 'long', color: '#cfcfcf' },
    ears: 'round', tusks: false, headwear: 'none',
    outfit: { style: 'chain', main: '#8f949c', trim: '#5e6269' }, fur: '#d8d2c4',
    legs: '#5a4634', boots: '#3a2a1e', prop: 'log', propColor: '#6b452a', glow: '#3f8a3f', stout: true,
  },
  roval: {
    skin: '#f0cfb0', eyes: '#3b7ddd',
    hair: { style: 'wavy', color: '#6b4225' }, beard: { style: 'scruff', color: '#4e2f18' },
    ears: 'pointed', tusks: false, headwear: 'none',
    outfit: { style: 'armor', main: '#b7bcc8', trim: '#6c7280' }, cloak: '#2f5fa8',
    legs: '#3f4652', boots: '#2a2a2a', prop: 'sword', propColor: '#dfe4ec',
  },
  moronur: {
    skin: '#7fa05a', eyes: '#d83a2a',
    hair: { style: 'topknot', color: '#141414' }, beard: { style: 'none', color: '' },
    ears: 'pointed', tusks: true, headwear: 'none',
    outfit: { style: 'bare', main: '#5a3a22', trim: '#8a5a33' },
    legs: '#6b4a2b', boots: '#3a2a1e', prop: 'wraps', propColor: '#d98a3a',
  },
  bernstein: {
    skin: '#f0cfb0', eyes: '#2a1f1a',
    hair: { style: 'long', color: '#3a2a1e' }, beard: { style: 'scruff', color: '#2e2016' },
    ears: 'round', tusks: false, headwear: 'none',
    outfit: { style: 'robe', main: '#5f7f94', trim: '#8fb0c4' }, cloak: '#3f5c6e',
    legs: '#3a4a55', boots: '#222222', prop: 'instrument', propColor: '#c9ccd4', glow: '#58c8ff',
  },
  volrak: {
    skin: '#6f9a52', eyes: '#d83a2a',
    hair: { style: 'tiedback', color: '#141414' }, beard: { style: 'none', color: '' },
    ears: 'pointed', tusks: true, headwear: 'none',
    outfit: { style: 'leather', main: '#4a3a2e', trim: '#2e241c' },
    legs: '#3a2e24', boots: '#1f1a14', prop: 'glaive', propColor: '#3a3a3a', glow: '#9a9a9a',
  },
  barum: {
    skin: '#d9a876', eyes: '#2a1f1a',
    hair: { style: 'shaggy', color: '#3a2616' }, beard: { style: 'full', color: '#2e1d10' },
    ears: 'round', tusks: false, headwear: 'none',
    outfit: { style: 'tunic', main: '#c9c4b8', trim: '#8f887a' },
    legs: '#5a4a3a', boots: '#3a2a1e', prop: 'staff', propColor: '#6b452a', glow: '#c99032',
  },
  morrigan: {
    skin: '#f5e2d2', eyes: '#2a1f1a',
    hair: { style: 'braids', color: '#1a1416' }, beard: { style: 'none', color: '' },
    ears: 'round', tusks: false, headwear: 'none',
    outfit: { style: 'dress', main: '#1f1b22', trim: '#3a3340' },
    legs: '#1f1b22', boots: '#1a1410', prop: 'book', propColor: '#6b452a',
  },
};

/* ── derived looks for characters without a hand-tuned entry ─────── */
const HAIR_COLORS: [RegExp, string][] = [
  [/blond|blonde|golden|yellow|fair/i, '#e8c565'], [/red|ginger|auburn|copper/i, '#b5432c'],
  [/white|silver|grey|gray|platinum/i, '#e4e4ec'], [/black|raven|dark/i, '#231a14'],
  [/brown|chestnut|brunette/i, '#6b4225'], [/blue/i, '#4a6fd8'], [/green/i, '#3f9a5a'],
  [/purple|violet/i, '#8a4ad0'], [/pink/i, '#e07aa8'],
];
const SKIN_COLORS: [RegExp, string][] = [
  [/pale|fair|light|ivory|porcelain/i, '#f3d9c4'], [/tan|olive|medium|bronze/i, '#d9a470'],
  [/dark|brown|ebony|deep/i, '#8a5a3a'], [/grey|gray|ashen|stone/i, '#a9a9b4'],
  [/green/i, '#7fa05a'], [/blue/i, '#7f9fd0'], [/red|crimson/i, '#c46a5a'], [/gold|golden/i, '#e0b060'],
];
function pick(table: [RegExp, string][], value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  for (const [re, c] of table) if (re.test(value)) return c;
  return fallback;
}

const CLASS_LOOK: Record<string, Partial<HeroLook>> = {
  fighter:   { outfit: { style: 'armor', main: '#b7bcc8', trim: '#6c7280' }, headwear: 'helmet', prop: 'sword', propColor: '#dfe4ec', legs: '#3f4652', boots: '#2a2a2a' },
  paladin:   { outfit: { style: 'armor', main: '#d9d2c2', trim: '#b88a3a' }, cloak: '#2f5fa8', prop: 'sword', propColor: '#f1ecd9', legs: '#5a5f6b', boots: '#2a2a2a' },
  barbarian: { outfit: { style: 'leather', main: '#5a3a22', trim: '#3a2616' }, prop: 'axe', propColor: '#c9ccd4', legs: '#6e4a30', boots: '#3a2a1e' },
  wizard:    { outfit: { style: 'robe', main: '#3f5fb5', trim: '#b88a3a' }, headwear: 'wizardhat', prop: 'staff', propColor: '#6b452a', glow: '#c99032', legs: '#2f4587', boots: '#1a1410' },
  sorcerer:  { outfit: { style: 'coat', main: '#5a2a7a', trim: '#e5a2ff' }, prop: 'magic', propColor: '#c45cff', glow: '#f0b0ff', legs: '#3a1f4a', boots: '#1a1410' },
  warlock:   { outfit: { style: 'coat', main: '#3d2e52', trim: '#8a4ad0' }, headwear: 'hood', cloak: '#2a1f3b', prop: 'magic', propColor: '#8a4ad0', glow: '#c9a2ff', legs: '#2a1f3b', boots: '#1a1410' },
  cleric:    { outfit: { style: 'tunic', main: '#eae2cf', trim: '#c23b3b' }, prop: 'mace', propColor: '#c9ccd4', legs: '#8b8578', boots: '#3a2a1e' },
  druid:     { outfit: { style: 'robe', main: '#5d8a3c', trim: '#8f6a3b' }, prop: 'staff', propColor: '#6b452a', glow: '#8fd06a', legs: '#4a6b2f', boots: '#3a2a1e' },
  ranger:    { outfit: { style: 'leather', main: '#3f7a46', trim: '#7c5a36' }, headwear: 'hood', cloak: '#2f5a36', prop: 'bow', propColor: '#6b452a', legs: '#5c4530', boots: '#3a2a1e' },
  rogue:     { outfit: { style: 'leather', main: '#3a3a44', trim: '#6b6b7a' }, headwear: 'hood', cloak: '#2b2b33', prop: 'dagger', propColor: '#dfe4ec', legs: '#2b2b33', boots: '#1a1410' },
  monk:      { outfit: { style: 'bare', main: '#8a4b1a', trim: '#d98a3a' }, headwear: 'band', prop: 'wraps', propColor: '#d98a3a', legs: '#b86f2a', boots: '#3a2a1e' },
  bard:      { outfit: { style: 'tunic', main: '#b8457a', trim: '#b88a3a' }, prop: 'lute', propColor: '#6b452a', legs: '#5a3a6b', boots: '#3a2a1e' },
  artificer: { outfit: { style: 'tunic', main: '#6b5b4b', trim: '#d0a24a' }, prop: 'mace', propColor: '#c9a24a', legs: '#4a3d31', boots: '#3a2a1e' },
};

export function heroLook(src: HeroSource, index = 0): HeroLook {
  const name = (src.name || '').toLowerCase();
  for (const key of Object.keys(HERO_LOOKS)) if (name.includes(key)) return HERO_LOOKS[key];

  const cls = (src.class || '').toLowerCase().split(/[\s/]/)[0];
  const race = (src.race || '').toLowerCase();
  const gender = (src.gender || '').toLowerCase();
  const base = CLASS_LOOK[cls] || CLASS_LOOK[Object.keys(CLASS_LOOK)[index % Object.keys(CLASS_LOOK).length]];
  const orc = /orc/.test(race), elf = /elf|elv/.test(race), dwarf = /dwarf|dwarv/.test(race);
  const skin = pick(SKIN_COLORS, src.skin, orc ? '#7fa05a' : /tiefling/.test(race) ? '#c46a5a' : /dragonborn/.test(race) ? '#c99a3a' : /drow/.test(race) ? '#8f88b8' : '#f0c9a6');
  const hairColor = pick(HAIR_COLORS, src.hair, ['#6b4225', '#231a14', '#e8c565', '#b5432c'][index % 4]);
  return {
    skin, eyes: orc ? '#d83a2a' : '#2a1f1a',
    hair: { style: /female|f\b|woman/.test(gender) ? 'long' : orc ? 'tiedback' : 'short', color: hairColor },
    beard: { style: dwarf ? 'full' : 'none', color: shade(hairColor, 0.8) },
    ears: elf || orc ? 'pointed' : 'round', tusks: orc,
    headwear: base.headwear || 'none',
    outfit: base.outfit!, cloak: base.cloak, legs: base.legs!, boots: base.boots!,
    prop: base.prop || 'none', propColor: base.propColor || '#6b452a', glow: base.glow, stout: dwarf,
  };
}

/* ── composer ────────────────────────────────────────────────────── */
type Grid = (string | null)[][];

function newGrid(): Grid { return Array.from({ length: HERO_H }, () => Array(HERO_W).fill(null)); }
function px(g: Grid, x: number, y: number, c: string) { if (x >= 0 && y >= 0 && x < HERO_W && y < HERO_H) g[y][x] = c; }
function row(g: Grid, y: number, x0: number, x1: number, c: string) { for (let x = x0; x <= x1; x++) px(g, x, y, c); }
function col(g: Grid, x: number, y0: number, y1: number, c: string) { for (let y = y0; y <= y1; y++) px(g, x, y, c); }

function compose(look: HeroLook, frame: 0 | 1): Grid {
  const g = newGrid();
  const dy = look.stout ? 2 : 0;         // stout heroes: everything two rows lower, shorter legs
  const H = look.hair.color, Hd = shade(look.hair.color, 0.7);
  const S = look.skin, Sd = shade(look.skin, 0.8);
  const M = look.outfit.main, T = look.outfit.trim, Md = shade(M, 0.75), Ml = shade(M, 1.2);
  const headTop = 2 + dy, bodyTop = 9 + dy;

  /* back layers */
  if (look.cloak) {
    for (let y = bodyTop; y <= 19; y++) row(g, y, y < bodyTop + 2 ? 4 : 3, y < bodyTop + 2 ? 11 : 12, look.cloak);
    row(g, 19, 3, 12, shade(look.cloak, 0.7));
  }
  if (look.hair.style === 'long' || look.hair.style === 'wavy') {
    for (let y = headTop + 4; y <= bodyTop + 4; y++) {
      const w = look.hair.style === 'wavy' && y % 2 ? 1 : 0;
      row(g, y, 3 - w, 4, y > bodyTop + 2 ? Hd : H); row(g, y, 11, 12 + w, y > bodyTop + 2 ? Hd : H);
    }
  }
  if (look.hair.style === 'topknot') { col(g, 12, headTop + 1, headTop + 7, H); col(g, 13, headTop + 3, headTop + 6, Hd); }
  if (look.hair.style === 'tiedback') { col(g, 12, headTop + 2, headTop + 8, H); px(g, 12, headTop + 9, Hd); }

  /* legs + boots */
  const legTop = 17 + dy, legBottom = 21;
  const L = look.legs, B = look.boots;
  if (frame === 0) {
    col(g, 5, legTop, legBottom, L); col(g, 6, legTop, legBottom, L); col(g, 9, legTop, legBottom, L); col(g, 10, legTop, legBottom, L);
    row(g, 22, 4, 6, B); row(g, 23, 4, 6, OUTLINE); row(g, 22, 9, 11, B); row(g, 23, 9, 11, OUTLINE);
  } else {
    col(g, 5, legTop, legTop + 1, L); col(g, 6, legTop, legTop + 1, L); col(g, 9, legTop, legTop + 1, L); col(g, 10, legTop, legTop + 1, L);
    col(g, 4, legTop + 2, legBottom, L); col(g, 5, legTop + 2, legBottom, L); col(g, 10, legTop + 2, legBottom, L); col(g, 11, legTop + 2, legBottom, L);
    row(g, 22, 3, 5, B); row(g, 23, 3, 5, OUTLINE); row(g, 22, 10, 12, B); row(g, 23, 10, 12, OUTLINE);
  }
  if (look.stout) { row(g, 22, 3, 6, B); row(g, 22, 9, 12, B); }

  /* body */
  const long = look.outfit.style === 'robe' || look.outfit.style === 'dress';
  const bodyBottom = long ? 21 : bodyTop + 7;
  for (let y = bodyTop; y <= bodyBottom; y++) {
    const x0 = y === bodyTop ? 5 : look.stout ? 3 : 4, x1 = y === bodyTop ? 10 : look.stout ? 12 : 11;
    row(g, y, x0, x1, M);
  }
  // sleeves / arms
  const armColor = look.outfit.style === 'bare' ? S : M;
  col(g, 3, bodyTop + 1, bodyTop + 5, armColor); col(g, 12, bodyTop + 1, bodyTop + 5, armColor);
  px(g, 3, bodyTop + 6, S); px(g, 12, bodyTop + 6, S); // hands
  switch (look.outfit.style) {
    case 'armor':
      row(g, bodyTop + 1, 3, 4, T); row(g, bodyTop + 1, 11, 12, T);               // pauldrons
      px(g, 7, bodyTop + 2, Ml); px(g, 8, bodyTop + 2, Ml); px(g, 7, bodyTop + 3, Ml);
      row(g, bodyTop + 5, 4, 11, T); px(g, 7, bodyTop + 5, '#c99032'); px(g, 8, bodyTop + 5, '#c99032'); // belt + buckle
      break;
    case 'chain':
      for (let y = bodyTop + 1; y <= bodyBottom; y++) for (let x = 4; x <= 11; x++) if ((x + y) % 2 === 0) px(g, x, y, Ml);
      row(g, bodyTop + 5, 4, 11, T);
      break;
    case 'coat':
      col(g, 7, bodyTop + 1, bodyTop + 6, T); px(g, 8, bodyTop + 1, T);           // lapel / clasps
      row(g, bodyTop + 7, 4, 5, Md); row(g, bodyTop + 7, 10, 11, Md);             // coat tails
      row(g, bodyTop + 8, 4, 5, Md); row(g, bodyTop + 8, 10, 11, Md);
      break;
    case 'robe': case 'dress':
      row(g, bodyTop, 5, 10, T); row(g, 21, 4, 11, T);                             // collar + hem
      col(g, 7, bodyTop + 1, 20, Md);                                              // fold
      break;
    case 'leather':
      px(g, 5, bodyTop + 1, T); px(g, 6, bodyTop + 2, T); px(g, 7, bodyTop + 3, T); px(g, 8, bodyTop + 4, T); // strap
      row(g, bodyTop + 5, 4, 11, T);
      break;
    case 'bare':
      for (let y = bodyTop; y <= bodyBottom - 2; y++) row(g, y, y === bodyTop ? 5 : 4, y === bodyTop ? 10 : 11, S);
      px(g, 5, bodyTop + 1, M); px(g, 6, bodyTop + 2, M); px(g, 7, bodyTop + 3, M); px(g, 8, bodyTop + 4, M); // strap
      px(g, 6, bodyTop + 2, Sd); px(g, 9, bodyTop + 2, Sd);                        // pecs
      row(g, bodyTop + 5, 4, 11, T); row(g, bodyTop + 6, 4, 11, Md); row(g, bodyTop + 7, 5, 10, Md); // belt + waist
      break;
    case 'tunic':
      row(g, bodyTop + 5, 4, 11, T); px(g, 7, bodyTop, T); px(g, 8, bodyTop, T);
      break;
  }
  if (look.fur) {
    row(g, bodyTop, 3, 12, look.fur); row(g, bodyTop + 1, 2, 13, look.fur); row(g, bodyTop + 2, 2, 4, look.fur); row(g, bodyTop + 2, 11, 13, look.fur);
    for (const [x, y] of [[4, bodyTop], [8, bodyTop], [3, bodyTop + 1], [7, bodyTop + 1], [11, bodyTop + 1], [12, bodyTop + 2]]) px(g, x, y, shade(look.fur, 0.85));
  }

  /* head */
  row(g, headTop, 6, 9, S);
  for (let y = headTop + 1; y <= headTop + 5; y++) row(g, y, 5, 10, S);
  row(g, headTop + 6, 6, 9, S);
  px(g, 7, headTop + 7, S); px(g, 8, headTop + 7, S); // neck
  px(g, 4, headTop + 3, S); px(g, 11, headTop + 3, S); // ears
  if (look.ears === 'pointed') { px(g, 3, headTop + 2, S); px(g, 12, headTop + 2, S); px(g, 3, headTop + 3, Sd); px(g, 12, headTop + 3, Sd); }
  px(g, 6, headTop + 3, look.eyes); px(g, 9, headTop + 3, look.eyes);
  px(g, 7, headTop + 5, Sd); px(g, 8, headTop + 5, Sd); // mouth shadow

  /* beard */
  const Bc = look.beard.color, Bd = shade(look.beard.color || '#000000', 0.75);
  switch (look.beard.style) {
    case 'scruff': row(g, headTop + 5, 5, 10, Bc); row(g, headTop + 6, 6, 9, Bc); break;
    case 'full':
      px(g, 5, headTop + 4, Bc); px(g, 10, headTop + 4, Bc);
      row(g, headTop + 5, 5, 10, Bc); row(g, headTop + 6, 5, 10, Bc); row(g, headTop + 7, 6, 9, Bc); row(g, headTop + 8, 7, 8, Bd);
      break;
    case 'long':
      px(g, 5, headTop + 4, Bc); px(g, 10, headTop + 4, Bc);
      row(g, headTop + 5, 5, 10, Bc); row(g, headTop + 6, 5, 10, Bc); row(g, headTop + 7, 5, 10, Bc);
      row(g, headTop + 8, 5, 10, Bc); row(g, headTop + 9, 6, 9, Bc); row(g, headTop + 10, 6, 9, Bd); row(g, headTop + 11, 7, 8, Bd);
      px(g, 6, headTop + 8, Bd); px(g, 9, headTop + 8, Bd);
      break;
  }
  if (look.tusks) { px(g, 5, headTop + 5, WHITE); px(g, 10, headTop + 5, WHITE); px(g, 5, headTop + 4, WHITE); px(g, 10, headTop + 4, WHITE); }

  /* hair (front) */
  switch (look.hair.style) {
    case 'short':
      row(g, headTop - 1, 6, 9, H); row(g, headTop, 5, 10, H); px(g, 5, headTop + 1, H); px(g, 10, headTop + 1, H); break;
    case 'shaggy':
      row(g, headTop - 1, 5, 10, H); px(g, 6, headTop - 2, H); px(g, 8, headTop - 2, H); row(g, headTop, 4, 11, H);
      px(g, 4, headTop + 1, H); px(g, 11, headTop + 1, H); px(g, 4, headTop + 2, Hd); px(g, 11, headTop + 2, Hd); px(g, 5, headTop + 1, H); px(g, 10, headTop + 1, H);
      break;
    case 'long': case 'wavy':
      row(g, headTop - 1, 6, 9, H); row(g, headTop, 5, 10, H);
      col(g, 4, headTop + 1, headTop + 6, H); col(g, 11, headTop + 1, headTop + 6, H); px(g, 5, headTop + 1, H); px(g, 10, headTop + 1, H);
      if (look.hair.style === 'wavy') { px(g, 3, headTop + 4, H); px(g, 12, headTop + 4, H); px(g, 3, headTop + 6, Hd); px(g, 12, headTop + 6, Hd); }
      break;
    case 'topknot':
      row(g, headTop, 5, 10, H); px(g, 5, headTop + 1, H); px(g, 10, headTop + 1, H);
      row(g, headTop - 1, 6, 9, H); row(g, headTop - 2, 7, 8, Hd); px(g, 8, headTop - 3, H); px(g, 9, headTop - 3, H);
      break;
    case 'tiedback':
      row(g, headTop - 1, 6, 9, H); row(g, headTop, 5, 10, H); px(g, 5, headTop + 1, H); px(g, 10, headTop + 1, H); px(g, 11, headTop + 1, H);
      break;
    case 'braids':
      row(g, headTop - 1, 6, 9, H); row(g, headTop, 5, 10, H); px(g, 5, headTop + 1, H); px(g, 10, headTop + 1, H);
      for (let y = headTop + 1; y <= bodyTop + 6; y++) { px(g, 4, y, y % 2 ? H : Hd); px(g, 11, y, y % 2 ? H : Hd); }
      px(g, 4, bodyTop + 7, T); px(g, 11, bodyTop + 7, T);
      break;
    case 'none':
      px(g, 6, headTop, shade(S, 1.12)); break;
  }

  /* headwear */
  switch (look.headwear) {
    case 'helmet': row(g, headTop - 1, 5, 10, '#c9ccd4'); row(g, headTop, 4, 11, '#c9ccd4'); row(g, headTop + 1, 4, 11, '#9a9ea8'); px(g, 4, headTop + 2, '#9a9ea8'); px(g, 11, headTop + 2, '#9a9ea8'); break;
    case 'hood': { const c = look.cloak || Md; row(g, headTop - 1, 5, 10, c); row(g, headTop, 4, 11, c); col(g, 4, headTop + 1, headTop + 5, c); col(g, 11, headTop + 1, headTop + 5, c); break; }
    case 'wizardhat': row(g, headTop - 1, 3, 12, M); row(g, headTop - 2, 5, 10, M); row(g, headTop - 3, 6, 9, M); px(g, 7, headTop - 4, M); px(g, 8, headTop - 4, Ml); row(g, headTop - 1, 5, 10, T); break;
    case 'band': row(g, headTop + 1, 5, 10, look.propColor); break;
  }

  /* props (front) */
  const P = look.propColor, G = look.glow || '#ffffff';
  switch (look.prop) {
    case 'sword': col(g, 13, headTop + 1, bodyTop + 4, P); px(g, 13, headTop, WHITE); row(g, bodyTop + 5, 12, 14, '#c99032'); px(g, 13, bodyTop + 6, '#6b452a'); break;
    case 'dagger': col(g, 13, bodyTop + 2, bodyTop + 5, P); px(g, 13, bodyTop + 6, '#6b452a'); px(g, 12, bodyTop + 5, '#c99032'); px(g, 14, bodyTop + 5, '#c99032'); break;
    case 'staff': col(g, 13, headTop - 1, 21, P); px(g, 13, headTop - 2, G); px(g, 12, headTop - 2, shade(G, 0.8)); px(g, 14, headTop - 2, shade(G, 0.8)); px(g, 13, headTop - 3, shade(G, 1.15)); break;
    case 'mace': col(g, 13, bodyTop - 1, bodyTop + 6, '#6b452a'); row(g, bodyTop - 3, 12, 14, P); row(g, bodyTop - 2, 12, 14, P); px(g, 13, bodyTop - 4, P); break;
    case 'axe': col(g, 13, headTop + 2, bodyTop + 6, '#6b452a'); row(g, headTop + 1, 13, 15, P); row(g, headTop + 2, 14, 15, P); row(g, headTop + 3, 14, 15, P); px(g, 14, headTop + 4, P); break;
    case 'bow': col(g, 14, headTop + 2, bodyTop + 6, P); px(g, 13, headTop + 1, P); px(g, 13, bodyTop + 7, P); col(g, 13, headTop + 2, bodyTop + 6, '#e8e4d8'); break;
    case 'lute': row(g, bodyTop + 3, 9, 12, '#e0c080'); row(g, bodyTop + 4, 8, 12, P); row(g, bodyTop + 5, 8, 12, P); px(g, 10, bodyTop + 4, OUTLINE); col(g, 13, bodyTop + 1, bodyTop + 3, P); break;
    case 'glaive':
      col(g, 13, headTop + 1, 22, P); px(g, 13, headTop, '#5a5a5a');
      px(g, 13, headTop - 1, G); px(g, 14, headTop - 2, G); px(g, 14, headTop - 1, G); px(g, 15, headTop - 3, G); px(g, 15, headTop - 2, shade(G, 0.8)); px(g, 12, headTop - 2, shade(G, 0.8)); px(g, 12, headTop - 1, G);
      break;
    case 'log': {
      // tree trunk carried on the right shoulder, leaves at the top end
      const pts: [number, number][] = [[9, bodyTop - 1], [10, bodyTop - 1], [10, bodyTop - 2], [11, bodyTop - 2], [11, bodyTop - 3], [12, bodyTop - 3], [12, bodyTop - 4], [13, bodyTop - 4], [13, bodyTop - 5], [14, bodyTop - 5], [14, bodyTop - 6]];
      for (const [x, y] of pts) { px(g, x, y, P); px(g, x + 1, y, shade(P, 0.75)); }
      for (const [x, y] of [[14, bodyTop - 8], [15, bodyTop - 8], [13, bodyTop - 7], [14, bodyTop - 7], [15, bodyTop - 7], [15, bodyTop - 6], [15, bodyTop - 9]]) px(g, x, y, G);
      px(g, 14, bodyTop - 8, shade(G, 1.25));
      break;
    }
    case 'book': row(g, bodyTop + 4, 6, 10, P); row(g, bodyTop + 5, 6, 10, P); row(g, bodyTop + 4, 7, 9, '#efe6d2'); px(g, 8, bodyTop + 4, P); px(g, 6, bodyTop + 6, S); px(g, 10, bodyTop + 6, S); break;
    case 'magic':
      px(g, 2, bodyTop + 4, G); px(g, 1, bodyTop + 4, P); px(g, 2, bodyTop + 3, P); px(g, 2, bodyTop + 5, P); px(g, 1, bodyTop + 3, G); px(g, 0, bodyTop + 2, G); px(g, 1, bodyTop + 6, shade(P, 0.8)); px(g, 0, bodyTop + 5, G);
      break;
    case 'instrument':
      // right arm raised, glowing instrument above
      px(g, 12, bodyTop + 1, armColor); px(g, 13, bodyTop, armColor); px(g, 13, bodyTop - 1, S);
      row(g, bodyTop - 3, 12, 14, P); px(g, 13, bodyTop - 2, P);
      px(g, 11, bodyTop - 4, G); px(g, 15, bodyTop - 4, G); px(g, 13, bodyTop - 5, G); px(g, 11, bodyTop - 2, shade(G, 0.8)); px(g, 15, bodyTop - 2, shade(G, 0.8)); px(g, 12, bodyTop - 6, shade(G, 0.8));
      break;
    case 'wraps':
      col(g, 3, bodyTop + 3, bodyTop + 5, P); col(g, 12, bodyTop + 3, bodyTop + 5, P); px(g, 3, bodyTop + 4, shade(P, 0.8)); px(g, 12, bodyTop + 4, shade(P, 0.8));
      break;
  }
  return g;
}

/** Adds a 1px dark outline around every opaque pixel (classic pixel-art silhouette). */
function outline(g: Grid): Grid {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < HERO_H; y++) for (let x = 0; x < HERO_W; x++) {
    if (g[y][x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const yy = y + dy, xx = x + dx; return yy >= 0 && yy < HERO_H && xx >= 0 && xx < HERO_W && g[yy][xx]; });
    if (near) out[y][x] = OUTLINE;
  }
  return out;
}

export function heroSprites(look: HeroLook): HTMLCanvasElement[] {
  return ([0, 1] as const).map((frame) => {
    const g = outline(compose(look, frame));
    const c = document.createElement('canvas');
    c.width = HERO_W; c.height = HERO_H;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < HERO_H; y++) for (let x = 0; x < HERO_W; x++) { const col = g[y][x]; if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } }
    return c;
  });
}
