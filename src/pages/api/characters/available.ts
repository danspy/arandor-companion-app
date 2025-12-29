import type { APIRoute } from 'astro';
import { db, Character, User } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';
import { getCurrentUser } from '../../../lib/auth';

// GET - Get available characters (not assigned to other users)
export const GET: APIRoute = async ({ cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all characters
    const allCharacters = await db.select().from(Character);
    
    // Get all users to find which characters are assigned
    const allUsers = await db.select().from(User);
    
    // Collect character IDs assigned to OTHER users
    const assignedCharacterIds = new Set<string>();
    allUsers.forEach(user => {
      if (user.id !== currentUser.id && user.characterIds && Array.isArray(user.characterIds)) {
        user.characterIds.forEach((charId: string) => assignedCharacterIds.add(charId));
      }
    });
    
    // Get current user's assigned characters
    const currentUserCharacterIds = currentUser.characterIds || [];
    
    // Filter characters: include only those not assigned to other users OR already assigned to current user
    const availableCharacters = allCharacters.filter(char => 
      !assignedCharacterIds.has(char.id) || currentUserCharacterIds.includes(char.id)
    );

    return new Response(JSON.stringify(availableCharacters), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching available characters:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch available characters' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
