import type { APIRoute } from 'astro';
import { db, Character, InitiativeTracker, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

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
      throw new Error(`Failed to fetch character data: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract HP data
    const baseHp = data.data?.baseHitPoints || 0;
    const bonusHp = data.data?.bonusHitPoints || 0;
    const overrideHp = data.data?.overrideHitPoints;
    const removedHp = data.data?.removedHitPoints || 0;
    const tempHp = data.data?.temporaryHitPoints || 0;
    
    const maxHp = overrideHp !== null && overrideHp !== undefined ? overrideHp : (baseHp + bonusHp);
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
    console.error('Error fetching HP from D&D Beyond:', error);
    return {}; // Return empty object on error, don't fail the whole sync
  }
}

/**
 * Sync HP for all characters in initiative tracker that have D&D Beyond URLs
 * POST /api/initiative/sync-hp
 */
export const POST: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    // Get all initiative entries of type 'character'
    const initiatives = await db.select().from(InitiativeTracker);
    const characterInitiatives = initiatives.filter(i => i.type === 'character');

    // Get all active characters with D&D Beyond URLs
    const characters = await db.select().from(Character);
    const charactersWithDnDBeyond = characters.filter(c => c.dndbeyondUrl);

    const syncResults = [];
    
    // For each character with D&D Beyond URL
    for (const character of charactersWithDnDBeyond) {
      try {
        // Fetch HP data from D&D Beyond
        const hpData = await fetchDnDBeyondHP(character.dndbeyondUrl!);
        
        if (Object.keys(hpData).length === 0) {
          syncResults.push({
            characterId: character.id,
            characterName: character.name,
            success: false,
            error: 'Failed to fetch HP from D&D Beyond',
          });
          continue;
        }

        // Update character in database
        await db.update(Character)
          .set({
            hp: hpData.hp,
            maxHp: hpData.maxHp,
            tempHp: hpData.tempHp,
            updatedAt: new Date(),
          })
          .where(eq(Character.id, character.id));

        // Update any initiative entries for this character
        const characterInInitiative = characterInitiatives.find(
          i => i.name === character.name
        );

        if (characterInInitiative) {
          await db.update(InitiativeTracker)
            .set({
              hp: hpData.hp,
              maxHp: hpData.maxHp,
              updatedAt: new Date(),
            })
            .where(eq(InitiativeTracker.id, characterInInitiative.id));
        }

        syncResults.push({
          characterId: character.id,
          characterName: character.name,
          success: true,
          hp: hpData.hp,
          maxHp: hpData.maxHp,
          tempHp: hpData.tempHp,
          updatedInInitiative: !!characterInInitiative,
        });
      } catch (error) {
        console.error(`Error syncing character ${character.name}:`, error);
        syncResults.push({
          characterId: character.id,
          characterName: character.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      syncedCount: syncResults.filter(r => r.success).length,
      totalCount: charactersWithDnDBeyond.length,
      results: syncResults,
    }), {
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
