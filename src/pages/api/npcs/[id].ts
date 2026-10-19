import type { APIRoute } from 'astro';
import { db, Creature, NPC, eq } from '@/db';
import { requirePlayerOrAbove } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const npc = await db.select().from(NPC).where(eq(NPC.id, params.id!));
    
    if (npc.length === 0) {
      return new Response(JSON.stringify({ error: 'NPC not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(npc[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch NPC' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const now = new Date();
    
    await db.update(NPC)
      .set({
        name: body.name,
        race: body.race,
        occupation: body.occupation,
        location: body.location,
        locationId: body.locationId,
        description: body.description,
        relationship: body.relationship,
        notes: body.notes,
        avatarUrl: body.avatarUrl,
        updatedAt: now,
      })
      .where(eq(NPC.id, params.id!));

    const updatedNPC = await db.select().from(NPC).where(eq(NPC.id, params.id!));
    
    return new Response(JSON.stringify(updatedNPC[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update NPC' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    await db.delete(NPC).where(eq(NPC.id, params.id!));
    // Stat blocks it used no longer list it
    for (const c of await db.select({ id: Creature.id, npcIds: Creature.npcIds }).from(Creature)) {
      if (c.npcIds.includes(params.id!)) {
        await db.update(Creature).set({ npcIds: c.npcIds.filter((id: string) => id !== params.id) }).where(eq(Creature.id, c.id));
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete NPC' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
