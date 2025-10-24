import type { APIRoute } from 'astro';
import { db, Location, eq } from 'astro:db';

export const GET: APIRoute = async ({ params }) => {
  try {
    const location = await db.select().from(Location).where(eq(Location.id, params.id!));
    
    if (location.length === 0) {
      return new Response(JSON.stringify({ error: 'Location not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(location[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch location' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const body = await request.json();
    const now = new Date();
    
    await db.update(Location)
      .set({
        name: body.name,
        type: body.type,
        description: body.description,
        region: body.region,
        visited: body.visited,
        notes: body.notes,
        updatedAt: now,
      })
      .where(eq(Location.id, params.id!));

    const updatedLocation = await db.select().from(Location).where(eq(Location.id, params.id!));
    
    return new Response(JSON.stringify(updatedLocation[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update location' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    await db.delete(Location).where(eq(Location.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete location' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
