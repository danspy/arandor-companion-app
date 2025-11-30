import type { APIRoute } from 'astro';
import { db, Faction, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const faction = await db.select().from(Faction).where(eq(Faction.id, params.id!));
    
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
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const now = new Date();
    
    await db.update(Faction)
      .set({
        name: body.name,
        status: body.status,
        updatedAt: now,
      })
      .where(eq(Faction.id, params.id!));

    const updatedFaction = await db.select().from(Faction).where(eq(Faction.id, params.id!));
    
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
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    await db.delete(Faction).where(eq(Faction.id, params.id!));
    
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
