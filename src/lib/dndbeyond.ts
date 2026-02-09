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
    
    // Log ALL HP-related fields for debugging
    console.log('[D&D Beyond API] Character ID:', characterId);
    console.log('[D&D Beyond API] ALL data.data fields:', Object.keys(data.data || {}));
    console.log('[D&D Beyond API] Raw HP data:', {
      baseHitPoints: data.data?.baseHitPoints,
      bonusHitPoints: data.data?.bonusHitPoints,
      overrideHitPoints: data.data?.overrideHitPoints,
      removedHitPoints: data.data?.removedHitPoints,
      temporaryHitPoints: data.data?.temporaryHitPoints,
      deathSaves: data.data?.deathSaves,
      // Check for other potential HP fields
      hitPointMax: data.data?.hitPointMax,
      constitutionScore: data.data?.stats?.find((s: any) => s.id === 3)?.value,
      level: data.data?.classes?.reduce((sum: number, c: any) => sum + (c.level || 0), 0),
    });
    
    // IMPORTANT: Log types to debug null vs undefined vs 0
    console.log('[D&D Beyond API] HP field types:', {
      baseHitPoints: typeof data.data?.baseHitPoints,
      bonusHitPoints: typeof data.data?.bonusHitPoints,
      bonusIsNull: data.data?.bonusHitPoints === null,
      bonusIsUndefined: data.data?.bonusHitPoints === undefined,
      bonusValue: data.data?.bonusHitPoints,
    });
    
    // Check characterValues for pre-calculated max HP
    const characterValues = data.data?.characterValues || [];
    console.log('[D&D Beyond API] characterValues:', {
      isArray: Array.isArray(characterValues),
      length: characterValues.length,
      values: characterValues.map((cv: any) => ({
        typeId: cv.typeId,
        value: cv.value,
        valueId: cv.valueId,
        valueTypeId: cv.valueTypeId,
        notes: cv.notes
      }))
    });
    
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
    const stats = data.data?.stats || [];
    const conStat = stats.find((s: any) => s.id === 3); // Constitution is stat id 3
    const conScore = conStat?.value || 10;
    const conModifier = Math.floor((conScore - 10) / 2);
    
    // Extract character level
    const classes = data.data?.classes || [];
    const totalLevel = classes.reduce((sum: number, c: any) => sum + (c.level || 0), 0) || 1;
    
    // Calculate HP bonuses from modifiers (Tough feat, Hill Dwarf, etc.)
    // bonusHitPoints is often null even when character has HP bonuses
    // The actual bonuses are in the modifiers array
    const modifiersData = data.data?.modifiers;
    const modifiers = Array.isArray(modifiersData) ? modifiersData : [];
    let modifierHpBonus = 0;
    
    // DEBUG: Log modifiers structure to understand what fields exist
    console.log('[D&D Beyond API] Modifiers array:', {
      isArray: Array.isArray(modifiers),
      length: modifiers.length,
      sample: modifiers.slice(0, 5).map((m: any) => ({
        type: m.type,
        subType: m.subType,
        friendlyTypeName: m.friendlyTypeName,
        friendlySubtypeName: m.friendlySubtypeName,
        value: m.value,
        allKeys: Object.keys(m)
      }))
    });
    
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
    
    console.log('[D&D Beyond API] Modifier HP bonuses:', {
      totalModifierBonus: modifierHpBonus,
      modifiersChecked: modifiers.filter((m: any) => 
        m.type === "bonus" && 
        (m.subType === "hit-points-per-level" || m.subType === "hit-points" || m.subType === "hit-points-max")
      ).length
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
      // Max HP = base + (CON modifier × level) + bonusHitPoints + modifier bonuses
      // Current HP = Max HP - damage taken
      maxHp = baseHp + (conModifier * totalLevel) + bonusHp + modifierHpBonus;
      currentHp = Math.max(0, maxHp - removedHp);
    }
    
    // Ensure current HP doesn't exceed max HP
    const validatedCurrentHp = Math.min(currentHp, maxHp);
    
    console.log('[D&D Beyond API] Calculated HP:', {
      maxHp,
      currentHp,
      validatedCurrentHp,
      formula: overrideHp ? 'override - removed' : `(base ${baseHp} + CON ${conModifier} × level ${totalLevel} + bonus ${bonusHp} + modifiers ${modifierHpBonus}) - removed ${removedHp}`
    });
    
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
