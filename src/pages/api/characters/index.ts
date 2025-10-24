import type { APIRoute } from 'astro';
import { db, Character, eq } from 'astro:db';

export const GET: APIRoute = async () => {
  try {
    const characters = await db.select().from(Character);
    return new Response(JSON.stringify(characters), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch characters' }), {
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
    
    await db.insert(Character).values({
      id,
      name: body.name,
      class: body.class,
      level: body.level,
      race: body.race,
      player: body.player,
      avatarUrl: body.avatarUrl,
      dndbeyondUrl: body.dndbeyondUrl,
      stats: body.stats,
      createdAt: now,
      updatedAt: now,
    });

    const newCharacter = await db.select().from(Character).where(eq(Character.id, id));
    
    return new Response(JSON.stringify(newCharacter[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create character' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
