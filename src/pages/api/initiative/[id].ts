import type { APIRoute } from 'astro';
import { db, InitiativeTracker, eq } from '@/db';
import { cleanConditions } from '../../../lib/conditions';
import { requireDungeonmasterOrAdmin, requireAuth } from '../../../lib/middleware';
import { getCurrentUser } from '../../../lib/auth';
import { ownedCharacters, preserveTurn, redactEntry } from '../../../lib/combat';

const VALID_TYPES = ['character', 'npc', 'monster', 'other'];

export const GET: APIRoute = async ({ params, cookies }) => {
  // Require authentication to view
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Initiative ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const entry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, id));
    
    if (entry.length === 0) {
      return new Response(JSON.stringify({ error: 'Initiative entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Same rules as the list: exact values only for the DM and for your own character
    const user = await getCurrentUser(cookies);
    const isDm = user?.role === 'admin' || user?.role === 'dungeonmaster';
    const body = isDm ? entry[0] : redactEntry(entry[0], await ownedCharacters(user?.id));

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch initiative entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Initiative ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
    
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return new Response(JSON.stringify({ error: `Type must be one of: ${VALID_TYPES.join(', ')}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existing = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, id)).get();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Initiative entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = new Date();
    
    // When HP is restored above 0, reset death saves
    const updateData: any = {
      name: body.name.trim(),
      initiative: body.initiative,
      type: body.type,
      characterId: body.characterId || null,
      hp: body.hp !== undefined && body.hp !== null ? body.hp : null,
      maxHp: body.maxHp !== undefined && body.maxHp !== null ? body.maxHp : null,
      tempHp: body.tempHp !== undefined ? (body.tempHp || 0) : null,
      ac: body.ac || null,
      notes: body.notes?.trim() || null,
      // The stat block link stays unless the request changes it (the edit form doesn't send it)
      creatureId: body.creatureId !== undefined ? (typeof body.creatureId === 'string' && body.creatureId ? body.creatureId : null) : existing.creatureId,
      // Conditions are kept unless the request sends them (the edit form doesn't)
      conditions: body.conditions !== undefined ? (cleanConditions(body.conditions) ?? existing.conditions) : existing.conditions,
      isActive: body.isActive !== undefined ? body.isActive : true,
      updatedAt: now,
    };
    
    // Handle death saves
    if (body.hp !== undefined && body.hp !== null && body.hp > 0) {
      // Reset death saves when HP > 0
      updateData.deathSaveSuccesses = 0;
      updateData.deathSaveFailures = 0;
      updateData.isStable = false;
    } else {
      // Keep the stored death saves unless the request sets them (the edit form doesn't)
      updateData.deathSaveSuccesses = body.deathSaveSuccesses ?? existing.deathSaveSuccesses;
      updateData.deathSaveFailures = body.deathSaveFailures ?? existing.deathSaveFailures;
      updateData.isStable = body.isStable ?? existing.isStable;
    }
    
    // Initiative or active flag may change the order; keep the turn with the same combatant
    await preserveTurn(() => db.update(InitiativeTracker)
      .set(updateData)
      .where(eq(InitiativeTracker.id, id)));

    const updatedEntry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, id));
    
    return new Response(JSON.stringify(updatedEntry[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update initiative entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Initiative ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await preserveTurn(() => db.delete(InitiativeTracker).where(eq(InitiativeTracker.id, id)));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete initiative entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PATCH - Change some fields of one combatant (the quick edit in the side panel; DM/admin).
// Only the fields sent change. A new initiative or in-combat flag keeps the turn where it is.
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    const existing = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, params.id!)).get();
    if (!existing) return json({ error: 'Initiative entry not found' }, 404);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON' }, 400);

    const update: Partial<typeof InitiativeTracker.$inferInsert> = {};
    const int = (key: 'initiative' | 'hp' | 'maxHp' | 'tempHp' | 'ac', min: number, max: number, nullable: boolean) => {
      if (!(key in body)) return null;
      const v = body[key];
      if (v === null || v === '') {
        if (!nullable) return `${key} is required`;
        update[key] = null as never;
        return null;
      }
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) return `${key} must be a whole number from ${min} to ${max}`;
      update[key] = n as never;
      return null;
    };
    const problem = int('initiative', -20, 99, false) ?? int('hp', 0, 100000, true) ?? int('maxHp', 0, 100000, true) ?? int('tempHp', 0, 100000, true) ?? int('ac', 0, 50, true);
    if (problem) return json({ error: problem }, 400);
    if ('notes' in body) {
      if (body.notes !== null && typeof body.notes !== 'string') return json({ error: 'notes must be text' }, 400);
      update.notes = body.notes?.trim() || null;
    }
    if ('isActive' in body) update.isActive = !!body.isActive;
    if ('conditions' in body) {
      const conditions = cleanConditions(body.conditions);
      if (!conditions) return json({ error: 'Unknown condition' }, 400);
      update.conditions = conditions;
    }
    if ('creatureId' in body) {
      if (body.creatureId !== null && typeof body.creatureId !== 'string') return json({ error: 'creatureId must be text or null' }, 400);
      update.creatureId = body.creatureId || null;
    }
    if (update.hp !== undefined && update.hp !== null && update.hp > 0) Object.assign(update, { deathSaveSuccesses: 0, deathSaveFailures: 0, isStable: false });
    if (!Object.keys(update).length) return json(existing);
    update.updatedAt = new Date();

    const reorders = update.initiative !== undefined || update.isActive !== undefined;
    const apply = () => db.update(InitiativeTracker).set(update).where(eq(InitiativeTracker.id, existing.id));
    await (reorders ? preserveTurn(apply) : apply());
    return json(await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, existing.id)).get());
  } catch (error) {
    console.error('Error updating initiative entry:', error);
    return json({ error: 'Failed to update initiative entry' }, 500);
  }
};
