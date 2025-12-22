import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../../lib/middleware';
import { generateDiaryImage } from '../../../../utils/ai';

/**
 * POST /api/diary/[id]/generate-image
 * Generates an AI image for a diary entry and saves it
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

    // Generate image using the entry title, content, and optional summary
    const result = await generateDiaryImage(entry.title, entry.content, entry.summary || undefined);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update the entry with the generated image URL
    const now = new Date();
    await db.update(DiaryEntry)
      .set({
        aiGeneratedImageUrl: result.imageUrl,
        updatedAt: now,
      })
      .where(eq(DiaryEntry.id, entryId));

    // Fetch and return the updated entry
    const updatedEntries = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, entryId));
    
    return new Response(JSON.stringify({ 
      success: true,
      imageUrl: result.imageUrl,
      entry: updatedEntries[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * DELETE /api/diary/[id]/generate-image
 * Deletes the AI-generated image from a diary entry
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

    // Delete the AI-generated image by setting it to null
    const now = new Date();
    await db.update(DiaryEntry)
      .set({
        aiGeneratedImageUrl: null,
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
    console.error('Error deleting AI-generated image:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete AI-generated image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
