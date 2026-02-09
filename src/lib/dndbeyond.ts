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
    
    // COMPREHENSIVE RAW DATA LOGGING for investigation
    console.log('=== D&D BEYOND RAW API DATA for character', characterId, '===');
    console.log('baseHitPoints:', JSON.stringify(data.data?.baseHitPoints));
    console.log('bonusHitPoints:', JSON.stringify(data.data?.bonusHitPoints));
    console.log('overrideHitPoints:', JSON.stringify(data.data?.overrideHitPoints));
    console.log('removedHitPoints:', JSON.stringify(data.data?.removedHitPoints));
    console.log('temporaryHitPoints:', JSON.stringify(data.data?.temporaryHitPoints));
    
    console.log('\nRAW stats:', JSON.stringify(data.data?.stats, null, 2));
    console.log('\nRAW bonusStats:', JSON.stringify(data.data?.bonusStats, null, 2));
    console.log('\nRAW overrideStats:', JSON.stringify(data.data?.overrideStats, null, 2));
    
    console.log('\nRAW classes:', JSON.stringify(data.data?.classes, null, 2));
    console.log('\nRAW feats:', JSON.stringify(data.data?.feats, null, 2));
    console.log('\nRAW modifiers:', JSON.stringify(data.data?.modifiers, null, 2));
    
    console.log('\nRAW race:', JSON.stringify(data.data?.race, null, 2));
    console.log('\nRAW characterValues:', JSON.stringify(data.data?.characterValues, null, 2));
    
    console.log('\nRAW inventory (first 10):', JSON.stringify(data.data?.inventory?.slice(0, 10), null, 2));
    console.log('\nRAW customDefenseAdjustments:', JSON.stringify(data.data?.customDefenseAdjustments, null, 2));
    
    console.log('=== END RAW DATA ===\n');
    
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
    
    // DEBUG: Log inventory and customDefenseAdjustments for missing HP investigation
    const inventory = data.data?.inventory || [];
    const customAdj = data.data?.customDefenseAdjustments || [];
    
    console.log('[HP DEBUG] Character ID:', characterId);
    console.log('[HP DEBUG] Inventory items (first 10):', JSON.stringify(inventory.slice(0, 10).map((item: any) => ({
      name: item.definition?.name,
      equipped: item.equipped,
      notes: item.notes,
      type: item.definition?.type,
    })), null, 2));
    
    console.log('[HP DEBUG] customDefenseAdjustments:', JSON.stringify(customAdj, null, 2));
    console.log('[HP DEBUG] bonusHitPoints raw:', data.data?.bonusHitPoints, 'type:', typeof data.data?.bonusHitPoints);
    
    // Check equipped items for HP bonuses (especially custom items)
    const equippedItems = inventory.filter((item: any) => item.equipped);
    console.log('[HP DEBUG] Equipped items with modifiers:', JSON.stringify(equippedItems.map((item: any) => ({
      name: item.definition?.name,
      grantedModifiers: item.definition?.grantedModifiers,
      hasModifiers: Array.isArray(item.definition?.grantedModifiers) && item.definition.grantedModifiers.length > 0
    })), null, 2));
    
    // Check racial traits for HP bonuses
    const race = data.data?.race;
    const racialTraits = race?.racialTraits || [];
    console.log('[HP DEBUG] Racial traits count:', racialTraits.length);
    if (racialTraits.length > 0) {
      console.log('[HP DEBUG] Racial traits (first 5):', JSON.stringify(racialTraits.slice(0, 5).map((trait: any) => ({
        name: trait.definition?.name,
        description: trait.definition?.description?.substring(0, 100),
        modifiers: trait.definition?.modifiers
      })), null, 2));
    }
    
    // Check class features for HP bonuses
    console.log('[HP DEBUG] Classes count:', classes.length);
    classes.forEach((cls: any, index: number) => {
      console.log(`[HP DEBUG] Class ${index}: ${cls.definition?.name} level ${cls.level}`);
      const classFeatures = cls.classFeatures || [];
      console.log(`[HP DEBUG] Class features count:`, classFeatures.length);
      if (classFeatures.length > 0) {
        console.log(`[HP DEBUG] Class features (first 3):`, JSON.stringify(classFeatures.slice(0, 3).map((feature: any) => ({
          name: feature.definition?.name,
          description: feature.definition?.description?.substring(0, 100),
         modifiers: feature.definition?.modifiers
        })), null, 2));
      }
    });
    
    // Check choices and options for HP bonuses
    const choices = data.data?.choices || [];
    const options = data.data?.options || [];
    console.log('[HP DEBUG] Choices count:', choices.length);
    console.log('[HP DEBUG] Options count:', options.length);
    
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
    
    console.log('[HP DEBUG] Final calc:', {
      baseHp,
      conMod: conModifier,
      level: totalLevel,
      conContrib: conModifier * totalLevel,
      bonusHp,
      modifierHpBonus,
      featHpBonus,
      maxHp,
      currentHp,
      formula: `${baseHp} + (${conModifier}×${totalLevel}) + ${bonusHp} + ${modifierHpBonus} + ${featHpBonus} = ${maxHp}`
    });
    
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
