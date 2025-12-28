import type { APIRoute } from 'astro';
import { db, Character, InitiativeTracker, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { fetchDnDBeyondHP, type DnDBeyondHPData } from '../../../lib/dndbeyond';

/**
 * Sync HP for all characters in initiative tracker that have D&D Beyond URLs
 * POST /api/initiative/sync-hp
 */
export const POST: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    // Get all initiative entries
    const initiatives = await db.select().from(InitiativeTracker);
    
    // Get all characters with D&D Beyond URLs
    const characters = await db.select().from(Character);
    const charactersWithDnDBeyond = characters.filter(c => c.dndbeyondUrl);

    // Create a map of character IDs to their initiative entries
    // Store characterId in initiative entries for proper matching
    const characterIdToInitiative = new Map();
    initiatives.forEach(initiative => {
      // Find matching character by name (temporary until we add characterId to InitiativeTracker)
      const matchingChar = characters.find(c => c.name === initiative.name);
      if (matchingChar) {
        characterIdToInitiative.set(matchingChar.id, initiative);
      }
    });

    // Process all characters in parallel using Promise.allSettled
    const syncPromises = charactersWithDnDBeyond.map(async (character) => {
      try {
        // Fetch HP data from D&D Beyond
        const hpData = await fetchDnDBeyondHP(character.dndbeyondUrl!);
        
        if (Object.keys(hpData).length === 0) {
          return {
            characterId: character.id,
            characterName: character.name,
            success: false,
            error: 'Failed to fetch HP from D&D Beyond',
          };
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

        // Update initiative entry if this character is in the tracker
        const initiativeEntry = characterIdToInitiative.get(character.id);
        if (initiativeEntry) {
          await db.update(InitiativeTracker)
            .set({
              hp: hpData.hp,
              maxHp: hpData.maxHp,
              updatedAt: new Date(),
            })
            .where(eq(InitiativeTracker.id, initiativeEntry.id));
        }

        return {
          characterId: character.id,
          characterName: character.name,
          success: true,
          hp: hpData.hp,
          maxHp: hpData.maxHp,
          tempHp: hpData.tempHp,
          updatedInInitiative: !!initiativeEntry,
        };
      } catch (error) {
        console.error(`Error syncing character ${character.name}:`, error);
        return {
          characterId: character.id,
          characterName: character.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const results = await Promise.allSettled(syncPromises);
    
    // Extract sync results from settled promises
    const syncResults = results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        characterId: 'unknown',
        characterName: 'unknown',
        success: false,
        error: 'Promise rejected',
      }
    );

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
