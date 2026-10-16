import type { APIRoute } from 'astro';
import { db, PageSettings, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

export const GET: APIRoute = async ({ params }) => {
  try {
    const pageName = params.pageName;
    if (!pageName) {
      return new Response(JSON.stringify({ error: 'Page name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const settings = await db.select().from(PageSettings).where(eq(PageSettings.pageName, pageName));
    
    if (settings.length === 0) {
      // Return default empty settings if none exist
      return new Response(JSON.stringify({ 
        pageName, 
        heroImageUrl: null 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(settings[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch page settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const pageName = params.pageName;
    if (!pageName) {
      return new Response(JSON.stringify({ error: 'Page name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const now = new Date();
    
    // Check if settings exist
    const existing = await db.select().from(PageSettings).where(eq(PageSettings.pageName, pageName));
    
    if (existing.length === 0) {
      // Create new settings
      const id = crypto.randomUUID();
      await db.insert(PageSettings).values({
        id,
        pageName,
        heroImageUrl: body.heroImageUrl || null,
        createdAt: now,
        updatedAt: now,
      });
      
      const newSettings = await db.select().from(PageSettings).where(eq(PageSettings.id, id));
      return new Response(JSON.stringify(newSettings[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Update existing settings
      await db.update(PageSettings)
        .set({
          heroImageUrl: body.heroImageUrl !== undefined ? body.heroImageUrl : existing[0].heroImageUrl,
          updatedAt: now,
        })
        .where(eq(PageSettings.pageName, pageName));

      const updatedSettings = await db.select().from(PageSettings).where(eq(PageSettings.pageName, pageName));
      
      return new Response(JSON.stringify(updatedSettings[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error updating page settings:', error);
    return new Response(JSON.stringify({ error: 'Failed to update page settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
