import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../../lib/middleware';
import { generateDiarySummary } from '../../../../utils/ai';

/**
 * POST /api/diary/[id]/summary
 * Generates an AI summary for a diary entry and saves it
 * Restricted to dungeonmaster and admin roles only
 */
export const POST: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const entryId = params.id;
    if (!entryId) {
      return new Response(JSON.stringify({ error: 'Entry ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the diary entry
    const entries = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, entryId));
    const entry = entries[0];

    if (!entry) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate summary
    const result = await generateDiarySummary(entry.title, entry.content);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update the entry with the generated summary
    const now = new Date();
    await db.update(DiaryEntry)
      .set({
        summary: result.summary,
        updatedAt: now,
      })
      .where(eq(DiaryEntry.id, entryId));

    // Fetch and return the updated entry
    const updatedEntries = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, entryId));
    
    return new Response(JSON.stringify({ 
      success: true,
      summary: result.summary,
      entry: updatedEntries[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
