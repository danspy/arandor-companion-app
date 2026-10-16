import type { APIRoute } from 'astro';
import { db, InitiativeTracker, eq } from '@/db';
import { requireDungeonmasterOrAdmin, requireAuth } from '../../../lib/middleware';

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

    return new Response(JSON.stringify(entry[0]), {
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
      // Preserve or update death saves
      updateData.deathSaveSuccesses = body.deathSaveSuccesses !== undefined ? body.deathSaveSuccesses : 0;
      updateData.deathSaveFailures = body.deathSaveFailures !== undefined ? body.deathSaveFailures : 0;
      updateData.isStable = body.isStable !== undefined ? body.isStable : false;
    }
    
    await db.update(InitiativeTracker)
      .set(updateData)
      .where(eq(InitiativeTracker.id, id));

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

    await db.delete(InitiativeTracker).where(eq(InitiativeTracker.id, id));
    
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
