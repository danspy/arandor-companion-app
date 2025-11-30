import type { APIRoute } from 'astro';
import { db, Faction, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';

const VALID_STATUSES = ['enemy', 'suspicious', 'neutral', 'friendly', 'respectful'];

export const GET: APIRoute = async () => {
  try {
    const factions = await db.select().from(Faction);
    return new Response(JSON.stringify(factions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch factions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Faction name is required and must be a non-empty string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate status if provided
    const status = body.status || 'neutral';
    if (!VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = new Date();
    
    await db.insert(Faction).values({
      id,
      name: body.name.trim(),
      status,
      createdAt: now,
      updatedAt: now,
    });

    const newFaction = await db.select().from(Faction).where(eq(Faction.id, id));
    
    return new Response(JSON.stringify(newFaction[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create faction' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
