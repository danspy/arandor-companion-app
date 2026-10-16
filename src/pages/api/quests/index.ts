import type { APIRoute } from 'astro';
import { db, Quest, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

export const GET: APIRoute = async () => {
  try {
    const quests = await db.select().from(Quest);
    return new Response(JSON.stringify(quests), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch quests' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const now = new Date();
    
    await db.insert(Quest).values({
      id,
      title: body.title,
      description: body.description,
      status: body.status || 'active',
      priority: body.priority || 'medium',
      createdAt: now,
      updatedAt: now,
    });

    const newQuest = await db.select().from(Quest).where(eq(Quest.id, id));
    
    return new Response(JSON.stringify(newQuest[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create quest' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
