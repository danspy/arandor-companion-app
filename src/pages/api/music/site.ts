import type { APIRoute } from 'astro';
import { json, loadSitePlaylist } from '../../../lib/music/server';

// GET - The site playlist with its tracks (public, no login needed)
export const GET: APIRoute = async () => {
  try {
    return json({ playlist: await loadSitePlaylist() });
  } catch (error) {
    console.error('Error fetching site playlist:', error);
    return json({ error: 'Failed to fetch site playlist' }, 500);
  }
};
