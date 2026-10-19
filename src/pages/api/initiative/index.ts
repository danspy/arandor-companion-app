import type { APIRoute } from 'astro';
import { db, InitiativeTracker, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { getCurrentUser } from '../../../lib/auth';
import { getEntries, ownedCharacters, preserveTurn, redactEntry, setCombatState } from '../../../lib/combat';
import { creatureIdForNpcName } from '../../../lib/creature-links';

const VALID_TYPES = ['character', 'npc', 'monster', 'other'];

// GET - Fetch the initiative tracker in turn order.
// DM/admin get every field. Everyone else (including logged-out visitors) gets a health band
// instead of HP, and exact HP only for their own characters; AC and notes are DM-only.
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const entries = await getEntries();
    const user = await getCurrentUser(cookies);
    const isDm = user?.role === 'admin' || user?.role === 'dungeonmaster';
    const owned = await ownedCharacters(isDm ? null : user?.id);
    const body = isDm ? entries : entries.map((e) => redactEntry(e, owned));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch initiative tracker' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Name is required and must be a non-empty string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (typeof body.initiative !== 'number') {
      return new Response(JSON.stringify({ error: 'Initiative is required and must be a number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate type if provided
    const type = body.type || 'other';
    if (!VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: `Type must be one of: ${VALID_TYPES.join(', ')}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = new Date();
    // An NPC added by name gets the stat block it uses, if it has one
    const creatureId = typeof body.creatureId === 'string' && body.creatureId
      ? body.creatureId
      : type === 'npc' ? await creatureIdForNpcName(body.name) : null;
    
    await preserveTurn(() => db.insert(InitiativeTracker).values({
      id,
      name: body.name.trim(),
      initiative: body.initiative,
      type,
      characterId: body.characterId || null,
      hp: body.hp !== undefined && body.hp !== null ? body.hp : null,
      maxHp: body.maxHp !== undefined && body.maxHp !== null ? body.maxHp : null,
      tempHp: body.tempHp !== undefined ? (body.tempHp || 0) : null,
      ac: body.ac || null,
      notes: body.notes?.trim() || null,
      creatureId,
      isActive: body.isActive !== undefined ? body.isActive : true,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      isStable: false,
      createdAt: now,
      updatedAt: now,
    }));

    const newEntry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, id));
    
    return new Response(JSON.stringify(newEntry[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create initiative entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Remove every entry and stop combat (the tracker's "Clear all")
export const DELETE: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    await db.delete(InitiativeTracker);
    await setCombatState({ status: 'stopped', currentRound: 1, currentTurnIndex: 0 });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to clear initiative tracker' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
