import type { APIRoute } from 'astro';
import { db, Character, eq } from 'astro:db';
import { requirePlayerOrAbove } from '../../../lib/middleware';
import { getCurrentUser, getUserRole } from '../../../lib/auth';
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
  hp?: number;
  maxHp?: number;
  tempHp?: number;
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
 * Fetch character data from D&D Beyond
 */
async function fetchDnDBeyondCharacter(url: string): Promise<DnDBeyondCharacterData> {
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
    
    // Extract character information
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

    // Extract HP data with proper calculations
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
    
    if (maxHp > 0) {
      characterData.maxHp = maxHp;
      characterData.hp = validatedCurrentHp;
    }
    
    if (tempHp > 0) {
      characterData.tempHp = tempHp;
    }

    // Extract ability scores (base stats only - users should manually update if needed)
    characterData.stats = {
      strength: calculateAbilityScore(1, data),
      dexterity: calculateAbilityScore(2, data),
      constitution: calculateAbilityScore(3, data),
      intelligence: calculateAbilityScore(4, data),
      wisdom: calculateAbilityScore(5, data),
      charisma: calculateAbilityScore(6, data),
    };

    return characterData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch character data from D&D Beyond');
  }
}

/**
 * Sync full character data from D&D Beyond
 * POST /api/characters/sync
 * Body: { characterId: string }
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { characterId } = body;

    if (!characterId || typeof characterId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Character ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get character from database
    const character = await db.select().from(Character).where(eq(Character.id, characterId)).get();
    
    if (!character) {
      return new Response(
        JSON.stringify({ error: 'Character not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get current user and their role
    const currentUser = await getCurrentUser(cookies);
    const userRole = await getUserRole(cookies);
    
    // Check if user has permission to sync this character
    const isAdmin = userRole === 'admin';
    const isOwner = currentUser && character.userId === currentUser.id;
    const isUnowned = !character.userId;
    
    if (!isAdmin && !isOwner && !isUnowned) {
      return new Response(JSON.stringify({ 
        error: 'You do not have permission to sync this character. Only the character owner or admins can sync.' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!character.dndbeyondUrl) {
      return new Response(
        JSON.stringify({ error: 'Character does not have a D&D Beyond URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch character data from D&D Beyond
    const dndbeyondData = await fetchDnDBeyondCharacter(character.dndbeyondUrl);

    // Update character in database with all synced data
    // Important: Do NOT override stats if user has manually edited them
    const now = new Date();
    const updateData: any = {
      name: dndbeyondData.name || character.name,
      race: dndbeyondData.race || character.race,
      class: dndbeyondData.class || character.class,
      level: dndbeyondData.level || character.level,
      avatarUrl: dndbeyondData.avatarUrl || character.avatarUrl,
      hp: dndbeyondData.hp !== undefined ? dndbeyondData.hp : character.hp,
      maxHp: dndbeyondData.maxHp !== undefined ? dndbeyondData.maxHp : character.maxHp,
      tempHp: dndbeyondData.tempHp !== undefined ? dndbeyondData.tempHp : character.tempHp,
      gender: dndbeyondData.gender || character.gender,
      alignment: dndbeyondData.alignment || character.alignment,
      background: dndbeyondData.background || character.background,
      age: dndbeyondData.age || character.age,
      height: dndbeyondData.height || character.height,
      weight: dndbeyondData.weight || character.weight,
      eyes: dndbeyondData.eyes || character.eyes,
      skin: dndbeyondData.skin || character.skin,
      hair: dndbeyondData.hair || character.hair,
      lastSyncedAt: now,
      updatedAt: now,
    };
    
    // Only update stats if they were not manually edited by the user
    if (!character.statsManuallyEdited) {
      updateData.stats = dndbeyondData.stats || character.stats;
    }
    
    await db.update(Character)
      .set(updateData)
      .where(eq(Character.id, characterId));

    // Return updated character
    const updatedCharacter = await db.select().from(Character).where(eq(Character.id, characterId)).get();

    return new Response(JSON.stringify(updatedCharacter), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Character sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
