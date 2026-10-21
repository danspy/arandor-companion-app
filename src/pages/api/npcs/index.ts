import type { APIRoute } from 'astro';
import { db, NPC, eq } from '@/db';
import { isDungeonmasterOrAdmin, requirePlayerOrAbove } from '../../../lib/middleware';
import { publicNpc } from '../../../lib/npc-status';

// HP and conditions (lib/npc-status) only reach the DM and admins
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const npcs = await db.select().from(NPC);
    return new Response(JSON.stringify((await isDungeonmasterOrAdmin(cookies)) ? npcs : npcs.map(publicNpc)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch NPCs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const now = new Date();
    
    await db.insert(NPC).values({
      id,
      name: body.name,
      race: body.race,
      occupation: body.occupation,
      location: body.location,
      locationId: body.locationId,
      description: body.description,
      relationship: body.relationship || 'neutral',
      notes: body.notes,
      avatarUrl: body.avatarUrl,
      createdAt: now,
      updatedAt: now,
    });

    const newNPC = await db.select().from(NPC).where(eq(NPC.id, id));
    
    return new Response(JSON.stringify((await isDungeonmasterOrAdmin(cookies)) ? newNPC[0] : publicNpc(newNPC[0])), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create NPC' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
