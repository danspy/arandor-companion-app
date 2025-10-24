import type { APIRoute } from 'astro';
import { db, NPC, eq } from 'astro:db';

export const GET: APIRoute = async () => {
  try {
    const npcs = await db.select().from(NPC);
    return new Response(JSON.stringify(npcs), {
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

export const POST: APIRoute = async ({ request }) => {
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
      description: body.description,
      relationship: body.relationship || 'neutral',
      notes: body.notes,
      createdAt: now,
      updatedAt: now,
    });

    const newNPC = await db.select().from(NPC).where(eq(NPC.id, id));
    
    return new Response(JSON.stringify(newNPC[0]), {
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
