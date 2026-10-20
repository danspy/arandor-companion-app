import type { APIRoute } from 'astro';
import { db, Character, eq } from '@/db';
import { requirePlayerOrAbove } from '../../../lib/middleware';
import { getCurrentUser, getUserRole } from '../../../lib/auth';
import { syncCharacterFromDnDBeyond } from '../../../lib/character-sync';
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

    const { character: updatedCharacter } = await syncCharacterFromDnDBeyond(character);

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
