import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../../lib/middleware';
import { generateDiaryImage } from '../../../../utils/ai';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

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
 * Downloads the image from the temporary URL and saves it to the uploads folder
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

    // Download the image from the temporary URL and save it to uploads folder
    let persistentImageUrl = imageUrl;
    
    try {
      // Download the image from the temporary URL
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        console.error('Failed to download image:', imageResponse.status, imageResponse.statusText);
        return new Response(JSON.stringify({ 
          error: 'Failed to download image from temporary URL',
          details: `HTTP ${imageResponse.status}: ${imageResponse.statusText}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get the image buffer
      const imageBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(imageBuffer);

      // Determine file extension from content-type or default to png
      const contentType = imageResponse.headers.get('content-type') || 'image/png';
      const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
      
      // Generate unique filename
      const filename = `ai-${randomUUID()}.${ext}`;
      
      // Ensure upload directory exists
      const isDev = import.meta.env.DEV;
      const uploadDir = isDev 
        ? join(process.cwd(), 'public', 'uploads')
        : '/srv/arandor/uploads';
      await mkdir(uploadDir, { recursive: true });
      
      // Save to uploads directory
      const filepath = join(uploadDir, filename);
      await writeFile(filepath, buffer);
      
      // Update the persistent image URL to point to our local file
      persistentImageUrl = `/uploads/${filename}`;
      
      console.log('AI-generated image saved successfully:', persistentImageUrl);
    } catch (downloadError) {
      console.error('Error downloading/saving image:', downloadError);
      return new Response(JSON.stringify({ 
        error: 'Failed to save image permanently',
        details: downloadError instanceof Error ? downloadError.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save the persistent local image URL to coverImageUrl
    const now = new Date();
    await db.update(DiaryEntry)
      .set({
        coverImageUrl: persistentImageUrl,
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
