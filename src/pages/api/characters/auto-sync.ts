import type { APIRoute } from 'astro';
import { db, Character, eq } from 'astro:db';

/**
 * Auto-sync basic character information from D&D Beyond
 * This is a lightweight sync that only updates basic info (level, class, race, name)
 * Does NOT require authentication - works for all viewers
 * Does NOT update ability scores (respects manual edits)
 * 
 * POST /api/characters/auto-sync
 * Body: { characterId: string }
 */
export const POST: APIRoute = async ({ request }) => {
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

    // Only sync if character has a D&D Beyond URL
    if (!character.dndbeyondUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Character does not have a D&D Beyond URL' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if sync is needed (last synced more than 24 hours ago)
    const now = new Date();
    const lastSynced = character.lastSyncedAt ? new Date(character.lastSyncedAt) : null;
    const hoursSinceSync = lastSynced 
      ? (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60)
      : 999; // If never synced, set high value
    
    if (hoursSinceSync < 24) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Character was synced recently (within 24 hours)',
          lastSyncedAt: character.lastSyncedAt
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract character ID from D&D Beyond URL
    const characterIdMatch = character.dndbeyondUrl.match(/characters\/(\d+)/);
    if (!characterIdMatch) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid D&D Beyond URL format' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dndbeyondCharacterId = characterIdMatch[1];
    const API_VERSION = 'v5';
    const jsonUrl = `https://character-service.dndbeyond.com/character/${API_VERSION}/character/${dndbeyondCharacterId}`;
    
    // Fetch from D&D Beyond
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArandorCompanion/1.0)',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Failed to fetch from D&D Beyond' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Extract basic data only
    const name = data.data?.name;
    const race = data.data?.race?.fullName || data.data?.race?.baseName;
    const classes = data.data?.classes || [];
    const primaryClass = classes.length > 0 
      ? classes[0].definition?.name || classes[0].name
      : null;
    const totalLevel = classes.reduce((sum: number, c: any) => sum + (c.level || 0), 0) || 1;
    
    // Check if data actually changed
    const hasChanges = 
      (name && name !== character.name) ||
      (race && race !== character.race) ||
      (primaryClass && primaryClass !== character.class) ||
      (totalLevel && totalLevel !== character.level);
    
    if (!hasChanges) {
      // No changes, just update lastSyncedAt
      await db.update(Character)
        .set({ lastSyncedAt: now })
        .where(eq(Character.id, characterId));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No changes detected',
          updated: false,
          lastSyncedAt: now
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Update only basic info (NOT stats - respect manual edits)
    await db.update(Character)
      .set({
        name: name || character.name,
        race: race || character.race,
        class: primaryClass || character.class,
        level: totalLevel || character.level,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(Character.id, characterId));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Character synced successfully',
        updated: true,
        changes: {
          name: name !== character.name,
          race: race !== character.race,
          class: primaryClass !== character.class,
          level: totalLevel !== character.level,
        },
        lastSyncedAt: now
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auto-sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Auto-sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
