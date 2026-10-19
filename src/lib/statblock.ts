// Bestiary stat blocks: the shape stored in the Creature table, the import of stat block text
// copied from D&D Beyond (2024 Monster Manual layout), validation for the API, and finding the
// rolls in action text ("+4", "5 (1d6 + 2) Slashing damage"). Pure functions, used in the
// browser and on the server.

import type { RollPart } from './dice-notation';

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];
export const ABILITY_NAMES: Record<Ability, string> = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

export interface AbilityScore {
  score: number;
  mod: number;
  save: number;
}

export interface StatEntry {
  name: string;
  text: string;
}

export interface StatSection {
  title: string; // "Traits", "Actions", "Bonus Actions", "Reactions", "Legendary Actions", …
  intro?: string;
  entries: StatEntry[];
}

export interface DetailLine {
  label: string; // "Skills", "Senses", …
  text: string;
}

/** A creature as edited and stored (without id and timestamps). */
export interface CreatureData {
  name: string;
  typeLine: string | null;
  ac: number | null;
  acNote: string | null;
  hp: number | null;
  hpFormula: string | null;
  initiative: number | null;
  speed: string | null;
  abilities: Partial<Record<Ability, AbilityScore>>;
  details: DetailLine[];
  sections: StatSection[];
  cr: string | null;
  xp: number | null;
  npcIds: string[];
  notes: string | null;
  sourceText: string | null;
}

export const SECTION_TITLES = ['Traits', 'Actions', 'Bonus Actions', 'Reactions', 'Legendary Actions', 'Mythic Actions', 'Lair Actions'];
export const DETAIL_LABELS = [
  'Skills', 'Saving Throws', 'Gear', 'Vulnerabilities', 'Resistances', 'Immunities',
  'Damage Vulnerabilities', 'Damage Resistances', 'Damage Immunities', 'Condition Immunities',
  'Senses', 'Languages', 'Proficiency Bonus',
];

export const emptyCreature = (): CreatureData => ({
  name: '', typeLine: null, ac: null, acNote: null, hp: null, hpFormula: null, initiative: null, speed: null,
  abilities: {}, details: [], sections: [], cr: null, xp: null, npcIds: [], notes: null, sourceText: null,
});

/** Ability modifier from a score (10 → +0, 15 → +2, 8 → −1). */
export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

/** "+2", "−1" (with a real minus sign, as in the books). */
export const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

// Numbers in pasted text may use a real minus (−), an en dash (–) or a hyphen
const toInt = (s: string) => parseInt(s.replace(/[−–]/g, '-').replace(/\s+/g, ''), 10);
const SIGNED = '[+\\-−–]\\s?\\d+';

// ── Import from D&D Beyond ─────────────────────────────────────────────────

export interface ImportResult {
  creature: CreatureData;
  /** Lines that could not be placed anywhere (they are also added to the notes). */
  unread: string[];
}

const SIZE_WORD = /\b(tiny|small|medium|large|huge|gargantuan)\b/i;

/**
 * Reads a stat block copied from D&D Beyond (2024 layout). Tolerant of how the copy lays out
 * whitespace and table cells. Whatever it can't place is reported, never dropped.
 */
export function importStatBlock(raw: string): ImportResult {
  const text = raw.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  const lines = text.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const c = emptyCreature();
  c.sourceText = raw.trim();
  const unread: string[] = [];
  if (!lines.length) return { creature: c, unread };

  c.name = lines[0];
  let i = 1;
  if (lines[1] && SIZE_WORD.test(lines[1]) && !/^(AC|HP|Speed)\b/.test(lines[1])) {
    c.typeLine = lines[1];
    i = 2;
  }

  // The header block, up to the first section heading. The ability table is read from the
  // header as a whole, because a copy may put each cell on its own line.
  const headerEnd = lines.findIndex((l, n) => n >= i && SECTION_TITLES.some((t) => l.toLowerCase() === t.toLowerCase()));
  const header = lines.slice(i, headerEnd < 0 ? lines.length : headerEnd);
  const flat = header.join(' ');
  const abilityRe = new RegExp(`\\b(str|dex|con|int|wis|cha)\\b\\s+(\\d{1,2})\\s+(${SIGNED})(?:\\s+(${SIGNED}))?`, 'gi');
  for (const m of flat.matchAll(abilityRe)) {
    const key = m[1].toLowerCase() as Ability;
    const mod = toInt(m[3]);
    c.abilities[key] = { score: parseInt(m[2], 10), mod, save: m[4] !== undefined ? toInt(m[4]) : mod };
  }

  for (const line of header) {
    let m: RegExpMatchArray | null;
    let used = false;
    if ((m = line.match(/^AC\s+(\d+)(?:\s*\(([^)]*)\))?/i))) {
      c.ac = parseInt(m[1], 10);
      if (m[2]) c.acNote = m[2];
      used = true;
    }
    if ((m = line.match(new RegExp(`\\bInitiative\\s+(${SIGNED})`, 'i')))) {
      c.initiative = toInt(m[1]);
      used = true;
    }
    if ((m = line.match(/^HP\s+(\d+)(?:\s*\(([^)]+)\))?/i))) {
      c.hp = parseInt(m[1], 10);
      if (m[2]) c.hpFormula = m[2].replace(/\s+/g, ' ').trim();
      used = true;
    }
    if ((m = line.match(/^Speed\s+(.+)$/i))) {
      c.speed = m[1];
      used = true;
    }
    if ((m = line.match(/^CR\s+([\d/]+)(?:\s*\(XP\s+([\d,]+)[^)]*\))?/i))) {
      c.cr = m[1];
      if (m[2]) c.xp = parseInt(m[2].replace(/,/g, ''), 10);
      used = true;
    }
    if (!used) {
      const label = DETAIL_LABELS.find((l) => line.toLowerCase().startsWith(l.toLowerCase() + ' '));
      if (label) {
        c.details.push({ label, text: line.slice(label.length).trim() });
        used = true;
      }
    }
    // Ability table rows and its MOD/SAVE headings
    if (!used && (/^(?:(?:str|dex|con|int|wis|cha)\b|mod\b|save\b|\d{1,2}$|[+\-−–]\s?\d+$)/i.test(line))) used = true;
    if (!used) unread.push(line);
  }

  // Sections: "Name. Text" starts an entry; other lines continue the last entry, or are the
  // section's intro ("Legendary Action Uses: 3 …") before its first entry.
  let section: StatSection | null = null;
  for (const line of lines.slice(headerEnd < 0 ? lines.length : headerEnd)) {
    const title = SECTION_TITLES.find((t) => line.toLowerCase() === t.toLowerCase());
    if (title) {
      section = { title, entries: [] };
      c.sections.push(section);
      continue;
    }
    if (!section) continue;
    const entry = line.match(/^([A-Z0-9][^.:]{0,70}?(?:\s*\([^)]{1,60}\))?)\.\s+(.+)$/);
    if (entry && isEntryName(entry[1])) {
      section.entries.push({ name: entry[1].trim(), text: entry[2].trim() });
    } else if (section.entries.length) {
      const last = section.entries[section.entries.length - 1];
      last.text += `\n${line}`;
    } else {
      section.intro = section.intro ? `${section.intro}\n${line}` : line;
    }
  }

  // The initiative bonus is the Dex modifier when the block doesn't say otherwise
  if (c.initiative === null && c.abilities.dex) c.initiative = c.abilities.dex.mod;
  if (unread.length) c.notes = `Not read from the paste:\n${unread.join('\n')}`;
  return { creature: c, unread };
}

// Action names are short and capitalised ("Fire Breath (Recharge 5–6)", "Legendary Resistance
// (3/Day, or 4/Day in Lair)"); a sentence that happens to end in a full stop is not.
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
function isEntryName(name: string): boolean {
  if (/^\d+\/Day\b/i.test(name)) return false; // spell lists ("1/Day Each: …")
  const words = name.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/);
  return words.length <= 6 && words.every((w) => /^[A-Z0-9]/.test(w) || SMALL_WORDS.has(w));
}

// ── Validation (API) ───────────────────────────────────────────────────────

export const CREATURE_LIMITS = { name: 80, line: 300, text: 5000, sections: 12, entries: 60, details: 30, notes: 10000, source: 30000, npcs: 50 } as const;

type Check = { ok: true; creature: CreatureData } | { ok: false; error: string };

/** Checks a creature sent by a browser and returns a clean copy (trimmed, nulls for blanks). */
export function validateCreature(value: unknown): Check {
  if (!value || typeof value !== 'object') return { ok: false, error: 'Not a creature' };
  const v = value as Record<string, unknown>;
  const L = CREATURE_LIMITS;
  const str = (x: unknown, max: number, what: string): string | null | Error => {
    if (x === null || x === undefined || x === '') return null;
    if (typeof x !== 'string') return new Error(`${what} must be text`);
    const t = x.trim();
    if (t.length > max) return new Error(`${what} is too long (max ${max} characters)`);
    return t || null;
  };
  const int = (x: unknown, min: number, max: number, what: string): number | null | Error => {
    if (x === null || x === undefined || x === '') return null;
    const n = typeof x === 'number' ? x : Number(x);
    if (!Number.isInteger(n) || n < min || n > max) return new Error(`${what} must be a whole number from ${min} to ${max}`);
    return n;
  };
  const fail = (e: Error): Check => ({ ok: false, error: e.message });

  const name = str(v.name, L.name, 'The name');
  if (name instanceof Error) return fail(name);
  if (!name) return { ok: false, error: 'The creature needs a name' };
  const c = emptyCreature();
  c.name = name;

  for (const [key, max, what] of [['typeLine', L.line, 'The type line'], ['acNote', L.line, 'The AC note'], ['hpFormula', 60, 'The HP formula'], ['speed', L.line, 'The speed'], ['cr', 10, 'The CR'], ['notes', L.notes, 'The notes'], ['sourceText', L.source, 'The pasted text']] as const) {
    const t = str(v[key], max, what);
    if (t instanceof Error) return fail(t);
    c[key] = t;
  }
  for (const [key, min, max, what] of [['ac', 0, 50, 'AC'], ['hp', 0, 10000, 'HP'], ['initiative', -10, 30, 'The initiative bonus'], ['xp', 0, 1000000, 'XP']] as const) {
    const n = int(v[key], min, max, what);
    if (n instanceof Error) return fail(n);
    c[key] = n;
  }

  if (v.abilities && typeof v.abilities === 'object') {
    for (const a of ABILITIES) {
      const s = (v.abilities as Record<string, any>)[a];
      if (!s) continue;
      const score = int(s.score, 0, 40, `${ABILITY_NAMES[a]}`);
      if (score instanceof Error) return fail(score);
      if (score === null) continue;
      const mod = int(s.mod ?? abilityMod(score), -10, 20, `${ABILITY_NAMES[a]} modifier`);
      const save = int(s.save ?? s.mod ?? abilityMod(score), -10, 30, `${ABILITY_NAMES[a]} save`);
      if (mod instanceof Error) return fail(mod);
      if (save instanceof Error) return fail(save);
      c.abilities[a] = { score, mod: mod ?? abilityMod(score), save: save ?? mod ?? abilityMod(score) };
    }
  }

  const details = Array.isArray(v.details) ? v.details : [];
  if (details.length > L.details) return { ok: false, error: `At most ${L.details} detail lines` };
  for (const d of details) {
    const label = str(d?.label, 40, 'A detail label');
    const text = str(d?.text, L.line * 3, 'A detail line');
    if (label instanceof Error) return fail(label);
    if (text instanceof Error) return fail(text);
    if (label && text) c.details.push({ label, text });
  }

  const sections = Array.isArray(v.sections) ? v.sections : [];
  if (sections.length > L.sections) return { ok: false, error: `At most ${L.sections} sections` };
  let count = 0;
  for (const s of sections) {
    const title = str(s?.title, 40, 'A section title');
    if (title instanceof Error) return fail(title);
    if (!title) return { ok: false, error: 'Every section needs a title' };
    const intro = str(s?.intro, L.text, `The intro of ${title}`);
    if (intro instanceof Error) return fail(intro);
    const section: StatSection = { title, entries: [] };
    if (intro) section.intro = intro;
    for (const e of Array.isArray(s?.entries) ? s.entries : []) {
      const n = str(e?.name, L.name, `A name in ${title}`);
      const t = str(e?.text, L.text, `${typeof e?.name === 'string' ? e.name : 'An entry'} in ${title}`);
      if (n instanceof Error) return fail(n);
      if (t instanceof Error) return fail(t);
      if (!n && !t) continue;
      if (!n) return { ok: false, error: `An entry in ${title} needs a name` };
      if (++count > L.entries) return { ok: false, error: `At most ${L.entries} traits and actions` };
      section.entries.push({ name: n, text: t ?? '' });
    }
    c.sections.push(section);
  }

  const npcIds = Array.isArray(v.npcIds) ? v.npcIds : [];
  if (npcIds.length > L.npcs || npcIds.some((id) => typeof id !== 'string' || id.length > 64)) return { ok: false, error: 'Invalid NPC list' };
  c.npcIds = [...new Set(npcIds as string[])];
  return { ok: true, creature: c };
}

// ── Rolls in action text ───────────────────────────────────────────────────

/** A dice expression found in text, e.g. "5 (1d6 + 2) Slashing damage". */
export interface TextRoll {
  start: number; // index of the part to turn into a button: "(1d6 + 2)" or "+4"
  end: number;
  expr: string; // "1d6+2", or "1d20+4" for an attack bonus
  label: string; // "Slashing", "To hit", "Recharge", …
  kind: 'attack' | 'damage' | 'dice' | 'recharge';
  conditional?: boolean; // "… if the attack roll had Advantage"
}

const DICE_IN_PARENS = /\((\d+d\d+(?:\s*[+\-−–]\s*\d+)?)\)/g;
const cleanExpr = (s: string) => s.replace(/[−–]/g, '-').replace(/\s+/g, '');

/** All rolls in an entry's text, in reading order. */
export function findRolls(text: string): TextRoll[] {
  const rolls: TextRoll[] = [];
  const attack = text.match(new RegExp(`Attack Roll:\\s*(${SIGNED})`, 'i'));
  if (attack && attack.index !== undefined) {
    const at = attack.index + attack[0].lastIndexOf(attack[1]);
    rolls.push({ start: at, end: at + attack[1].length, expr: `1d20${cleanExpr(attack[1]).replace(/^\+?/, '+').replace('+-', '-')}`, label: 'To hit', kind: 'attack' });
  }
  for (const m of text.matchAll(DICE_IN_PARENS)) {
    const after = text.slice(m.index! + m[0].length);
    const type = after.match(/^\s*([A-Z][a-z]+)?\s*damage\b/i);
    // The rest of the clause decides whether this damage only applies sometimes
    const clause = after.split(/[.;]|,\s*(?:plus|and)\b/)[0];
    rolls.push({
      start: m.index!,
      end: m.index! + m[0].length,
      expr: cleanExpr(m[1]),
      label: type ? (type[1] ?? 'Damage') : '',
      kind: type ? 'damage' : 'dice',
      conditional: type ? /\b(if|while|when|against|instead)\b/i.test(clause) : undefined,
    });
  }
  // Spellcasting: "(spell save DC 21, +13 to hit with spell attacks)"
  if (!attack) {
    const spell = text.match(new RegExp(`(${SIGNED})\\s+to hit\\b`, 'i'));
    if (spell && spell.index !== undefined) {
      rolls.push({ start: spell.index, end: spell.index + spell[1].length, expr: `1d20${cleanExpr(spell[1]).replace(/^\+?/, '+').replace('+-', '-')}`, label: 'Spell attack', kind: 'attack' });
    }
  }
  const recharge = text.match(/\bRecharge\s+(\d)(?:\s*[–\-−]\s*\d)?/);
  if (recharge && recharge.index !== undefined) {
    rolls.push({ start: recharge.index, end: recharge.index + recharge[0].length, expr: '1d6', label: 'Recharge', kind: 'recharge' });
  }
  return rolls.sort((a, b) => a.start - b.start);
}

/**
 * The roll for an attack entry's name button: to hit, then the damage it always deals on a hit
 * ("Hit: 5 (1d6 + 2) Slashing damage plus 3 (1d6) Fire damage"). Null for entries without an
 * attack roll.
 */
export function attackParts(text: string): RollPart[] | null {
  const rolls = findRolls(text);
  const toHit = rolls.find((r) => r.kind === 'attack' && r.label === 'To hit'); // not a spell attack bonus
  if (!toHit) return null;
  const hitAt = text.search(/\bHit:/i);
  const missAt = text.search(/\b(Miss|Hit or Miss):/i);
  const parts: RollPart[] = [{ label: 'To hit', expr: toHit.expr }];
  for (const r of rolls) {
    if (r.kind !== 'damage' || r.conditional) continue;
    if (hitAt >= 0 && r.start < hitAt) continue;
    if (missAt > hitAt && r.start > missAt) continue;
    parts.push({ label: r.label || 'Damage', expr: r.expr });
    if (parts.length === 4) break; // the dice engine's limit per roll
  }
  return parts;
}

/** Name for numbering copies: "Goblin Warrior 3". */
export function nextCopyNumbers(base: string, existingNames: string[], count: number): string[] {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  const used = existingNames.map((n) => n.match(re)?.[1]).filter(Boolean).map(Number);
  const start = used.length ? Math.max(...used) + 1 : 1;
  return Array.from({ length: count }, (_, i) => (count === 1 && !used.length && !existingNames.includes(base) ? base : `${base} ${start + i}`));
}
