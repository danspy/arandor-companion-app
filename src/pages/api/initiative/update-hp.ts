import type { APIRoute } from 'astro';
import { db, InitiativeTracker, Character, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';
import { getCurrentUser } from '../../../lib/auth';

/**
 * Update HP for a specific initiative entry
 * Players can only update HP of their own characters
 * DM/Admin can update any entry (use the PUT /api/initiative/[id] endpoint instead)
 * PUT /api/initiative/update-hp
 */
export const PUT: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { initiativeId, hp, maxHp, tempHp } = body;

    if (!initiativeId) {
      return new Response(JSON.stringify({ error: 'Initiative ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the initiative entry
    const entry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, initiativeId)).get();
    
    if (!entry) {
      return new Response(JSON.stringify({ error: 'Initiative entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if this is a character entry with a characterId
    if (entry.type !== 'character' || !entry.characterId) {
      return new Response(JSON.stringify({ error: 'Can only update HP for character entries' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the character to check ownership
    const character = await db.select().from(Character).where(eq(Character.id, entry.characterId)).get();
    
    if (!character) {
      return new Response(JSON.stringify({ error: 'Character not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check ownership - only the character's owner can update HP
    if (character.userId !== currentUser.id) {
      return new Response(JSON.stringify({ error: 'You can only update HP for your own character' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate HP values
    if (hp !== undefined && hp !== null && typeof hp !== 'number') {
      return new Response(JSON.stringify({ error: 'HP must be a number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (maxHp !== undefined && maxHp !== null && typeof maxHp !== 'number') {
      return new Response(JSON.stringify({ error: 'Max HP must be a number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (tempHp !== undefined && tempHp !== null && typeof tempHp !== 'number') {
      return new Response(JSON.stringify({ error: 'Temp HP must be a number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update HP in initiative tracker
    const now = new Date();
    const updateData: any = {
      updatedAt: now,
    };

    if (hp !== undefined) updateData.hp = hp;
    if (maxHp !== undefined) updateData.maxHp = maxHp;
    if (tempHp !== undefined) updateData.tempHp = tempHp;

    await db.update(InitiativeTracker)
      .set(updateData)
      .where(eq(InitiativeTracker.id, initiativeId));

    // Also update the character's HP in the Character table
    await db.update(Character)
      .set({
        hp: hp !== undefined ? hp : character.hp,
        maxHp: maxHp !== undefined ? maxHp : character.maxHp,
        tempHp: tempHp !== undefined ? tempHp : character.tempHp,
        updatedAt: now,
      })
      .where(eq(Character.id, character.id));

    const updatedEntry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, initiativeId)).get();
    
    return new Response(JSON.stringify(updatedEntry), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating HP:', error);
    return new Response(JSON.stringify({ error: 'Failed to update HP' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
