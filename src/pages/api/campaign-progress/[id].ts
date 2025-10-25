import type { APIRoute } from 'astro';
import { db, CampaignProgress, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const progress = await db.select().from(CampaignProgress).where(eq(CampaignProgress.id, params.id!));
    
    if (progress.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign progress not found' }), {
        status: 404,
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

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const now = new Date();
    
    await db.update(CampaignProgress)
      .set({
        currentLevel: body.currentLevel,
        currentXP: body.currentXP,
        xpForNextLevel: body.xpForNextLevel,
        updatedAt: now,
      })
      .where(eq(CampaignProgress.id, params.id!));

    const updatedProgress = await db.select().from(CampaignProgress).where(eq(CampaignProgress.id, params.id!));
    
    return new Response(JSON.stringify(updatedProgress[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update campaign progress' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
