/**
 * Shared utilities for D&D Beyond API integration.
 *
 * D&D Beyond's character JSON holds the raw choices, not the numbers the sheet shows, so the
 * sheet's maths is redone here. The one place that does it: the import, the full sync and the
 * HP syncs all go through these functions. Checked against real sheets in e2e/dndbeyond.spec.ts.
 */

import { ABILITY_KEYS, type Ability, type CharacterSheet, type Proficiency, type SheetAttack, type SheetFeature, type SheetItem, type SheetSkill, type SheetSpellcasting } from './character-sheet';

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
    sheet: buildSheet(data),
  };
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

/** Spells with an attack roll and damage (cantrips scale with character level). */
function spellAttacks(data: any, modifiers: any[], mods: Record<Ability, number>, prof: number): SheetAttack[] {
  const d = data?.data || {};
  const casters = spellcastingClasses(data);
  const fallback = casters.find((c) => (d.classes || []).find((x: any) => x.id === c.id)?.isStartingClass) ?? casters[0];
  const level = totalLevel(data);
  const options = Object.values(d.options || {}).flat().map((o: any) => o?.definition?.name || '');
  const equippedItems = new Set((d.inventory || []).filter((i: any) => i.equipped).map((i: any) => i.definition?.id));

  const entries: { spell: any; ability: Ability | undefined; className?: string }[] = [];
  for (const cs of d.classSpells || []) {
    const c = casters.find((x) => x.id === cs.characterClassId);
    for (const spell of cs.spells || []) entries.push({ spell, ability: c?.ability, className: c?.name });
  }
  for (const [source, list] of Object.entries(d.spells || {})) {
    for (const spell of (list as any[]) || []) {
      if (source === 'item' && !equippedItems.has(spell.componentId)) continue;
      const c = source === 'class' ? casters.find((x) => x.featureIds.has(spell.componentId)) : undefined;
      const ability = spell.spellCastingAbilityId ? ABILITY_KEYS[spell.spellCastingAbilityId - 1] : (c ?? fallback)?.ability;
      entries.push({ spell, ability, className: (c ?? (spell.spellCastingAbilityId ? undefined : fallback))?.name });
    }
  }

  const attacks: SheetAttack[] = [];
  const seen = new Set<string>();
  for (const { spell, ability, className } of entries) {
    const def = spell.definition;
    const damage = (def?.modifiers || []).find((m: any) => m.type === 'damage' && m.die?.diceString);
    if (!def?.attackType || def.asPartOfWeaponAttack || !damage || !ability) continue;
    const name = (d.characterValues || []).find((c: any) => c.typeId === VALUE.customName && c.valueTypeId === SPELL_ENTITY && String(c.valueId) === String(spell.id))?.value || def.name;
    if (seen.has(name)) continue;
    seen.add(name);
    let dice: string = damage.die.diceString;
    if (def.level === 0) {
      const steps = (damage.atHigherLevels?.higherLevelDefinitions || [])
        .filter((h: any) => h.level <= level && h.dice?.diceString).sort((a: any, b: any) => b.level - a.level);
      if (steps[0]) dice = steps[0].dice.diceString;
    }
    let mod = damage.die.fixedValue || 0;
    if (def.name === 'Eldritch Blast' && options.some((o) => o.startsWith('Agonizing Blast'))) mod += mods[ability];
    if (def.level === 0 && className) mod += bonusFor(modifiers, `${className.toLowerCase()}-cantrip-damage`, mods);
    attacks.push({
      name, kind: 'spell',
      range: def.range?.rangeValue ? `${def.range.rangeValue} ft.` : def.range?.origin || '',
      toHit: prof + mods[ability] + bonusFor(modifiers, 'spell-attacks', mods),
      saveDc: null,
      damage: formatDamage(dice, mod),
      damageType: damage.friendlySubtypeName || damage.subType || null,
      notes: def.level === 0 ? 'Cantrip' : `Level ${def.level}${def.concentration ? ', concentration' : ''}`,
    });
  }
  return attacks;
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

// Builder bookkeeping rather than something a player looks up at the table
const SKIP_FEATURE = /Ability Score (Improvement|Increase)|^Core .+ Traits$|Subclass$|^Proficiencies$|^Hit Points$|^Creature Type$|^Size$|^Speed$|^Languages$/;

function features(data: any): SheetFeature[] {
  const d = data?.data || {};
  const out: SheetFeature[] = [];
  const seen = new Set<string>();
  const add = (rawName: string, source: string, html: string) => {
    const name = String(rawName || '').replace(/^\d+:\s*/, '');
    if (!name || SKIP_FEATURE.test(name) || seen.has(name)) return;
    seen.add(name);
    out.push({ name, source, description: plainText(html) });
  };
  for (const c of d.classes || []) {
    for (const f of c.classFeatures || []) {
      if ((f.definition?.requiredLevel ?? 0) <= c.level) add(f.definition?.name, c.definition?.name || 'Class', f.definition?.description || f.definition?.snippet);
    }
  }
  for (const t of d.race?.racialTraits || []) add(t.definition?.name, d.race?.fullName || 'Species', t.definition?.description || t.definition?.snippet);
  for (const f of d.feats || []) add(f.definition?.name, 'Feat', f.definition?.description || f.definition?.snippet);
  return out;
}

function inventory(data: any): SheetItem[] {
  const d = data?.data || {};
  return (d.inventory || []).map((i: any) => ({
    name: (d.characterValues || []).find((c: any) => c.typeId === VALUE.customName && c.valueTypeId === ITEM_ENTITY && String(c.valueId) === String(i.id))?.value || i.definition?.name || 'Item',
    quantity: i.quantity || 1,
    equipped: !!i.equipped,
    attuned: !!i.isAttuned,
  })).sort((a: SheetItem, b: SheetItem) => Number(b.equipped) - Number(a.equipped) || a.name.localeCompare(b.name));
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
    version: 1,
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
    attacks: [...weaponAttacks(data, modifiers, mods, prof), ...spellAttacks(data, modifiers, mods, prof)],
    features: features(data),
    inventory: inventory(data),
  };
}
