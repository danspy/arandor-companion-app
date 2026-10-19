// The sheet shown on the character page, calculated from D&D Beyond at sync time
// (src/lib/dndbeyond.ts buildSheet) and stored in Character.sheet.
// Design: docs/superpowers/specs/2026-10-19-character-sheet-design.md

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const ABILITY_KEYS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export type Proficiency = 'none' | 'half' | 'proficient' | 'expertise';

export interface SheetSkill {
  key: string; // D&D Beyond slug, e.g. "sleight-of-hand"
  name: string;
  ability: Ability;
  bonus: number;
  proficiency: Proficiency;
}

export interface SheetAttack {
  name: string;
  kind: 'weapon' | 'spell' | 'unarmed';
  range: string;
  toHit: number | null;
  saveDc: number | null;
  damage: string | null;
  damageType: string | null;
  notes: string;
}

export interface SheetSpellcasting {
  className: string;
  ability: Ability;
  saveDc: number;
  attack: number;
}

export interface SheetFeature {
  name: string;
  source: string;
  description: string;
}

export interface SheetItem {
  name: string;
  quantity: number;
  equipped: boolean;
  attuned: boolean;
}

export interface CharacterSheet {
  version: 1;
  // public
  proficiencyBonus: number;
  ac: number;
  initiative: number;
  speed: number;
  passivePerception: number;
  saves: Record<Ability, { bonus: number; proficient: boolean }>;
  // private
  passiveInvestigation: number;
  passiveInsight: number;
  skills: SheetSkill[];
  spellcasting: SheetSpellcasting[];
  attacks: SheetAttack[];
  features: SheetFeature[];
  inventory: SheetItem[];
}

// ── Who sees what ────────────────────────────────────────────────────────────

const PUBLIC_KEYS = ['version', 'proficiencyBonus', 'ac', 'initiative', 'speed', 'passivePerception', 'saves'] as const;
export type PublicSheet = Pick<CharacterSheet, (typeof PUBLIC_KEYS)[number]>;

/** The part of the sheet everyone may see (stats and core rolls). */
export function publicSheet(sheet: CharacterSheet | null | undefined): PublicSheet | null {
  if (!sheet) return null;
  return Object.fromEntries(PUBLIC_KEYS.map((k) => [k, sheet[k]])) as PublicSheet;
}

/**
 * Skills, attacks, features and inventory: the character's player (Character.userId, or the
 * older User.characterIds link), the DM and admins.
 */
export function canSeePrivateSheet(
  character: { id: string; userId: string | null },
  user: { id: string; characterIds?: unknown } | null,
  role: string | null,
): boolean {
  if (role === 'admin' || role === 'dungeonmaster') return true;
  if (!user) return false;
  if (character.userId) return character.userId === user.id;
  return Array.isArray(user.characterIds) && user.characterIds.includes(character.id);
}

/** A character row for one viewer: the full sheet or only its public part. */
export function forViewer<T extends { sheet?: unknown }>(row: T, canSee: boolean): T {
  return canSee ? row : { ...row, sheet: publicSheet(row.sheet as CharacterSheet | null) };
}

/** A character row for lists and other APIs, which never need the sheet. */
export function withoutSheet<T extends { sheet?: unknown }>(row: T): Omit<T, 'sheet'> {
  const { sheet: _sheet, ...rest } = row;
  return rest;
}
