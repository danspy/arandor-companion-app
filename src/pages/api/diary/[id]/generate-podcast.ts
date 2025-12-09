import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from 'astro:db';
import { isAuthenticated } from '../../../../lib/auth';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { preparePodcastText } from '../../../../utils/podcast';

/**
 * Generate podcast audio for a diary entry using OpenAI TTS
 * POST /api/diary/[id]/generate-podcast
 */
export const POST: APIRoute = async ({ params, cookies, request }) => {
  // Check authentication
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Entry ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get the diary entry
    const entries = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, id));
    
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ error: 'Diary entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const entry = entries[0];

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' 
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Prepare the text for podcast
    const podcastText = preparePodcastText(entry.title, entry.content);

    // Generate speech using OpenAI TTS
    // Using 'alloy' voice with German language support
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
      input: podcastText,
      speed: 0.9,
    });

    // Convert response to buffer
    const buffer = Buffer.from(await mp3Response.arrayBuffer());

    // Determine upload directory based on environment
    const isDev = import.meta.env.DEV;
    const uploadsDir = process.env.UPLOADS_DIR || 
      (isDev ? join(process.cwd(), 'public', 'uploads') : '/srv/arandor/uploads');
    const publicPath = '/uploads';

    // Ensure uploads directory exists
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate filename based on entry ID
    const filename = `podcast-${id}.mp3`;
    const filePath = join(uploadsDir, filename);
    const audioUrl = `${publicPath}/${filename}`;

    // Save the audio file
    await writeFile(filePath, buffer);

    // Update the diary entry with the podcast URL
    await db.update(DiaryEntry)
      .set({ 
        podcastAudioUrl: audioUrl,
        updatedAt: new Date()
      })
      .where(eq(DiaryEntry.id, id));

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioUrl,
        message: 'Podcast generated successfully' 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating podcast:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate podcast', 
        details: errorMessage 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
