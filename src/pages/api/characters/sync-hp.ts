import type { APIRoute } from 'astro';
import { db, Character, eq } from 'astro:db';
import { requirePlayerOrAbove } from '../../../lib/middleware';

interface DnDBeyondHPData {
  hp?: number;
  maxHp?: number;
  tempHp?: number;
}

/**
 * Fetch HP data from D&D Beyond character sheet
 */
async function fetchDnDBeyondHP(url: string): Promise<DnDBeyondHPData> {
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
        throw new Error('Character not found or not public');
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
    
    // Calculate max HP (use override if set, otherwise base + bonus)
    const maxHp = overrideHp !== null && overrideHp !== undefined ? overrideHp : (baseHp + bonusHp);
    
    // Calculate current HP (max - damage)
    const currentHp = Math.max(0, maxHp - removedHp);
    
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

/**
 * Sync HP data for a character from D&D Beyond
 * POST /api/characters/sync-hp
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

    if (!character.dndbeyondUrl) {
      return new Response(
        JSON.stringify({ error: 'Character does not have a D&D Beyond URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch HP data from D&D Beyond
    const hpData = await fetchDnDBeyondHP(character.dndbeyondUrl);

    // Update character in database
    await db.update(Character)
      .set({
        hp: hpData.hp,
        maxHp: hpData.maxHp,
        tempHp: hpData.tempHp,
        updatedAt: new Date(),
      })
      .where(eq(Character.id, characterId));

    // Return updated character
    const updatedCharacter = await db.select().from(Character).where(eq(Character.id, characterId)).get();

    return new Response(JSON.stringify(updatedCharacter), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('HP sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
