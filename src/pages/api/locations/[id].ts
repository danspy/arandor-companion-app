import type { APIRoute } from 'astro';
import { db, Location, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';

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

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const now = new Date();
    
    // Build update object with only provided fields
    const updateData: any = {
      updatedAt: now,
    };
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.region !== undefined) updateData.region = body.region;
    if (body.visited !== undefined) updateData.visited = body.visited;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.mapX !== undefined) updateData.mapX = body.mapX;
    if (body.mapY !== undefined) updateData.mapY = body.mapY;
    if (body.visibleOnMap !== undefined) updateData.visibleOnMap = body.visibleOnMap;
    
    await db.update(Location)
      .set(updateData)
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

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

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
