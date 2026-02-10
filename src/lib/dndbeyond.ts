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
 * Calculate final ability score including bonuses and overrides
 * D&D Beyond API structure:
 * - stats[].value: base ability score
 * - bonusStats[].value: bonuses from race, ASIs, items, etc.
 * - overrideStats[].value: complete override (if present, ignores base + bonus)
 * - modifiers[]: additional bonuses from feats, class features, etc.
 */
function calculateAbilityScore(statId: number, data: any): number {
  const stats = data.data?.stats || [];
  const bonusStats = data.data?.bonusStats || [];
  const overrideStats = data.data?.overrideStats || [];
  const modifiersData = data.data?.modifiers;
  const modifiers = Array.isArray(modifiersData) ? modifiersData : [];
  
  // Check for override first (complete replacement)
  const override = overrideStats.find((s: any) => s.id === statId);
  if (override && override.value !== null && override.value !== undefined) {
    return override.value;
  }
  
  // Otherwise, calculate base + bonuses
  const baseStat = stats.find((s: any) => s.id === statId);
  const baseValue = baseStat?.value || 10;
  
  const bonusStat = bonusStats.find((s: any) => s.id === statId);
  const bonusValue = bonusStat?.value || 0;
  
  // Check modifiers for additional stat bonuses from feats, class features, etc.
  // Stat subtypes: "strength-score", "dexterity-score", "constitution-score", 
  //                "intelligence-score", "wisdom-score", "charisma-score"
  const statNames = ['', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const statName = statNames[statId];
  let modifierBonus = 0;
  
  if (statName) {
    modifiers.forEach((modifier: any) => {
      if (modifier.type === 'bonus' && modifier.subType === `${statName}-score`) {
        modifierBonus += modifier.value || 0;
      }
    });
  }
  
  return baseValue + bonusValue + modifierBonus;
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
    // D&D Beyond stores HP in the following fields:
    // - baseHitPoints: Hit die rolls WITHOUT Constitution modifier
    // - bonusHitPoints: bonus HP from items/features (added to max)
    // - overrideHitPoints: manual override for max HP (if set, uses different calculation)
    // - removedHitPoints: damage taken (HP lost from max)
    // - temporaryHitPoints: temp HP
    // NOTE: Constitution modifier must be added separately!
    const baseHp = data.data?.baseHitPoints || 0;
    const bonusHp = data.data?.bonusHitPoints || 0;
    const overrideHp = data.data?.overrideHitPoints;
    const removedHp = data.data?.removedHitPoints || 0;
    const tempHp = data.data?.temporaryHitPoints || 0;
    
    // Extract Constitution modifier for HP calculation
    // Use the calculated ability score (base + bonuses + overrides + feat modifiers)
    const conScore = calculateAbilityScore(3, data); // Constitution is stat id 3
    const conModifier = Math.floor((conScore - 10) / 2);
    
    // Extract character level
    const classes = data.data?.classes || [];
    const totalLevel = classes.reduce((sum: number, c: any) => sum + (c.level || 0), 0) || 1;
    
    // Calculate HP bonuses from modifiers (Tough feat, Hill Dwarf, etc.)
    // Note: bonusHitPoints is often null even when character has HP bonuses
    // The actual bonuses might be in the modifiers array
    const modifiersData = data.data?.modifiers;
    const modifiers = Array.isArray(modifiersData) ? modifiersData : [];
    let modifierHpBonus = 0;
    
    modifiers.forEach((modifier: any) => {
      if (modifier.type === "bonus") {
        // Hit points per level (Tough feat, Hill Dwarf, Draconic Sorcerer, etc.)
        if (modifier.subType === "hit-points-per-level") {
          modifierHpBonus += (modifier.value || 0) * totalLevel;
        }
        // One-time HP bonuses (magic items, temporary effects)
        else if (modifier.subType === "hit-points" || modifier.subType === "hit-points-max") {
          modifierHpBonus += modifier.value || 0;
        }
      }
    });
    
    // Parse feats for HP bonuses (Tough feat, etc.)
    // Note: Modifiers array is often empty, so we also check feats directly
    const feats = data.data?.feats || [];
    let featHpBonus = 0;
    
    feats.forEach((feat: any) => {
      const featName = feat.definition?.name || feat.name || '';
      // Tough feat: +2 HP per character level
      if (featName === 'Tough') {
        featHpBonus += 2 * totalLevel;
      }
    });
    
    // Extract death save data (available when character is at 0 HP)
    const deathSaves = data.data?.deathSaves;
    const deathSaveSuccesses = deathSaves?.successCount || 0;
    const deathSaveFailures = deathSaves?.failCount || 0;
    const isStable = deathSaves?.isStabilized || false;
    
    // Calculate HP based on whether override is set
    let currentHp: number;
    let maxHp: number;
    
    if (overrideHp !== null && overrideHp !== undefined && overrideHp > 0) {
      // When overrideHitPoints is set, use it as max HP
      // and calculate current HP by subtracting damage from it
      // Note: overrideHitPoints already includes all bonuses, so bonusHitPoints is ignored
      maxHp = overrideHp;
      currentHp = Math.max(0, overrideHp - removedHp);
    } else {
      // Normal case: no override
      // baseHitPoints is hit die rolls WITHOUT Constitution modifier or feat/racial bonuses
      // Max HP = base + (CON modifier × level) + bonusHitPoints + modifier bonuses + feat bonuses
      // Current HP = Max HP - damage taken
      maxHp = baseHp + (conModifier * totalLevel) + bonusHp + modifierHpBonus + featHpBonus;
      currentHp = Math.max(0, maxHp - removedHp);
    }
    
    // Ensure current HP doesn't exceed max HP
    const validatedCurrentHp = Math.min(currentHp, maxHp);
    
    const hpData: DnDBeyondHPData = {};
    
    if (maxHp > 0) {
      hpData.maxHp = maxHp;
      hpData.hp = validatedCurrentHp;
    }
    
    // Set temp HP only if greater than 0, otherwise explicitly set to 0 to clear it
    hpData.tempHp = tempHp;
    
    // Include death save data
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
