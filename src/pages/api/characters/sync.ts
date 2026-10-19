import type { APIRoute } from 'astro';
import { db, Character, eq } from '@/db';
import { requirePlayerOrAbove } from '../../../lib/middleware';
import { getCurrentUser, getUserRole } from '../../../lib/auth';
import { fetchDnDBeyondCharacter } from '../../../lib/dndbeyond';
import { canSeePrivateSheet, forViewer } from '../../../lib/character-sheet';

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
      sheet: dndbeyondData.sheet ?? character.sheet,
      lastSyncedAt: now,
      updatedAt: now,
    };
    
    // Only update stats if they were not manually edited by the user
    if (!character.statsManuallyEdited) {
      updateData.stats = dndbeyondData.stats || character.stats;
    }
    // If statsManuallyEdited is true, stats are preserved (not in updateData)
    
    await db.update(Character)
      .set(updateData)
      .where(eq(Character.id, characterId));

    // Return updated character
    const updatedCharacter = await db.select().from(Character).where(eq(Character.id, characterId)).get();

    return new Response(JSON.stringify(updatedCharacter && forViewer(updatedCharacter, canSeePrivateSheet(updatedCharacter, currentUser, userRole))), {
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
