import type { APIRoute } from 'astro';
import { db, LibraryEntry, eq } from '@/db';
import { requirePlayerOrAbove } from '../../../lib/middleware';

export const GET: APIRoute = async () => {
  try {
    const entries = await db.select().from(LibraryEntry);
    return new Response(JSON.stringify(entries), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch library entries' }), {
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
    
    await db.insert(LibraryEntry).values({
      id,
      title: body.title,
      content: body.content,
      tags: body.tags || [],
      locationId: body.locationId || null,
      questIds: body.questIds || [],
      createdAt: now,
      updatedAt: now,
    });

    const newEntry = await db.select().from(LibraryEntry).where(eq(LibraryEntry.id, id));
    
    return new Response(JSON.stringify(newEntry[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create library entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
