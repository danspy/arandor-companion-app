import type { APIRoute } from 'astro';
import { db, Character, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const character = await db.select().from(Character).where(eq(Character.id, params.id!));
    
    if (character.length === 0) {
      return new Response(JSON.stringify({ error: 'Character not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(character[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch character' }), {
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
    
    await db.update(Character)
      .set({
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
        updatedAt: now,
      })
      .where(eq(Character.id, params.id!));

    const updatedCharacter = await db.select().from(Character).where(eq(Character.id, params.id!));
    
    return new Response(JSON.stringify(updatedCharacter[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update character' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    await db.delete(Character).where(eq(Character.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete character' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
