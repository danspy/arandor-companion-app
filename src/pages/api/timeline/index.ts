import type { APIRoute } from 'astro';
import { db, TimelineEntry, eq } from '@/db';
import { requirePlayerOrAbove } from '../../../lib/middleware';

export const GET: APIRoute = async () => {
  try {
    const entries = await db.select().from(TimelineEntry);
    // Sort entries and labels by sortOrder
    const sorted = entries.sort((a, b) => {
      // Sort by sortOrder (nulls last)
      if (a.sortOrder === null || a.sortOrder === undefined) return 1;
      if (b.sortOrder === null || b.sortOrder === undefined) return -1;
      return a.sortOrder - b.sortOrder;
    });
    return new Response(JSON.stringify(sorted), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch timeline entries' }), {
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
    
    // Build insert values based on entry type
    const values: any = {
      id,
      entryType: body.entryType || 'event',
      sortOrder: body.sortOrder || null,
      createdAt: now,
      updatedAt: now,
    };

    if (body.entryType === 'label') {
      // Labels need year for positioning and label text
      values.year = body.year;
      values.label = body.label;
      // Set empty arrays for connection fields
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
    }
    
    await db.insert(TimelineEntry).values(values);

    const newEntry = await db.select().from(TimelineEntry).where(eq(TimelineEntry.id, id));
    
    return new Response(JSON.stringify(newEntry[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create timeline entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
