import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../../lib/middleware';
import { generateDiaryImage } from '../../../../utils/ai';

/**
 * POST /api/diary/[id]/generate-image
 * Generates an AI image preview for a diary entry (does NOT save to database)
 * Returns the image URL for user preview and approval
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

    // Return the image URL for preview (NOT saved to database yet)
    return new Response(JSON.stringify({ 
      success: true,
      imageUrl: result.imageUrl,
      preview: true // Indicate this is a preview, not saved
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
 * PUT /api/diary/[id]/generate-image
 * Accepts and saves the AI-generated image preview to coverImageUrl
 * Restricted to dungeonmaster and admin roles only
 */
export const PUT: APIRoute = async ({ params, request, cookies }) => {
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

    const body = await request.json();
    const imageUrl = body.imageUrl;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'Image URL is required' }), {
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

    // Save the accepted image to coverImageUrl
    const now = new Date();
    await db.update(DiaryEntry)
      .set({
        coverImageUrl: imageUrl,
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
    console.error('Error accepting image:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to accept image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
