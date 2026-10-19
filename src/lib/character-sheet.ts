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
