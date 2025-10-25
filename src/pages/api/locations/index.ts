import type { APIRoute } from 'astro';
import { db, Location, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';

export const GET: APIRoute = async () => {
  try {
    const locations = await db.select().from(Location);
    return new Response(JSON.stringify(locations), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch locations' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const now = new Date();
    
    await db.insert(Location).values({
      id,
      name: body.name,
      type: body.type,
      description: body.description,
      region: body.region,
      visited: body.visited || false,
      notes: body.notes,
      mapX: body.mapX,
      mapY: body.mapY,
      visibleOnMap: body.visibleOnMap !== undefined ? body.visibleOnMap : false, // Default to hidden
      createdAt: now,
      updatedAt: now,
    });

    const newLocation = await db.select().from(Location).where(eq(Location.id, id));
    
    return new Response(JSON.stringify(newLocation[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create location' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
