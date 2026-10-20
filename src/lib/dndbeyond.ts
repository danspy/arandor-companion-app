/**
 * Shared utilities for D&D Beyond API integration.
 *
 * D&D Beyond's character JSON holds the raw choices, not the numbers the sheet shows, so the
 * sheet's maths is redone here. The one place that does it: the import, the full sync and the
 * HP syncs all go through these functions. Checked against real sheets in e2e/dndbeyond.spec.ts.
 */

import { ABILITY_KEYS, type Ability, type CharacterSheet, type Proficiency, type SheetAttack, type SheetSkill, type SheetSpell, type SheetSpellbook, type SheetSpellcasting, type SheetSpellSlots } from './character-sheet';

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

const getJson = async (url: string) => {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArandorCompanion/1.0)' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`D&D Beyond answered ${response.status}`);
  return response.json();
};

/**
 * Spells some subclasses always have prepared (e.g. a Light Domain cleric's domain spells) are not
 * in the character JSON; D&D Beyond's own sheet loads them per subclass. Adds them as
 * `data.alwaysPreparedSpells` (shaped like `classSpells`). A failed request only leaves them out.
 */
export async function addSubclassSpells(json: any, fetchJson: (url: string) => Promise<any> = getJson): Promise<void> {
  const classes = (json?.data?.classes || []).filter((c: any) => c.subclassDefinition?.id);
  const lists = await Promise.all(classes.map(async (c: any) => {
    try {
      const answer = await fetchJson(`https://character-service.dndbeyond.com/character/v5/game-data/always-prepared-spells?classId=${c.subclassDefinition.id}&classLevel=${c.level}&sharingSetting=2`);
      return { characterClassId: c.id, spells: Array.isArray(answer?.data) ? answer.data : [] };
    } catch {
      return { characterClassId: c.id, spells: [] };
    }
  }));
  if (json?.data) json.data.alwaysPreparedSpells = lists;
}

export async function fetchDnDBeyondCharacter(url: string): Promise<DnDBeyondCharacterData> {
  const json = await fetchDnDBeyondJson(url);
  await addSubclassSpells(json);
  return parseDnDBeyondCharacter(json);
}

/** Fetch HP data (current, max, temp, death saves) from a D&D Beyond character sheet. */
export async function fetchDnDBeyondHP(url: string): Promise<DnDBeyondHPData> {
  return calculateHitPoints(await fetchDnDBeyondJson(url));
}

// ── Character sheet (saves, skills, AC, attacks …) ──────────────────────────

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
const VALUE = { acOverride: 1, acMagicBonus: 2, acMiscBonus: 3, customName: 8, skillOverride: 23, skillMiscBonus: 24, skillMagicBonus: 25, weaponProficiency: 33, saveOverride: 38 } as const;
const SKILL_ENTITY = '1958004211';
const STAT_ENTITY = '1472902489';
const ITEM_ENTITY = '1439493548';
const SPELL_ENTITY = '435869154';
const WEAPON_ENTITY = '1782728300';

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

const formatDamage = (dice: string | null, mod: number) =>
  !dice ? String(mod) : mod === 0 ? dice : `${dice}${mod > 0 ? '+' : ''}${mod}`;

const classLevel = (data: any, name: string) =>
  (data?.data?.classes || []).find((c: any) => c.definition?.name === name)?.level || 0;

/** Monk Martial Arts die (2024): d6, d8 from level 5, d10 from 11, d12 from 17. */
const martialArtsDie = (monkLevel: number) =>
  monkLevel >= 17 ? '1d12' : monkLevel >= 11 ? '1d10' : monkLevel >= 5 ? '1d8' : '1d6';

const dieSize = (dice: string) => Number(dice.split('d')[1]) || 0;

const hasFeat = (data: any, name: string) => (data?.data?.feats || []).some((f: any) => f.definition?.name === name);

/** Equipped weapons and the unarmed strike, the way the sheet's Actions tab shows them. */
function weaponAttacks(data: any, modifiers: any[], mods: Record<Ability, number>, prof: number): SheetAttack[] {
  const monkLevel = classLevel(data, 'Monk');
  const dueling = hasFeat(data, 'Dueling');
  const proficientIn = (subType: string) => modifiers.some((m) => m.type === 'proficiency' && m.subType === subType);
  const attacks: SheetAttack[] = [];

  for (const item of data?.data?.inventory || []) {
    // Staffs and the like carry their weapon stats in weaponBehaviors (a Staff of Frost is a quarterstaff)
    const d = item.definition?.weaponBehaviors?.[0] ? { ...item.definition, ...item.definition.weaponBehaviors[0] } : item.definition;
    if (!item.equipped || !d?.damage?.diceString || d.attackType == null) continue;
    const props: string[] = (d.properties || []).map((p: any) => p.name);
    const ranged = d.attackType === 2;
    const monkWeapon = monkLevel > 0 && d.isMonkWeapon;
    const ability = props.includes('Finesse') || monkWeapon ? Math.max(mods.str, mods.dex) : ranged ? mods.dex : mods.str;
    const proficient = proficientIn(d.categoryId === 2 ? 'martial-weapons' : 'simple-weapons')
      || proficientIn(String(d.type || '').toLowerCase().replace(/\s+/g, '-'))
      || (characterValue(data, VALUE.weaponProficiency, WEAPON_ENTITY, d.baseItemId ?? d.id) ?? 0) >= 3;
    const magic = (d.grantedModifiers || []).filter((m: any) => m.type === 'bonus' && m.subType === 'magic')
      .reduce((sum: number, m: any) => sum + valueOf(m), 0);
    let dice: string = d.damage.diceString;
    if (monkWeapon && dieSize(martialArtsDie(monkLevel)) > dieSize(dice)) dice = martialArtsDie(monkLevel);
    const duelingBonus = dueling && !ranged && !props.includes('Two-Handed') ? 2 : 0;
    const thrown = props.includes('Thrown') || ranged;
    attacks.push({
      name: (data.data.characterValues || []).find((c: any) => c.typeId === VALUE.customName && c.valueTypeId === ITEM_ENTITY && String(c.valueId) === String(item.id))?.value || d.name,
      kind: 'weapon',
      range: thrown && d.range ? `${d.range}/${d.longRange || d.range} ft.` : props.includes('Reach') ? '10 ft.' : '5 ft.',
      toHit: ability + (proficient ? prof : 0) + magic + bonusFor(modifiers, ranged ? 'ranged-weapon-attacks' : 'melee-weapon-attacks', mods) + bonusFor(modifiers, 'weapon-attacks', mods),
      saveDc: null,
      damage: formatDamage(dice, ability + magic + duelingBonus),
      damageType: d.damageType || null,
      notes: props.join(', '),
    });
  }

  const unarmedAbility = monkLevel > 0 ? Math.max(mods.str, mods.dex) : mods.str;
  attacks.push({
    name: 'Unarmed Strike', kind: 'unarmed', range: '5 ft.',
    toHit: unarmedAbility + prof, saveDc: null,
    damage: monkLevel > 0 ? formatDamage(martialArtsDie(monkLevel), unarmedAbility) : String(1 + unarmedAbility),
    damageType: 'Bludgeoning', notes: '',
  });
  return attacks;
}

/** Classes that cast spells, with their spellcasting ability (the subclass's for e.g. Eldritch Knight). */
function spellcastingClasses(data: any): { id: number; name: string; ability: Ability; featureIds: Set<number> }[] {
  return (data?.data?.classes || []).flatMap((c: any) => {
    const abilityId = c.definition?.spellCastingAbilityId || c.subclassDefinition?.spellCastingAbilityId;
    if (!abilityId) return [];
    return [{ id: c.id, name: c.definition.name, ability: ABILITY_KEYS[abilityId - 1], featureIds: new Set((c.classFeatures || []).map((f: any) => f.definition?.id)) }];
  });
}

function spellcasting(data: any, modifiers: any[], mods: Record<Ability, number>, prof: number): SheetSpellcasting[] {
  return spellcastingClasses(data).map((c) => ({
    className: c.name,
    ability: c.ability,
    saveDc: 8 + prof + mods[c.ability] + bonusFor(modifiers, 'spell-save-dc', mods) + bonusFor(modifiers, `${c.name.toLowerCase()}-spell-save-dc`, mods),
    attack: prof + mods[c.ability] + bonusFor(modifiers, 'spell-attacks', mods),
  }));
}

interface SpellEntry {
  spell: any;
  ability: Ability | undefined;
  className?: string;
  source: string;
  prepared: boolean;
  granted: boolean; // from a feature, species, feat or item rather than the class spell list
}

/** Name of the feature, feat, species trait or item a spell comes from (an option names its parent feature). */
function spellSource(data: any, componentId: number, fallback: string): string {
  const d = data?.data || {};
  const features = [
    ...(d.classes || []).flatMap((c: any) => (c.classFeatures || []).map((f: any) => f.definition)),
    ...(d.race?.racialTraits || []).map((t: any) => t.definition),
    ...(d.feats || []).map((f: any) => f.definition),
  ];
  const named = (id: number) => features.find((f: any) => f?.id === id)?.name;
  const option = Object.values(d.options || {}).flat().find((o: any) => o?.definition?.id === componentId) as any;
  const item = (d.inventory || []).find((i: any) => i.definition?.id === componentId);
  return named(componentId) || (option && named(option.componentId)) || item?.definition?.name || fallback;
}

/**
 * Every spell the character has, the way the D&D Beyond Spells tab lists them: class spells
 * (a wizard's whole spellbook, unprepared ones marked), subclass spells D&D Beyond adds itself
 * (alwaysPreparedSpells, fetched separately), and spells from features, species, feats and
 * equipped (attuned) items.
 */
function spellEntries(data: any): SpellEntry[] {
  const d = data?.data || {};
  const casters = spellcastingClasses(data);
  const fallback = casters.find((c) => (d.classes || []).find((x: any) => x.id === c.id)?.isStartingClass) ?? casters[0];
  const usableItems = new Set((d.inventory || [])
    .filter((i: any) => i.equipped && (!i.definition?.canAttune || i.isAttuned)).map((i: any) => i.definition?.id));
  const entries: SpellEntry[] = [];

  for (const list of [d.classSpells, d.alwaysPreparedSpells]) {
    for (const cs of list || []) {
      const c = casters.find((x) => x.id === cs.characterClassId);
      const preparesSpells = (d.classes || []).find((x: any) => x.id === cs.characterClassId)?.definition?.spellPrepareType === 1;
      for (const spell of cs.spells || []) {
        if (!spell?.definition) continue;
        // A wizard casts the rituals in their spellbook without preparing them
        const ritualFromBook = !!spell.definition.ritual && c?.name === 'Wizard';
        const prepared = list === d.alwaysPreparedSpells || !preparesSpells || spell.definition.level === 0 || !!spell.prepared || !!spell.alwaysPrepared || ritualFromBook;
        entries.push({ spell, ability: c?.ability, className: c?.name, source: c?.name || 'Class', prepared, granted: false });
      }
    }
  }
  for (const [kind, list] of Object.entries(d.spells || {})) {
    for (const spell of (list as any[]) || []) {
      if (!spell?.definition || (kind === 'item' && !usableItems.has(spell.componentId))) continue;
      const c = kind === 'class' ? casters.find((x) => x.featureIds.has(spell.componentId)) : undefined;
      const ability = spell.spellCastingAbilityId ? ABILITY_KEYS[spell.spellCastingAbilityId - 1] : (c ?? fallback)?.ability;
      const className = (c ?? (spell.spellCastingAbilityId ? undefined : fallback))?.name;
      entries.push({ spell, ability, className, source: spellSource(data, spell.componentId, kind[0].toUpperCase() + kind.slice(1)), prepared: true, granted: true });
    }
  }
  return entries;
}

const spellName = (data: any, spell: any): string =>
  (data?.data?.characterValues || []).find((c: any) => c.typeId === VALUE.customName && c.valueTypeId === SPELL_ENTITY && String(c.valueId) === String(spell.id))?.value || spell.definition.name;

const diceOf = (die: any): string | null => (die?.diceCount && die?.diceValue ? `${die.diceCount}d${die.diceValue}` : null);

/** Damage (or healing) dice of a spell at its own level; cantrips scale with character level. */
function spellDice(data: any, entry: SpellEntry, modifiers: any[], mods: Record<Ability, number>): { damage: string | null; damageType: string | null; healing: string | null } {
  const def = entry.spell.definition;
  const out = { damage: null as string | null, damageType: null as string | null, healing: null as string | null };
  const damage = (def.modifiers || []).find((m: any) => m.type === 'damage' && (m.die?.diceValue || m.die?.fixedValue));
  if (damage) {
    let dice = diceOf(damage.die);
    if (def.level === 0) {
      const steps = (damage.atHigherLevels?.higherLevelDefinitions || [])
        .filter((h: any) => h.level <= totalLevel(data) && diceOf(h.dice)).sort((a: any, b: any) => b.level - a.level);
      if (steps[0]) dice = diceOf(steps[0].dice);
    }
    let mod = (damage.die.fixedValue || 0) + (damage.usePrimaryStat && entry.ability ? mods[entry.ability] : 0);
    const options = Object.values(data?.data?.options || {}).flat().map((o: any) => o?.definition?.name || '');
    if (def.name === 'Eldritch Blast' && entry.ability && options.some((o) => o.startsWith('Agonizing Blast'))) mod += mods[entry.ability];
    if (def.level === 0 && entry.className) mod += bonusFor(modifiers, `${entry.className.toLowerCase()}-cantrip-damage`, mods);
    // True Strike's extra damage starts at 0d6 and only gains dice at higher character levels
    if (dice || mod) out.damage = formatDamage(dice, mod);
    out.damageType = out.damage ? damage.friendlySubtypeName || damage.subType || null : null;
  }
  // Dice only: Revivify's "returns with 1 hit point" is not healing to roll
  const heal = (def.modifiers || []).find((m: any) => m.type === 'bonus' && m.subType === 'hit-points' && diceOf(m.die));
  if (heal) out.healing = formatDamage(diceOf(heal.die), (heal.die.fixedValue || 0) + (heal.usePrimaryStat && entry.ability ? mods[entry.ability] : 0));
  return out;
}

const spellAttackBonus = (entry: SpellEntry, modifiers: any[], mods: Record<Ability, number>, prof: number) =>
  prof + mods[entry.ability!] + bonusFor(modifiers, 'spell-attacks', mods);

const spellSaveDc = (entry: SpellEntry, modifiers: any[], mods: Record<Ability, number>, prof: number) =>
  entry.spell.overrideSaveDc ?? 8 + prof + mods[entry.ability!] + bonusFor(modifiers, 'spell-save-dc', mods)
    + (entry.className ? bonusFor(modifiers, `${entry.className.toLowerCase()}-spell-save-dc`, mods) : 0);

const fromItem = (entry: SpellEntry) => entry.granted && entry.spell.componentTypeId === ITEM_COMPONENT_TYPE && !entry.spell.spellCastingAbilityId;

/** Prepared spells with an attack roll and damage, for the attacks list. */
function spellAttacks(data: any, entries: SpellEntry[], modifiers: any[], mods: Record<Ability, number>, prof: number): SheetAttack[] {
  const attacks: SheetAttack[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const def = entry.spell.definition;
    if (!entry.prepared || !def.attackType || def.asPartOfWeaponAttack || !entry.ability) continue;
    const { damage, damageType } = spellDice(data, entry, modifiers, mods);
    const name = spellName(data, entry.spell);
    if (!damage || !/d/.test(damage) || seen.has(name)) continue;
    seen.add(name);
    attacks.push({
      name, kind: 'spell',
      range: def.range?.rangeValue ? `${def.range.rangeValue} ft.` : def.range?.origin || '',
      toHit: spellAttackBonus(entry, modifiers, mods, prof),
      saveDc: null,
      damage,
      damageType,
      notes: def.level === 0 ? 'Cantrip' : `Level ${def.level}${def.concentration ? ', concentration' : ''}`,
    });
  }
  return attacks;
}

// ── Spellbook ────────────────────────────────────────────────────────────────

// Multiclass spellcaster table (PHB): slots per spell level for caster levels 1–20
const CASTER_SLOTS = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Spell slots (one class: its own table; several: the multiclass table) and Warlock pact slots. */
function spellSlots(data: any): { slots: SheetSpellSlots[]; pact: SheetSpellSlots | null } {
  const d = data?.data || {};
  const used = (list: any[], level: number) => (list || []).find((s: any) => s.level === level)?.used || 0;
  let pact: SheetSpellSlots | null = null;
  const casters: { level: number; rules: any }[] = [];
  for (const c of d.classes || []) {
    const rules = c.definition?.canCastSpells ? c.definition.spellRules : c.subclassDefinition?.canCastSpells ? c.subclassDefinition.spellRules : null;
    if (!rules?.levelSpellSlots) continue;
    const table: number[] = rules.levelSpellSlots[c.level] || [];
    if (c.definition.name === 'Warlock') {
      const i = table.findIndex((n) => n > 0);
      if (i >= 0) pact = { level: i + 1, total: table[i], used: used(d.pactMagic, i + 1) };
    } else casters.push({ level: c.level, rules });
  }
  let table: number[] = [];
  if (casters.length === 1) table = casters[0].rules.levelSpellSlots[casters[0].level] || [];
  else if (casters.length > 1) {
    const casterLevel = casters.reduce((sum, c) => {
      const div = c.rules.multiClassSpellSlotDivisor || 1;
      return sum + (c.rules.multiClassSpellSlotRounding === 2 ? Math.ceil(c.level / div) : Math.floor(c.level / div));
    }, 0);
    table = CASTER_SLOTS[Math.min(casterLevel, 20)];
  }
  const slots = table.map((total, i) => ({ level: i + 1, total, used: used(d.spellSlots, i + 1) })).filter((s) => s.total > 0);
  return { slots, pact };
}

const ACTIVATION: Record<number, string> = { 1: 'action', 2: 'no action', 3: 'bonus action', 4: 'reaction', 6: 'minute', 7: 'hour' };
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

function castingTime(def: any): string {
  const { activationTime: n = 1, activationType: type } = def.activation || {};
  if (type === 6 || type === 7) return plural(n, ACTIVATION[type]);
  return ACTIVATION[type] ? `${n} ${ACTIVATION[type]}` : def.castingTimeDescription || 'Special';
}

function spellRange(def: any): string {
  const r = def.range || {};
  const area = r.aoeType && r.aoeValue ? `${r.aoeValue} ft. ${String(r.aoeType).toLowerCase()}` : '';
  const base = r.origin === 'Ranged' ? `${r.rangeValue} ft.` : r.origin || '';
  return area ? `${base} (${area})` : base;
}

function spellDuration(def: any): string {
  const dur = def.duration || {};
  if (dur.durationType === 'Time' || dur.durationType === 'Concentration') return dur.durationUnit ? plural(dur.durationInterval || 1, dur.durationUnit.toLowerCase()) : 'Special';
  return dur.durationType || '';
}

function spellComponents(def: any): string {
  const parts = (def.components || []).map((c: number) => ({ 1: 'V', 2: 'S', 3: 'M' } as Record<number, string>)[c]).filter(Boolean);
  return parts.map((p: string) => (p === 'M' && def.componentsDescription ? `M (${def.componentsDescription})` : p)).join(', ');
}

const RESET: Record<number, string> = { 1: 'SR', 2: 'LR', 3: 'Dawn' };

/** How the spell is cast when it isn't a normal cast with a slot: limited uses, item charges, at will. */
function spellUses(entry: SpellEntry): string {
  const { spell } = entry;
  const lu = spell.limitedUse;
  if (spell.componentTypeId === ITEM_COMPONENT_TYPE && lu?.minNumberConsumed) return lu.minNumberConsumed === 1 ? '1 charge' : `${lu.minNumberConsumed} charges`;
  if (lu?.maxUses) return `${lu.maxUses}/${RESET[lu.resetType] || 'rest'}`;
  if (entry.granted && spell.definition.level > 0 && !spell.usesSpellSlot && !lu) return 'At will';
  return '';
}

/** D&D Beyond description HTML → plain text paragraphs. */
const paragraphs = (html: string) =>
  String(html || '').split(/<\/p>|<br\s*\/?>|<\/li>|<\/h\d>/i).map((p) => plainText(p, Infinity)).filter(Boolean).join('\n\n');

function spellbook(data: any, entries: SpellEntry[], modifiers: any[], mods: Record<Ability, number>, prof: number): SheetSpellbook | null {
  const { slots, pact } = spellSlots(data);
  const casting = spellcasting(data, modifiers, mods, prof);
  const byName = new Map<string, SheetSpell>();
  for (const entry of entries) {
    const { spell } = entry;
    const def = spell.definition;
    const name = spellName(data, spell);
    const uses = spellUses(entry);
    const known = byName.get(name);
    if (known) {
      // The same spell from another source, or its free use next to the cast with a slot
      if (!known.source.split(' · ').includes(entry.source)) known.source += ` · ${entry.source}`;
      if (uses && !known.uses) known.uses = uses;
      known.prepared ||= entry.prepared;
      known.alwaysPrepared ||= !!spell.alwaysPrepared;
      continue;
    }
    // True Strike and the like ride on a weapon attack: no spell attack roll of their own
    const attack = !!(def.attackType || def.requiresAttackRoll) && !def.asPartOfWeaponAttack && !!entry.ability;
    const save = !!def.saveDcAbilityId && (!!entry.ability || spell.overrideSaveDc != null);
    // An item's spell uses the character's best spell save DC and attack
    const best = fromItem(entry) && casting.length > 0;
    byName.set(name, {
      name,
      ...(name !== def.name ? { baseName: def.name } : {}),
      level: def.level,
      school: def.school || '',
      source: entry.source,
      prepared: entry.prepared,
      alwaysPrepared: !!spell.alwaysPrepared,
      castingTime: castingTime(def),
      range: spellRange(def),
      components: spellComponents(def),
      duration: spellDuration(def),
      concentration: !!def.concentration,
      ritual: !!def.ritual,
      toHit: attack ? (best ? Math.max(...casting.map((c) => c.attack)) : spellAttackBonus(entry, modifiers, mods, prof)) : null,
      saveDc: !attack && save ? (best && spell.overrideSaveDc == null ? Math.max(...casting.map((c) => c.saveDc)) : spellSaveDc(entry, modifiers, mods, prof)) : null,
      saveAbility: !attack && save ? ABILITY_KEYS[def.saveDcAbilityId - 1] : null,
      ...spellDice(data, entry, modifiers, mods),
      uses,
      description: paragraphs(def.description),
    });
  }
  if (byName.size === 0 && slots.length === 0 && !pact) return null;
  const spells = [...byName.values()].sort((a, b) => a.level - b.level || Number(b.prepared) - Number(a.prepared) || a.name.localeCompare(b.name));
  return { slots, pact, spells };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/** D&D Beyond description HTML → one line of plain text, at most `max` characters. */
export function plainText(html: string, max = 300): string {
  const text = String(html || '')
    .replace(/<[^>]*(>|$)/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, '…')
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? m)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2)).trimEnd()}…`;
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
  const spells = spellEntries(data);
  return {
    version: 2,
    proficiencyBonus: prof,
    ac: armorClass(data, modifiers, mods),
    initiative: mods.dex + Math.max(proficiencyValue(initiativeProf, prof), proficiencyValue(allChecks, prof)) + checkBonus + bonusFor(modifiers, 'initiative', mods),
    speed: walkingSpeed(data, modifiers),
    passivePerception: passive('perception'),
    saves,
    passiveInvestigation: passive('investigation'),
    passiveInsight: passive('insight'),
    skills,
    spellcasting: spellcasting(data, modifiers, mods, prof),
    attacks: [...weaponAttacks(data, modifiers, mods, prof), ...spellAttacks(data, spells, modifiers, mods, prof)],
    spellbook: spellbook(data, spells, modifiers, mods, prof),
  };
}
