import type { APIRoute } from 'astro';
import { db, Faction, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';

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
    const id = crypto.randomUUID();
    const now = new Date();
    
    await db.insert(Faction).values({
      id,
      name: body.name,
      status: body.status || 'neutral',
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
