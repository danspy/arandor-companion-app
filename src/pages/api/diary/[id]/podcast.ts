import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../../lib/middleware';
import { generateDiaryPodcast } from '../../../../utils/ai';

/**
 * POST /api/diary/[id]/podcast
 * Generates an AI-powered podcast narration for a diary entry
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

    // Generate podcast
    const result = await generateDiaryPodcast(entry.title, entry.content);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update the entry with the generated podcast URL
    const now = new Date();
    await db.update(DiaryEntry)
      .set({
        podcastAudioUrl: result.audioUrl,
        updatedAt: now,
      })
      .where(eq(DiaryEntry.id, entryId));

    // Fetch and return the updated entry
    const updatedEntries = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, entryId));
    
    return new Response(JSON.stringify({ 
      success: true,
      audioUrl: result.audioUrl,
      entry: updatedEntries[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error generating podcast:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate podcast',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * DELETE /api/diary/[id]/podcast
 * Deletes the podcast audio from a diary entry
 * Restricted to dungeonmaster and admin roles only
 */
export const DELETE: APIRoute = async ({ params, cookies }) => {
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

    // Fetch the diary entry to check if it exists
    const entries = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, entryId));
    const entry = entries[0];

    if (!entry) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete the podcast by setting it to null
    const now = new Date();
    await db.update(DiaryEntry)
      .set({
        podcastAudioUrl: null,
        updatedAt: now,
      })
      .where(eq(DiaryEntry.id, entryId));

    // Fetch and return the updated entry
    const updatedEntries = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, entryId));
    
    return new Response(JSON.stringify({ 
      success: true,
      entry: updatedEntries[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting podcast:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete podcast',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
