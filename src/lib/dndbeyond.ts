/**
 * Shared utilities for D&D Beyond API integration.
 *
 * D&D Beyond's character JSON holds the raw choices, not the numbers the sheet shows, so the
 * sheet's maths is redone here. The one place that does it: the import, the full sync and the
 * HP syncs all go through these functions. Checked against real sheets in e2e/dndbeyond.spec.ts.
 */

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
