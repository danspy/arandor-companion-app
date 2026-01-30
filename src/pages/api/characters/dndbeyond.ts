import type { APIRoute } from 'astro';
import { requirePlayerOrAbove } from '../../../lib/middleware';

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
    // - baseHitPoints: base max HP
    // - bonusHitPoints: bonus HP from items/features (added to max)
    // - overrideHitPoints: manual override for max HP (if set, replaces baseHitPoints + bonusHitPoints)
    // - removedHitPoints: damage taken (subtracted from current HP)
    // - temporaryHitPoints: temp HP
    const baseHp = data.data?.baseHitPoints || 0;
    const bonusHp = data.data?.bonusHitPoints || 0;
    const overrideHp = data.data?.overrideHitPoints;
    const removedHp = data.data?.removedHitPoints || 0;
    const tempHp = data.data?.temporaryHitPoints || 0;
    
    // Calculate max HP (use override if set and greater than 0, otherwise base + bonus)
    const maxHp = (overrideHp !== null && overrideHp !== undefined && overrideHp > 0) ? overrideHp : (baseHp + bonusHp);
    
    // Calculate current HP (max - damage)
    const currentHp = Math.max(0, maxHp - removedHp);
    
    if (maxHp > 0) {
      characterData.maxHp = maxHp;
      characterData.hp = currentHp;
    }
    
    if (tempHp > 0) {
      characterData.tempHp = tempHp;
    }

    // Extract ability scores
    const stats = data.data?.stats;
    if (stats && Array.isArray(stats)) {
      characterData.stats = {
        strength: stats.find((s: any) => s.id === 1)?.value,
        dexterity: stats.find((s: any) => s.id === 2)?.value,
        constitution: stats.find((s: any) => s.id === 3)?.value,
        intelligence: stats.find((s: any) => s.id === 4)?.value,
        wisdom: stats.find((s: any) => s.id === 5)?.value,
        charisma: stats.find((s: any) => s.id === 6)?.value,
      };
    }

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
