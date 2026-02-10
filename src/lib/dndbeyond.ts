/**
 * Shared utilities for D&D Beyond API integration
 */

export interface DnDBeyondHPData {
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  deathSaveSuccesses?: number;
  deathSaveFailures?: number;
  isStable?: boolean;
}

/**
 * Calculate ability score from D&D Beyond data
 * Returns base stat value - users should manually update if they want to include bonuses
 * 
 * @param statId - Stat ID (1=STR, 2=DEX, 3=CON, 4=INT, 5=WIS, 6=CHA)
 * @param data - D&D Beyond character data object
 * @returns Base ability score
 */
export function calculateAbilityScore(statId: number, data: any): number {
  const stats = data.data?.stats || [];
  const overrideStats = data.data?.overrideStats || [];
  
  // Check for manual override first (highest priority)
  const override = overrideStats.find((s: any) => s.id === statId);
  if (override && override.value !== null && override.value !== undefined) {
    return override.value;
  }
  
  // Return base stat value
  const baseStat = stats.find((s: any) => s.id === statId);
  return baseStat?.value || 10;
}

/**
 * Fetch HP data from D&D Beyond character sheet
 * @param url - D&D Beyond character URL (e.g., https://www.dndbeyond.com/characters/123456)
 * @returns HP data object with current HP, max HP, and temp HP
 */
export async function fetchDnDBeyondHP(url: string): Promise<DnDBeyondHPData> {
  try {
    // Extract character ID from URL
    const characterIdMatch = url.match(/characters\/(\d+)/);
    if (!characterIdMatch) {
      throw new Error('Invalid D&D Beyond character URL');
    }

    const characterId = characterIdMatch[1];
    const API_VERSION = 'v5';
    const jsonUrl = `https://character-service.dndbeyond.com/character/${API_VERSION}/character/${characterId}`;
    
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArandorCompanion/1.0)',
      },
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 404) {
        throw new Error('Character not found or not public. Make sure the character sheet is set to public in D&D Beyond.');
      }
      throw new Error(`Failed to fetch character data: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract HP data
    const baseHp = data.data?.baseHitPoints || 0;
    const bonusHp = data.data?.bonusHitPoints || 0;
    const overrideHp = data.data?.overrideHitPoints;
    const removedHp = data.data?.removedHitPoints || 0;
    const tempHp = data.data?.temporaryHitPoints || 0;
    
    // Extract Constitution modifier for HP calculation
    const conScore = calculateAbilityScore(3, data);
    const conModifier = Math.floor((conScore - 10) / 2);
    
    // Extract character level
    const classes = data.data?.classes || [];
    const totalLevel = classes.reduce((sum: number, c: any) => sum + (c.level || 0), 0) || 1;
    
    // Calculate HP bonuses from modifiers
    const modifiersData = data.data?.modifiers;
    const modifiers = Array.isArray(modifiersData) ? modifiersData : [];
    let modifierHpBonus = 0;
    
    modifiers.forEach((modifier: any) => {
      if (modifier.type === "bonus") {
        if (modifier.subType === "hit-points-per-level") {
          modifierHpBonus += (modifier.value || 0) * totalLevel;
        }
        else if (modifier.subType === "hit-points" || modifier.subType === "hit-points-max") {
          modifierHpBonus += modifier.value || 0;
        }
      }
    });
    
    // Parse feats for HP bonuses
    const feats = data.data?.feats || [];
    let featHpBonus = 0;
    
    feats.forEach((feat: any) => {
      const featName = feat.definition?.name || feat.name || '';
      if (featName === 'Tough') {
        featHpBonus += 2 * totalLevel;
      }
    });
    
    // Extract death save data
    const deathSaves = data.data?.deathSaves;
    const deathSaveSuccesses = deathSaves?.successCount || 0;
    const deathSaveFailures = deathSaves?.failCount || 0;
    const isStable = deathSaves?.isStabilized || false;
    
    // Calculate HP
    let currentHp: number;
    let maxHp: number;
    
    if (overrideHp !== null && overrideHp !== undefined && overrideHp > 0) {
      maxHp = overrideHp;
      currentHp = Math.max(0, overrideHp - removedHp);
    } else {
      maxHp = baseHp + (conModifier * totalLevel) + bonusHp + modifierHpBonus + featHpBonus;
      currentHp = Math.max(0, maxHp - removedHp);
    }
    
    const validatedCurrentHp = Math.min(currentHp, maxHp);
    
    const hpData: DnDBeyondHPData = {};
    
    if (maxHp > 0) {
      hpData.maxHp = maxHp;
      hpData.hp = validatedCurrentHp;
    }
    
    hpData.tempHp = tempHp;
    hpData.deathSaveSuccesses = deathSaveSuccesses;
    hpData.deathSaveFailures = deathSaveFailures;
    hpData.isStable = isStable;

    return hpData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch HP data from D&D Beyond');
  }
}
