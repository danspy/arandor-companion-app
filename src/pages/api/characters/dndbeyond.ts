import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/middleware';

interface DnDBeyondCharacterData {
  name?: string;
  race?: string;
  class?: string;
  level?: number;
  avatarUrl?: string;
  stats?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
}

/**
 * Parse D&D Beyond character data from the public character sheet.
 * This is a simplified implementation that extracts basic information.
 * Note: D&D Beyond doesn't have an official public API, so we're using
 * their internal JSON endpoint. This may break if they change their site structure.
 */
async function fetchDnDBeyondCharacter(url: string): Promise<DnDBeyondCharacterData> {
  try {
    // Extract character ID from URL
    const characterIdMatch = url.match(/characters\/(\d+)/);
    if (!characterIdMatch) {
      throw new Error('Invalid D&D Beyond character URL. Expected format: https://www.dndbeyond.com/characters/[id]');
    }

    const characterId = characterIdMatch[1];
    
    // D&D Beyond's character service endpoint
    // Note: This is their internal API endpoint used by their own site.
    // Version may change in the future (currently v5). Monitor for updates.
    const API_VERSION = 'v5';
    const jsonUrl = `https://character-service.dndbeyond.com/character/${API_VERSION}/character/${characterId}`;
    
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArandorCompanion/1.0)',
      },
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 404) {
        throw new Error('Character not found or not public. Make sure the character sheet is set to public in D&D Beyond.');
      }
      throw new Error(`Failed to fetch character data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract character information from the JSON response
    const characterData: DnDBeyondCharacterData = {
      name: data.data?.name || undefined,
      race: data.data?.race?.fullName || data.data?.race?.baseName || undefined,
      level: data.data?.classes?.reduce((total: number, cls: any) => total + (cls.level || 0), 0) || undefined,
      class: data.data?.classes?.map((cls: any) => cls.definition?.name || cls.name).join(' / ') || undefined,
      avatarUrl: data.data?.decorations?.avatarUrl || data.data?.avatarUrl || undefined,
    };

    // Extract ability scores
    const stats = data.data?.stats;
    if (stats && Array.isArray(stats)) {
      characterData.stats = {
        strength: stats.find((s: any) => s.id === 1)?.value,
        dexterity: stats.find((s: any) => s.id === 2)?.value,
        constitution: stats.find((s: any) => s.id === 3)?.value,
        intelligence: stats.find((s: any) => s.id === 4)?.value,
        wisdom: stats.find((s: any) => s.id === 5)?.value,
        charisma: stats.find((s: any) => s.id === 6)?.value,
      };
    }

    return characterData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch character data from D&D Beyond');
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
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
