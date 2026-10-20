import type { APIRoute } from 'astro';
import { requirePlayerOrAbove } from '../../../lib/middleware';
import { fetchDnDBeyondCharacter } from '../../../lib/dndbeyond';

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'D&D Beyond URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    if (!url.includes('dndbeyond.com/characters/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid D&D Beyond URL format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const characterData = await fetchDnDBeyondCharacter(url);

    return new Response(JSON.stringify(characterData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('D&D Beyond fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
