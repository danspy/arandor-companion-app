import type { APIRoute } from 'astro';
import { db, Event, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const event = await db.select().from(Event).where(eq(Event.id, params.id!));
    
    if (event.length === 0) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(event[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch event' }), {
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
    
    await db.update(Event)
      .set({
        title: body.title,
        description: body.description,
        date: body.date,
        time: body.time,
        duration: body.duration,
        hostId: body.hostId,
        updatedAt: now,
      })
      .where(eq(Event.id, params.id!));

    const updatedEvent = await db.select().from(Event).where(eq(Event.id, params.id!));
    
    return new Response(JSON.stringify(updatedEvent[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return new Response(JSON.stringify({ error: 'Failed to update event' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    await db.delete(Event).where(eq(Event.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete event' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
