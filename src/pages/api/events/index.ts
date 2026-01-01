import type { APIRoute } from 'astro';
import { db, Event, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

export const GET: APIRoute = async () => {
  try {
    const events = await db.select().from(Event);
    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
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
    
    await db.insert(Event).values({
      id,
      title: body.title,
      description: body.description,
      date: body.date,
      time: body.time,
      duration: body.duration,
      hostId: body.hostId,
      createdAt: now,
      updatedAt: now,
    });

    const newEvent = await db.select().from(Event).where(eq(Event.id, id));
    
    return new Response(JSON.stringify(newEvent[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create event' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
