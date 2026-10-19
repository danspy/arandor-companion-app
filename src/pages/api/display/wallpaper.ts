import type { APIRoute } from 'astro';
import { db, DMScreenState, eq } from '@/db';

// GET - The DM screen wallpaper when it was saved inline as a data: URL (before wallpapers
// were uploaded as files). The ?v= hash in the URL changes with the image, so it can be cached.
export const GET: APIRoute = async () => {
  const screen = await db.select({ url: DMScreenState.placeholderImageUrl })
    .from(DMScreenState).where(eq(DMScreenState.id, 'current-dm-screen')).get();
  const match = screen?.url?.match(/^data:(image\/[\w.+-]+);base64,(.*)$/s);
  if (!match) return new Response(null, { status: 404 });

  return new Response(Buffer.from(match[2], 'base64'), {
    status: 200,
    headers: {
      'Content-Type': match[1],
      'Cache-Control': 'public, max-age=31536000, immutable',
      // An SVG opened directly must not run scripts on this origin
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
};
