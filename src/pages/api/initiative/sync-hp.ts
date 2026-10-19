import type { APIRoute } from 'astro';
import { db, Character, InitiativeTracker, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { fetchDnDBeyondHP, type DnDBeyondHPData } from '../../../lib/dndbeyond';

// The tracker and the DM screen both auto-sync while combat runs. Requests within this window
// share one D&D Beyond round-trip instead of each fetching every character again.
const AUTO_SYNC_MIN_INTERVAL_MS = 8000;
let lastSync: { at: number; body: string } | null = null;
let running: Promise<string> | null = null;

/**
 * Sync HP for all characters in initiative tracker that have D&D Beyond URLs
 * POST /api/initiative/sync-hp            (auto: may return the result of a sync from <8 s ago)
 * POST /api/initiative/sync-hp?force=1    (the Sync HP button: always fetches)
 */
export const POST: APIRoute = async ({ cookies, url }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  const force = url.searchParams.has('force');
  if (!force && lastSync && Date.now() - lastSync.at < AUTO_SYNC_MIN_INTERVAL_MS) {
    return new Response(lastSync.body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    running ??= syncAll().finally(() => { running = null; });
    const body = await running;
    lastSync = { at: Date.now(), body };
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('HP sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function syncAll(): Promise<string> {
  // Get all initiative entries
  const initiatives = await db.select().from(InitiativeTracker);
  
  // Get all characters with D&D Beyond URLs
  const characters = await db.select().from(Character);
  const charactersWithDnDBeyond = characters.filter(c => c.dndbeyondUrl);

  // Create a map of character IDs to their initiative entries
  const characterIdToInitiative = new Map();
  initiatives.forEach(initiative => {
    // Use characterId field for direct matching
    if (initiative.characterId) {
      characterIdToInitiative.set(initiative.characterId, initiative);
    } else {
      // Fallback: Find matching character by name for entries without characterId
      const matchingChar = characters.find(c => c.name === initiative.name);
      if (matchingChar) {
        characterIdToInitiative.set(matchingChar.id, initiative);
      }
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
      const updateData: any = {
        hp: hpData.hp,
        maxHp: hpData.maxHp,
        tempHp: hpData.tempHp ?? 0,
        updatedAt: new Date(),
      };
      
      // Reset death saves if HP is above 0, otherwise sync from D&D Beyond
      if (hpData.hp && hpData.hp > 0) {
        updateData.deathSaveSuccesses = 0;
        updateData.deathSaveFailures = 0;
        updateData.isStable = false;
      } else {
        updateData.deathSaveSuccesses = hpData.deathSaveSuccesses ?? 0;
        updateData.deathSaveFailures = hpData.deathSaveFailures ?? 0;
        updateData.isStable = hpData.isStable ?? false;
      }
      
      await db.update(Character)
        .set(updateData)
        .where(eq(Character.id, character.id));

      // Update initiative entry if this character is in the tracker
      const initiativeEntry = characterIdToInitiative.get(character.id);
      if (initiativeEntry) {
        const initiativeUpdateData: any = {
          hp: hpData.hp,
          maxHp: hpData.maxHp,
          tempHp: hpData.tempHp ?? 0,
          updatedAt: new Date(),
        };
        
        // Reset death saves if HP is above 0, otherwise sync from D&D Beyond
        if (hpData.hp && hpData.hp > 0) {
          initiativeUpdateData.deathSaveSuccesses = 0;
          initiativeUpdateData.deathSaveFailures = 0;
          initiativeUpdateData.isStable = false;
        } else {
          initiativeUpdateData.deathSaveSuccesses = hpData.deathSaveSuccesses ?? 0;
          initiativeUpdateData.deathSaveFailures = hpData.deathSaveFailures ?? 0;
          initiativeUpdateData.isStable = hpData.isStable ?? false;
        }
        
        await db.update(InitiativeTracker)
          .set(initiativeUpdateData)
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

  return JSON.stringify({
    success: true,
    syncedCount: syncResults.filter(r => r.success).length,
    totalCount: charactersWithDnDBeyond.length,
    results: syncResults,
  });
}
