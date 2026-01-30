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
    
    // Debug: Log ALL HP-related fields to understand API structure
    console.log('[D&D Beyond HP Sync] Character ID:', characterId);
    console.log('[D&D Beyond HP Sync] Raw HP fields from API:');
    console.log('  baseHitPoints:', data.data?.baseHitPoints);
    console.log('  bonusHitPoints:', data.data?.bonusHitPoints);
    console.log('  overrideHitPoints:', data.data?.overrideHitPoints);
    console.log('  removedHitPoints:', data.data?.removedHitPoints);
    console.log('  temporaryHitPoints:', data.data?.temporaryHitPoints);
    
    // Check for any other HP-related fields
    const allKeys = Object.keys(data.data || {});
    const hpRelatedKeys = allKeys.filter(k => 
      k.toLowerCase().includes('hit') || 
      k.toLowerCase().includes('hp') ||
      k.toLowerCase().includes('health')
    );
    if (hpRelatedKeys.length > 0) {
      console.log('  Other HP-related fields found:', hpRelatedKeys);
      hpRelatedKeys.forEach(key => {
        if (!['baseHitPoints', 'bonusHitPoints', 'overrideHitPoints', 'removedHitPoints', 'temporaryHitPoints'].includes(key)) {
          console.log(`    ${key}:`, data.data[key]);
        }
      });
    }
    
    // Extract HP data
    // D&D Beyond stores HP in the following fields:
    // - baseHitPoints: CURRENT HP (not base max HP!)
    // - bonusHitPoints: bonus HP from items/features (added to max)
    // - overrideHitPoints: manual override for max HP (if set, replaces calculated max)
    // - removedHitPoints: damage taken (HP lost from max)
    // - temporaryHitPoints: temp HP
    const baseHp = data.data?.baseHitPoints || 0;
    const bonusHp = data.data?.bonusHitPoints || 0;
    const overrideHp = data.data?.overrideHitPoints;
    const removedHp = data.data?.removedHitPoints || 0;
    const tempHp = data.data?.temporaryHitPoints || 0;
    
    // baseHitPoints is the CURRENT HP (after damage)
    const currentHp = baseHp;
    
    // Calculate max HP: current HP + damage taken + any bonuses
    const calculatedMaxHp = baseHp + removedHp + bonusHp;
    
    // Use override if set and greater than 0, otherwise use calculated max
    const maxHp = (overrideHp !== null && overrideHp !== undefined && overrideHp > 0) 
      ? overrideHp 
      : calculatedMaxHp;
    
    console.log('[D&D Beyond HP Sync] Calculated values:');
    console.log('  currentHp:', currentHp, '(from baseHitPoints)');
    console.log('  maxHp:', maxHp, `(${overrideHp !== null && overrideHp !== undefined && overrideHp > 0 ? 'override' : 'current + damage + bonus'})`);
    console.log('  Formula:', overrideHp !== null && overrideHp !== undefined && overrideHp > 0 
      ? `override(${overrideHp})`
      : `${baseHp} + ${removedHp} + ${bonusHp} = ${calculatedMaxHp}`);
    console.log('  tempHp:', tempHp);
    
    const hpData: DnDBeyondHPData = {};
    
    if (maxHp > 0) {
      hpData.maxHp = maxHp;
      hpData.hp = currentHp;
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
