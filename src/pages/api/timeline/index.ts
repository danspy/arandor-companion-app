import type { APIRoute } from 'astro';
import { db, TimelineEntry, eq } from 'astro:db';
import { requirePlayerOrAbove } from '../../../lib/middleware';

export const GET: APIRoute = async () => {
  try {
    const entries = await db.select().from(TimelineEntry);
    // Sort by year and month
    const sorted = entries.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
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
    
    await db.insert(TimelineEntry).values({
      id,
      year: body.year,
      month: body.month,
      headline: body.headline,
      shortDescription: body.shortDescription,
      fullDescription: body.fullDescription,
      imageUrl: body.imageUrl || null,
      diaryEntryIds: body.diaryEntryIds || [],
      libraryDocsEntryIds: body.libraryDocsEntryIds || [],
      npcIds: body.npcIds || [],
      locationIds: body.locationIds || [],
      characterIds: body.characterIds || [],
      questIds: body.questIds || [],
      createdAt: now,
      updatedAt: now,
    });

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
