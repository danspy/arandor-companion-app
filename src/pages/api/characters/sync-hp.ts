import type { APIRoute } from 'astro';
import { db, Character, eq } from 'astro:db';
import { requirePlayerOrAbove } from '../../../lib/middleware';
import { fetchDnDBeyondHP } from '../../../lib/dndbeyond';
import { getCurrentUser, getUserRole } from '../../../lib/auth';

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
    
    // Get current user and their role
    const currentUser = await getCurrentUser(cookies);
    const userRole = await getUserRole(cookies);
    
    // Check if user has permission to sync HP for this character
    // Admins can sync HP for any character
    // Non-admins can only sync HP for characters they own (or unowned characters)
    const isAdmin = userRole === 'admin';
    const isOwner = currentUser && character.userId === currentUser.id;
    const isUnowned = !character.userId;
    
    if (!isAdmin && !isOwner && !isUnowned) {
      return new Response(JSON.stringify({ 
        error: 'You do not have permission to sync HP for this character. Only the character owner or admins can sync HP.' 
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

    // Fetch HP data from D&D Beyond
    const hpData = await fetchDnDBeyondHP(character.dndbeyondUrl);

    // Update character in database
    await db.update(Character)
      .set({
        hp: hpData.hp,
        maxHp: hpData.maxHp,
        tempHp: hpData.tempHp,
        lastSyncedAt: new Date(),
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
