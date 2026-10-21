import type { APIRoute } from 'astro';
import { db, Scene, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { validateScene } from '../../../lib/scenes';
import { sceneValues, toCards } from '../../../lib/scene-cards';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// PUT - Rename a scene and/or replace its setup
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const existing = await db.select().from(Scene).where(eq(Scene.id, params.id!)).get();
    if (!existing) return json({ error: 'Scene not found' }, 404);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const checked = validateScene(body);
    if (!checked.ok) return json({ error: checked.error }, 400);
    await db.update(Scene).set({ name: checked.name, ...sceneValues(checked.setup), updatedAt: new Date() }).where(eq(Scene.id, existing.id));
    const row = await db.select().from(Scene).where(eq(Scene.id, existing.id)).get();
    return json((await toCards([row!]))[0]);
  } catch (error) {
    console.error('Error updating scene:', error);
    return json({ error: 'Failed to update scene' }, 500);
  }
};

// DELETE - Remove a scene
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    await db.delete(Scene).where(eq(Scene.id, params.id!));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting scene:', error);
    return json({ error: 'Failed to delete scene' }, 500);
  }
};
