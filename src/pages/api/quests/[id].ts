import type { APIRoute } from 'astro';
import { db, Quest, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const quest = await db.select().from(Quest).where(eq(Quest.id, params.id!));
    
    if (quest.length === 0) {
      return new Response(JSON.stringify({ error: 'Quest not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(quest[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch quest' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const now = new Date();
    
    await db.update(Quest)
      .set({
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        updatedAt: now,
      })
      .where(eq(Quest.id, params.id!));

    const updatedQuest = await db.select().from(Quest).where(eq(Quest.id, params.id!));
    
    return new Response(JSON.stringify(updatedQuest[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update quest' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    await db.delete(Quest).where(eq(Quest.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete quest' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
