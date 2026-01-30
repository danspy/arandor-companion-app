/**
 * Shared utilities for D&D Beyond API integration
 */

export interface DnDBeyondHPData {
  hp?: number;
  maxHp?: number;
  tempHp?: number;
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
    // - baseHitPoints: CURRENT HP (not base max HP!)
    // - bonusHitPoints: bonus HP from items/features (added to max)
    // - overrideHitPoints: manual override for max HP (if set, uses different calculation)
    // - removedHitPoints: damage taken (HP lost from max)
    // - temporaryHitPoints: temp HP
    const baseHp = data.data?.baseHitPoints || 0;
    const bonusHp = data.data?.bonusHitPoints || 0;
    const overrideHp = data.data?.overrideHitPoints;
    const removedHp = data.data?.removedHitPoints || 0;
    const tempHp = data.data?.temporaryHitPoints || 0;
    
    // Calculate HP based on whether override is set
    let currentHp: number;
    let maxHp: number;
    
    if (overrideHp !== null && overrideHp !== undefined && overrideHp > 0) {
      // When overrideHitPoints is set, use it as max HP
      // and calculate current HP by subtracting damage from it
      maxHp = overrideHp;
      currentHp = Math.max(0, overrideHp - removedHp);
    } else {
      // Normal case: no override
      // baseHitPoints represents current HP after damage
      // Calculate max HP by adding back the damage
      if (removedHp >= baseHp) {
        currentHp = 0; // Character took damage >= remaining HP
      } else {
        currentHp = baseHp; // baseHitPoints is current HP
      }
      maxHp = baseHp + removedHp + bonusHp;
    }
    
    // Ensure current HP doesn't exceed max HP
    const validatedCurrentHp = Math.min(currentHp, maxHp);
    
    const hpData: DnDBeyondHPData = {};
    
    if (maxHp > 0) {
      hpData.maxHp = maxHp;
      hpData.hp = validatedCurrentHp;
    }
    
    if (tempHp > 0) {
      hpData.tempHp = tempHp;
    }

    return hpData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch HP data from D&D Beyond');
  }
}
