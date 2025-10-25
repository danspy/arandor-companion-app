import type { APIRoute } from 'astro';
import { db, CampaignProgress } from 'astro:db';

export const GET: APIRoute = async () => {
  try {
    const progress = await db.select().from(CampaignProgress);
    
    // Return the first (and only) progress record, or default values
    if (progress.length === 0) {
      return new Response(JSON.stringify({
        id: '1',
        currentLevel: 1,
        progressPercent: 0,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(progress[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch campaign progress' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
