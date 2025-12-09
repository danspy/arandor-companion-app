import type { APIRoute } from 'astro';
import { db, Faction, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

const VALID_STATUSES = ['enemy', 'suspicious', 'neutral', 'friendly', 'respectful'];

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Faction ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const faction = await db.select().from(Faction).where(eq(Faction.id, id));
    
    if (faction.length === 0) {
      return new Response(JSON.stringify({ error: 'Faction not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(faction[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch faction' }), {
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
      return new Response(JSON.stringify({ error: 'Faction ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Faction name is required and must be a non-empty string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return new Response(JSON.stringify({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate progress (0-100)
    const progress = typeof body.progress === 'number' ? Math.min(100, Math.max(0, body.progress)) : 50;

    const now = new Date();
    
    await db.update(Faction)
      .set({
        name: body.name.trim(),
        status: body.status,
        progress,
        updatedAt: now,
      })
      .where(eq(Faction.id, id));

    const updatedFaction = await db.select().from(Faction).where(eq(Faction.id, id));
    
    return new Response(JSON.stringify(updatedFaction[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update faction' }), {
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
      return new Response(JSON.stringify({ error: 'Faction ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.delete(Faction).where(eq(Faction.id, id));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete faction' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
