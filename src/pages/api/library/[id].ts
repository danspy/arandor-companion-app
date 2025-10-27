import type { APIRoute } from 'astro';
import { db, LibraryEntry, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const entry = await db.select().from(LibraryEntry).where(eq(LibraryEntry.id, params.id!));
    
    if (entry.length === 0) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(entry[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch library entry' }), {
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
    
    await db.update(LibraryEntry)
      .set({
        title: body.title,
        content: body.content,
        tags: body.tags || [],
        locationId: body.locationId || null,
        updatedAt: now,
      })
      .where(eq(LibraryEntry.id, params.id!));

    const updatedEntry = await db.select().from(LibraryEntry).where(eq(LibraryEntry.id, params.id!));
    
    return new Response(JSON.stringify(updatedEntry[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update library entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    await db.delete(LibraryEntry).where(eq(LibraryEntry.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete library entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
