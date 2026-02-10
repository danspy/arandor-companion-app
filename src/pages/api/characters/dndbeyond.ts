import type { APIRoute } from 'astro';
import { requirePlayerOrAbove } from '../../../lib/middleware';
import { calculateAbilityScore } from '../../../lib/dndbeyond';

interface DnDBeyondCharacterData {
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
  hp?: number; // Current HP
  maxHp?: number; // Maximum HP
  tempHp?: number; // Temporary HP
  stats?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
}

/**
 * Convert D&D Beyond alignment ID to alignment name
 */
function getAlignmentName(alignmentId: number): string {
  const alignments: { [key: number]: string } = {
    1: 'Lawful Good',
    2: 'Neutral Good',
    3: 'Chaotic Good',
    4: 'Lawful Neutral',
    5: 'True Neutral',
    6: 'Chaotic Neutral',
    7: 'Lawful Evil',
    8: 'Neutral Evil',
    9: 'Chaotic Evil',
  };
  return alignments[alignmentId] || 'Unknown';
}

/**
 * Parse D&D Beyond character data from the public character sheet.
 * This is a simplified implementation that extracts basic information.
 * Note: D&D Beyond doesn't have an official public API, so we're using
 * their internal JSON endpoint. This may break if they change their site structure.
 */
async function fetchDnDBeyondCharacter(url: string): Promise<DnDBeyondCharacterData> {
  try {
    // Extract character ID from URL
    const characterIdMatch = url.match(/characters\/(\d+)/);
    if (!characterIdMatch) {
      throw new Error('Invalid D&D Beyond character URL. Expected format: https://www.dndbeyond.com/characters/[id]');
    }

    const characterId = characterIdMatch[1];
    
    // D&D Beyond's character service endpoint
    // Note: This is their internal API endpoint used by their own site.
    // Version may change in the future (currently v5). Monitor for updates.
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
      throw new Error(`Failed to fetch character data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract character information from the JSON response
    const characterData: DnDBeyondCharacterData = {
      name: data.data?.name || undefined,
      race: data.data?.race?.fullName || data.data?.race?.baseName || undefined,
      level: data.data?.classes?.reduce((total: number, cls: any) => total + (cls.level || 0), 0) || undefined,
      class: data.data?.classes?.map((cls: any) => cls.definition?.name || cls.name).join(' / ') || undefined,
      avatarUrl: data.data?.decorations?.avatarUrl || data.data?.avatarUrl || undefined,
      gender: data.data?.gender || undefined,
      alignment: data.data?.alignmentId ? getAlignmentName(data.data.alignmentId) : undefined,
      background: data.data?.background?.definition?.name || data.data?.background?.name || undefined,
      age: data.data?.age || undefined,
      height: data.data?.height || undefined,
      weight: data.data?.weight || undefined,
      eyes: data.data?.eyes || undefined,
      skin: data.data?.skin || undefined,
      hair: data.data?.hair || undefined,
    };

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
    // Use the calculated ability score (base + bonuses + overrides)
    const conScore = calculateAbilityScore(3, data); // Constitution is stat id 3
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
    // Modifiers array is often empty, so we need to check feats directly
    const feats = data.data?.feats || [];
    let featHpBonus = 0;
    
    feats.forEach((feat: any) => {
      const featName = feat.definition?.name || feat.name || '';
      // Tough feat: +2 HP per character level
      if (featName === 'Tough') {
        featHpBonus += 2 * totalLevel;
      }
    });
    
    // Calculate HP based on whether override is set
    // NOTE: This logic is duplicated in src/lib/dndbeyond.ts
    // Consider extracting to a shared utility function in the future
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
    
    if (maxHp > 0) {
      characterData.maxHp = maxHp;
      characterData.hp = validatedCurrentHp;
    }
    
    if (tempHp > 0) {
      characterData.tempHp = tempHp;
    }

    // Extract ability scores with proper calculation (base + bonuses + overrides)
    characterData.stats = {
      strength: calculateAbilityScore(1, data),
      dexterity: calculateAbilityScore(2, data),
      constitution: calculateAbilityScore(3, data),
      intelligence: calculateAbilityScore(4, data),
      wisdom: calculateAbilityScore(5, data),
      charisma: calculateAbilityScore(6, data),
    };
    
    // Debug logging to help troubleshoot ability score issues
    console.log('[D&D Beyond Import] Character:', data.data?.name);
    console.log('[D&D Beyond Import] Base stats:', data.data?.stats?.map((s: any) => `${s.id}:${s.value}`).join(', '));
    console.log('[D&D Beyond Import] Bonus stats:', data.data?.bonusStats?.map((s: any) => `${s.id}:${s.value}`).join(', ') || 'none');
    console.log('[D&D Beyond Import] Override stats:', data.data?.overrideStats?.map((s: any) => `${s.id}:${s.value}`).join(', ') || 'none');
    
    // Debug: Check modifiers for stat bonuses
    const modifiersArray = data.data?.modifiers;
    const statModifiers = Array.isArray(modifiersArray) ? modifiersArray.filter((m: any) => 
      m.subType && (m.subType.includes('-score') || m.subType.includes('ability'))
    ) : [];
    console.log('[D&D Beyond Import] Stat-related modifiers:', statModifiers.length > 0 ? JSON.stringify(statModifiers.slice(0, 5), null, 2) : 'none');
    
    // Debug: Check race structure
    console.log('[D&D Beyond Import] Race:', data.data?.race?.fullName || data.data?.race?.baseName);
    console.log('[D&D Beyond Import] Race object keys:', data.data?.race ? Object.keys(data.data.race).join(', ') : 'no race data');
    
    console.log('[D&D Beyond Import] Calculated stats:', JSON.stringify(characterData.stats));

    return characterData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch character data from D&D Beyond');
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'D&D Beyond URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    if (!url.includes('dndbeyond.com/characters/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid D&D Beyond URL format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const characterData = await fetchDnDBeyondCharacter(url);

    return new Response(JSON.stringify(characterData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('D&D Beyond fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
