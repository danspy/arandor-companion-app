/**
 * Shared utilities for D&D Beyond API integration.
 *
 * D&D Beyond's character JSON holds the raw choices, not the numbers the sheet shows, so the
 * sheet's maths is redone here. The one place that does it: the import, the full sync and the
 * HP syncs all go through these functions. Checked against real sheets in e2e/dndbeyond.spec.ts.
 */

import { ABILITY_KEYS, type Ability, type CharacterSheet, type Proficiency, type SheetSkill } from './character-sheet';

export interface DnDBeyondHPData {
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  deathSaveSuccesses?: number;
  deathSaveFailures?: number;
  isStable?: boolean;
}

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface DnDBeyondCharacterData extends DnDBeyondHPData {
  name?: string;
  race?: string;
  class?: string;
  level?: number;
  avatarUrl?: string;
  gender?: string;
  alignment?: string;
  background?: string;
  age?: number;
  height?: string;
  weight?: number;
  eyes?: string;
  skin?: string;
  hair?: string;
  stats?: AbilityScores;
  sheet?: CharacterSheet;
}

// Stat ids used by D&D Beyond (1=STR … 6=CHA), in the order of AbilityScores
const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;

const ALIGNMENTS: Record<number, string> = {
  1: 'Lawful Good', 2: 'Neutral Good', 3: 'Chaotic Good',
  4: 'Lawful Neutral', 5: 'True Neutral', 6: 'Chaotic Neutral',
  7: 'Lawful Evil', 8: 'Neutral Evil', 9: 'Chaotic Evil',
};

export const abilityModifier = (score: number) => Math.floor((score - 10) / 2);

// componentTypeId D&D Beyond uses for modifiers that come from an item
const ITEM_COMPONENT_TYPE = 112130694;

const valueOf = (m: any): number => m?.value ?? m?.fixedValue ?? 0;

/**
 * Every modifier that currently applies. D&D Beyond sends them grouped by source
 * ({ race: [], class: [], background: [], item: [], feat: [], condition: [] }).
 * Item modifiers only count while the item is equipped (and attuned, if it needs that);
 * their componentId is the item's definition id.
 */
export function activeModifiers(data: any): any[] {
  const groups = data?.data?.modifiers;
  if (!groups || typeof groups !== 'object') return [];
  if (Array.isArray(groups)) return groups;
  const inventory: any[] = data.data?.inventory || [];
  const result: any[] = [];
  for (const [source, list] of Object.entries(groups)) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      if (source === 'item') {
        const item = inventory.find((i) => i.definition?.id === m.componentId);
        if (!item?.equipped) continue;
        if ((m.requiresAttunement || item.definition?.canAttune) && !item.isAttuned) continue;
      }
      result.push(m);
    }
  }
  return result;
}

/**
 * One ability score the way the sheet shows it: an override wins outright; otherwise the base
 * score plus species/feat/class/item bonuses (capped at 20), raised to any "set" value
 * (e.g. Amulet of Health), plus the sheet's "Other" bonus, which may pass 20.
 *
 * @param statId - Stat ID (1=STR, 2=DEX, 3=CON, 4=INT, 5=WIS, 6=CHA)
 */
export function calculateAbilityScore(statId: number, data: any, modifiers = activeModifiers(data)): number {
  const find = (key: string) => (data?.data?.[key] || []).find((s: any) => s.id === statId)?.value;
  const override = find('overrideStats');
  if (override !== null && override !== undefined) return override;

  const subType = `${ABILITIES[statId - 1]}-score`;
  let score = find('stats') ?? 10;
  let setTo = 0;
  for (const m of modifiers) {
    if (m.subType !== subType) continue;
    if (m.type === 'bonus') score += valueOf(m);
    else if (m.type === 'set') setTo = Math.max(setTo, valueOf(m));
  }
  score = Math.max(Math.min(score, 20), setTo);
  return score + (find('bonusStats') ?? 0);
}

export function abilityScores(data: any): AbilityScores {
  const modifiers = activeModifiers(data);
  return Object.fromEntries(ABILITIES.map((key, i) => [key, calculateAbilityScore(i + 1, data, modifiers)])) as unknown as AbilityScores;
}

export function totalLevel(data: any): number {
  return (data?.data?.classes || []).reduce((sum: number, c: any) => sum + (c.level || 0), 0) || 1;
}

/**
 * Max and current HP the way the sheet shows them. baseHitPoints is the hit dice without
 * CON; then CON modifier × level, per-level bonuses (Tough, Dwarven Toughness, Draconic
 * Resilience …), flat bonuses and the sheet's "Max HP modifier". An override replaces all of it.
 * Item "hit-points" modifiers are healing amounts (potions), not max HP, so they are ignored.
 */
export function calculateHitPoints(data: any): DnDBeyondHPData {
  const d = data?.data || {};
  const level = totalLevel(data);
  const modifiers = activeModifiers(data);
  const con = calculateAbilityScore(3, data, modifiers);

  let maxHp: number;
  if (d.overrideHitPoints) {
    maxHp = d.overrideHitPoints;
  } else {
    let bonus = d.bonusHitPoints || 0;
    for (const m of modifiers) {
      if (m.type !== 'bonus') continue;
      if (m.subType === 'hit-points-per-level') bonus += valueOf(m) * level;
      else if (m.subType === 'hit-points' && m.componentTypeId !== ITEM_COMPONENT_TYPE) bonus += valueOf(m);
    }
    maxHp = (d.baseHitPoints || 0) + abilityModifier(con) * level + bonus;
  }

  const hpData: DnDBeyondHPData = {
    tempHp: d.temporaryHitPoints || 0,
    deathSaveSuccesses: d.deathSaves?.successCount || 0,
    deathSaveFailures: d.deathSaves?.failCount || 0,
    isStable: d.deathSaves?.isStabilized || false,
  };
  if (maxHp > 0) {
    hpData.maxHp = maxHp;
    hpData.hp = Math.min(maxHp, Math.max(0, maxHp - (d.removedHitPoints || 0)));
  }
  return hpData;
}

/** Everything the app imports from a D&D Beyond character. */
export function parseDnDBeyondCharacter(data: any): DnDBeyondCharacterData {
  const d = data?.data || {};
  const classes: any[] = d.classes || [];
  const { tempHp, ...hp } = calculateHitPoints(data);
  return {
    name: d.name || undefined,
    race: d.race?.fullName || d.race?.baseName || undefined,
    level: classes.reduce((total, cls) => total + (cls.level || 0), 0) || undefined,
    class: classes.map((cls) => cls.definition?.name || cls.name).join(' / ') || undefined,
    avatarUrl: d.decorations?.avatarUrl || d.avatarUrl || undefined,
    gender: d.gender || undefined,
    alignment: d.alignmentId ? ALIGNMENTS[d.alignmentId] || 'Unknown' : undefined,
    background: d.background?.definition?.name || d.background?.name || undefined,
    age: d.age || undefined,
    height: d.height || undefined,
    weight: d.weight || undefined,
    eyes: d.eyes || undefined,
    skin: d.skin || undefined,
    hair: d.hair || undefined,
    ...hp,
    tempHp: tempHp || undefined,
    stats: abilityScores(data),
    sheet: safeSheet(data),
  };
}

/** The sheet, or nothing if some odd D&D Beyond data trips it up: HP and stats still sync then. */
function safeSheet(data: any): CharacterSheet | undefined {
  try {
    return buildSheet(data);
  } catch (error) {
    console.error(`Character sheet for "${data?.data?.name}" could not be built:`, error);
    return undefined;
  }
}

/**
 * Fetch the raw character JSON.
 * Note: D&D Beyond has no official public API; this is the internal endpoint their own site uses.
 * @param url - D&D Beyond character URL (e.g., https://www.dndbeyond.com/characters/123456)
 */
export async function fetchDnDBeyondJson(url: string): Promise<any> {
  const characterIdMatch = url.match(/characters\/(\d+)/);
  if (!characterIdMatch) {
    throw new Error('Invalid D&D Beyond character URL. Expected format: https://www.dndbeyond.com/characters/[id]');
  }
  const jsonUrl = `https://character-service.dndbeyond.com/character/v5/character/${characterIdMatch[1]}`;
  const response = await fetch(jsonUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArandorCompanion/1.0)' },
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      throw new Error('Character not found or not public. Make sure the character sheet is set to public in D&D Beyond.');
    }
    throw new Error(`Failed to fetch character data: ${response.status}`);
  }
  return response.json();
}

export async function fetchDnDBeyondCharacter(url: string): Promise<DnDBeyondCharacterData> {
  return parseDnDBeyondCharacter(await fetchDnDBeyondJson(url));
}

/** Fetch HP data (current, max, temp, death saves) from a D&D Beyond character sheet. */
export async function fetchDnDBeyondHP(url: string): Promise<DnDBeyondHPData> {
  return calculateHitPoints(await fetchDnDBeyondJson(url));
}

// ── Character sheet (saves, skills, AC, speed …) ──────────────────────────

const ABILITY_NAMES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;

const SKILLS: [key: string, name: string, ability: Ability][] = [
  ['acrobatics', 'Acrobatics', 'dex'], ['animal-handling', 'Animal Handling', 'wis'], ['arcana', 'Arcana', 'int'],
  ['athletics', 'Athletics', 'str'], ['deception', 'Deception', 'cha'], ['history', 'History', 'int'],
  ['insight', 'Insight', 'wis'], ['intimidation', 'Intimidation', 'cha'], ['investigation', 'Investigation', 'int'],
  ['medicine', 'Medicine', 'wis'], ['nature', 'Nature', 'int'], ['perception', 'Perception', 'wis'],
  ['performance', 'Performance', 'cha'], ['persuasion', 'Persuasion', 'cha'], ['religion', 'Religion', 'int'],
  ['sleight-of-hand', 'Sleight of Hand', 'dex'], ['stealth', 'Stealth', 'dex'], ['survival', 'Survival', 'wis'],
];

// D&D Beyond's skill ids (characterValues refer to skills by these)
const SKILL_IDS: Record<string, number> = {
  athletics: 2, acrobatics: 3, 'sleight-of-hand': 4, stealth: 5, arcana: 6, history: 7, investigation: 8,
  nature: 9, religion: 10, 'animal-handling': 11, insight: 12, medicine: 13, perception: 14, survival: 15,
  deception: 16, intimidation: 17, performance: 18, persuasion: 19,
};

// Manual adjustments made on the D&D Beyond sheet (characterValues typeId)
const VALUE = { acOverride: 1, acMagicBonus: 2, acMiscBonus: 3, skillOverride: 23, skillMiscBonus: 24, skillMagicBonus: 25, saveOverride: 38 } as const;
const SKILL_ENTITY = '1958004211';
const STAT_ENTITY = '1472902489';

function characterValue(data: any, typeId: number, valueTypeId?: string, valueId?: number | string): number | null {
  const v = (data?.data?.characterValues || []).find((c: any) => c.typeId === typeId
    && (valueTypeId === undefined || c.valueTypeId === valueTypeId)
    && (valueId === undefined || String(c.valueId) === String(valueId)));
  return typeof v?.value === 'number' ? v.value : null;
}

const PROFICIENCY_RANK: Record<Proficiency, number> = { none: 0, half: 1, proficient: 2, expertise: 3 };

/**
 * Proficiency-relevant modifiers. Saving throw proficiencies only come from the starting class:
 * D&D Beyond lists a multiclass's core traits in full, the sheet ignores their saves.
 */
function sheetModifiers(data: any): any[] {
  const notStartingClassFeatures = new Set<number>();
  for (const c of data?.data?.classes || []) {
    if (c.isStartingClass) continue;
    for (const f of c.classFeatures || []) notStartingClassFeatures.add(f.definition?.id);
  }
  return activeModifiers(data).filter((m) =>
    !(m.type === 'proficiency' && m.subType?.endsWith('-saving-throws') && notStartingClassFeatures.has(m.componentId)));
}

function proficiencyFor(modifiers: any[], subType: string): Proficiency {
  let best: Proficiency = 'none';
  for (const m of modifiers) {
    if (m.subType !== subType) continue;
    const p: Proficiency | null = m.type === 'expertise' ? 'expertise' : m.type === 'proficiency' ? 'proficient'
      : m.type?.startsWith('half-proficiency') ? 'half' : null;
    if (p && PROFICIENCY_RANK[p] > PROFICIENCY_RANK[best]) best = p;
  }
  return best;
}

const proficiencyValue = (p: Proficiency, bonus: number) =>
  p === 'expertise' ? bonus * 2 : p === 'proficient' ? bonus : p === 'half' ? Math.floor(bonus / 2) : 0;

/** Sum of "bonus" modifiers of a sub type; a statId means "add that ability's modifier" (Aura of Protection). */
function bonusFor(modifiers: any[], subType: string, mods: Record<Ability, number>): number {
  let sum = 0;
  for (const m of modifiers) {
    if (m.type !== 'bonus' || m.subType !== subType) continue;
    sum += m.statId ? mods[ABILITY_KEYS[m.statId - 1]] : valueOf(m);
  }
  return sum;
}

// armorTypeId of D&D Beyond armor
const ARMOR = { light: 1, medium: 2, heavy: 3, shield: 4 } as const;

function equippedArmor(data: any) {
  const equipped = (data?.data?.inventory || []).filter((i: any) => i.equipped && i.definition?.armorTypeId);
  return {
    armor: equipped.find((i: any) => i.definition.armorTypeId !== ARMOR.shield)?.definition as any,
    shield: equipped.find((i: any) => i.definition.armorTypeId === ARMOR.shield)?.definition as any,
  };
}

/**
 * Worn armor (light + DEX, medium + DEX up to 2, heavy flat) or unarmored 10 + DEX (+ the best
 * Unarmored Defense ability), + shield, + armor-class bonuses (magic armor, rings, Defense style
 * while armored), + the sheet's magic/misc AC bonus. The sheet's AC override wins.
 */
function armorClass(data: any, modifiers: any[], mods: Record<Ability, number>): number {
  const override = characterValue(data, VALUE.acOverride);
  if (override) return override;
  const { armor, shield } = equippedArmor(data);
  let ac: number;
  if (armor) {
    const dex = armor.armorTypeId === ARMOR.light ? mods.dex : armor.armorTypeId === ARMOR.medium ? Math.min(mods.dex, 2) : 0;
    ac = (armor.armorClass || 10) + dex + bonusFor(modifiers, 'armored-armor-class', mods);
  } else {
    const unarmored = modifiers.filter((m) => m.type === 'set' && m.subType === 'unarmored-armor-class')
      .map((m) => (m.statId ? mods[ABILITY_KEYS[m.statId - 1]] : 0) + (m.value || 0));
    ac = 10 + mods.dex + Math.max(0, ...unarmored);
  }
  if (shield) ac += shield.armorClass || 2;
  return ac + bonusFor(modifiers, 'armor-class', mods)
    + (characterValue(data, VALUE.acMagicBonus) ?? 0) + (characterValue(data, VALUE.acMiscBonus) ?? 0);
}

/** Walking speed: species speed (or a "set" innate speed) + speed bonuses; Unarmored Movement only without armor or shield. */
function walkingSpeed(data: any, modifiers: any[]): number {
  const { armor, shield } = equippedArmor(data);
  let speed = data?.data?.race?.weightSpeeds?.normal?.walk || 30;
  for (const m of modifiers) {
    if (m.type === 'set' && m.subType === 'innate-speed-walking') speed = Math.max(speed, m.value || 0);
  }
  for (const m of modifiers) {
    if (m.type !== 'bonus') continue;
    if (m.subType === 'unarmored-movement' && !armor && !shield) speed += m.value || 0;
    if (m.subType === 'speed' || m.subType === 'speed-walking') {
      if (/heavy armor/i.test(m.restriction || '') && armor?.armorTypeId === ARMOR.heavy) continue;
      speed += m.value || 0;
    }
  }
  return speed;
}

export function buildSheet(data: any): CharacterSheet {
  const scores = abilityScores(data);
  const mods = Object.fromEntries(ABILITY_KEYS.map((a, i) => [a, abilityModifier(scores[ABILITY_NAMES[i]])])) as Record<Ability, number>;
  const prof = 2 + Math.floor((totalLevel(data) - 1) / 4);
  const modifiers = sheetModifiers(data);
  // Jack of All Trades and similar: half proficiency on every ability check
  const allChecks = proficiencyFor(modifiers, 'ability-checks');
  const checkBonus = bonusFor(modifiers, 'ability-checks', mods);

  const saves = Object.fromEntries(ABILITY_KEYS.map((a, i) => {
    const p = proficiencyFor(modifiers, `${ABILITY_NAMES[i]}-saving-throws`);
    const bonus = characterValue(data, VALUE.saveOverride, STAT_ENTITY, i + 1)
      ?? mods[a] + proficiencyValue(p, prof) + bonusFor(modifiers, 'saving-throws', mods) + bonusFor(modifiers, `${ABILITY_NAMES[i]}-saving-throws`, mods);
    return [a, { bonus, proficient: p !== 'none' }];
  })) as CharacterSheet['saves'];

  const skills: SheetSkill[] = SKILLS.map(([key, name, ability]) => {
    let p = proficiencyFor(modifiers, key);
    if (PROFICIENCY_RANK[allChecks] > PROFICIENCY_RANK[p]) p = allChecks;
    const id = SKILL_IDS[key];
    const bonus = characterValue(data, VALUE.skillOverride, SKILL_ENTITY, id)
      ?? mods[ability] + proficiencyValue(p, prof) + checkBonus + bonusFor(modifiers, key, mods)
        + (characterValue(data, VALUE.skillMiscBonus, SKILL_ENTITY, id) ?? 0) + (characterValue(data, VALUE.skillMagicBonus, SKILL_ENTITY, id) ?? 0);
    return { key, name, ability, proficiency: p, bonus };
  });
  const passive = (key: string) => 10 + skills.find((s) => s.key === key)!.bonus + bonusFor(modifiers, `passive-${key}`, mods);

  const initiativeProf = proficiencyFor(modifiers, 'initiative');
  return {
    version: 3,
    proficiencyBonus: prof,
    ac: armorClass(data, modifiers, mods),
    initiative: mods.dex + Math.max(proficiencyValue(initiativeProf, prof), proficiencyValue(allChecks, prof)) + checkBonus + bonusFor(modifiers, 'initiative', mods),
    speed: walkingSpeed(data, modifiers),
    passivePerception: passive('perception'),
    saves,
    passiveInvestigation: passive('investigation'),
    passiveInsight: passive('insight'),
    skills,
  };
}
