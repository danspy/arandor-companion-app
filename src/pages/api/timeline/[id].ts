import type { APIRoute } from 'astro';
import { db, TimelineEntry, eq } from 'astro:db';
import { requirePlayerOrAbove } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const entry = await db.select().from(TimelineEntry).where(eq(TimelineEntry.id, params.id!));
    
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
    return new Response(JSON.stringify({ error: 'Failed to fetch timeline entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const now = new Date();
    
    await db.update(TimelineEntry)
      .set({
        year: body.year,
        month: body.month,
        headline: body.headline,
        shortDescription: body.shortDescription,
        fullDescription: body.fullDescription,
        imageUrl: body.imageUrl || null,
        diaryEntryIds: body.diaryEntryIds || [],
        libraryEntryIds: body.libraryEntryIds || [],
        npcIds: body.npcIds || [],
        locationIds: body.locationIds || [],
        characterIds: body.characterIds || [],
        questIds: body.questIds || [],
        updatedAt: now,
      })
      .where(eq(TimelineEntry.id, params.id!));

    const updatedEntry = await db.select().from(TimelineEntry).where(eq(TimelineEntry.id, params.id!));
    
    return new Response(JSON.stringify(updatedEntry[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update timeline entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    await db.delete(TimelineEntry).where(eq(TimelineEntry.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete timeline entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
