import type { APIRoute } from 'astro';
import { db, Character, eq } from 'astro:db';
import { requirePlayerOrAbove } from '../../../lib/middleware';

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

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

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
      isActive: body.isActive !== undefined ? body.isActive : true,
      avatarUrl: body.avatarUrl,
      dndbeyondUrl: body.dndbeyondUrl,
      stats: body.stats,
      // Additional character details
      gender: body.gender,
      alignment: body.alignment,
      background: body.background,
      age: body.age,
      height: body.height,
      weight: body.weight,
      eyes: body.eyes,
      skin: body.skin,
      hair: body.hair,
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
