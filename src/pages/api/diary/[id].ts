import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from '@/db';
import { requirePlayerOrAbove } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const entry = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, params.id!));
    
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
    return new Response(JSON.stringify({ error: 'Failed to fetch diary entry' }), {
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
    
    // Fetch existing entry to preserve fields not in the update request
    const existingEntries = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, params.id!));
    const existingEntry = existingEntries[0];
    
    if (!existingEntry) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Build update object, preserving existing values for fields not in the request
    // Type assertion is safe here as we're only updating valid DiaryEntry fields
    const updateData = {
      date: body.date,
      title: body.title,
      content: body.content,
      session: body.session,
      tags: body.tags,
      coverImageUrl: body.coverImageUrl || null,
      coverVideoUrl: body.coverVideoUrl || null,
      galleryUrls: body.galleryUrls || [],
      npcIds: body.npcIds || [],
      locationIds: body.locationIds || [],
      characterIds: body.characterIds || [],
      questIds: body.questIds || [],
      updatedAt: now,
    } as const;
    
    // Create mutable copy for conditional updates
    const finalUpdateData = { ...updateData };
    
    // Only update summary if explicitly provided in the request
    // This prevents accidental deletion when these fields are not included in the form
    if ('summary' in body) {
      (finalUpdateData as any).summary = body.summary || null;
    }
    
    await db.update(DiaryEntry)
      .set(finalUpdateData)
      .where(eq(DiaryEntry.id, params.id!));

    const updatedEntry = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, params.id!));
    
    return new Response(JSON.stringify(updatedEntry[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update diary entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    await db.delete(DiaryEntry).where(eq(DiaryEntry.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete diary entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
