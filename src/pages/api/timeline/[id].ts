import type { APIRoute } from 'astro';
import { db, TimelineEntry, eq } from '@/db';
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
    
    // Build update values based on entry type
    const values: any = {
      entryType: body.entryType || 'event',
      sortOrder: body.sortOrder !== undefined ? body.sortOrder : null,
      updatedAt: now,
    };

    if (body.entryType === 'label') {
      // Labels need year for positioning and label text
      values.year = body.year;
      values.label = body.label;
      // Clear event-specific fields
      values.month = null;
      values.headline = null;
      values.shortDescription = null;
      values.fullDescription = null;
      values.imageUrl = null;
      values.diaryEntryIds = [];
      values.libraryDocsEntryIds = [];
      values.npcIds = [];
      values.locationIds = [];
      values.characterIds = [];
      values.questIds = [];
    } else {
      // Events need year, month and other fields
      values.year = body.year;
      values.month = body.month || null;
      values.headline = body.headline;
      values.shortDescription = body.shortDescription || null;
      values.fullDescription = body.fullDescription || null;
      values.imageUrl = body.imageUrl || null;
      values.diaryEntryIds = body.diaryEntryIds || [];
      values.libraryDocsEntryIds = body.libraryDocsEntryIds || [];
      values.npcIds = body.npcIds || [];
      values.locationIds = body.locationIds || [];
      values.characterIds = body.characterIds || [];
      values.questIds = body.questIds || [];
      // Clear label field
      values.label = null;
    }
    
    await db.update(TimelineEntry)
      .set(values)
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
