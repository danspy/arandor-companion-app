import type { APIRoute } from 'astro';
import { db, InitiativeTracker, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin, requireAuth } from '../../../lib/middleware';

const VALID_TYPES = ['character', 'npc', 'monster', 'other'];

export const GET: APIRoute = async ({ cookies }) => {
  // Require authentication to view
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const initiatives = await db.select().from(InitiativeTracker);
    // Sort by initiative (descending) and then by name
    const sortedInitiatives = initiatives.sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.name.localeCompare(b.name);
    });
    return new Response(JSON.stringify(sortedInitiatives), {
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
    
    await db.insert(InitiativeTracker).values({
      id,
      name: body.name.trim(),
      initiative: body.initiative,
      type,
      hp: body.hp || null,
      maxHp: body.maxHp || null,
      ac: body.ac || null,
      notes: body.notes?.trim() || null,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: now,
      updatedAt: now,
    });

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
