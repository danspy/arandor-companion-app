import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { db, DMScreenState, Scene, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { snapshotSetup, validateScene } from '../../../lib/scenes';
import { sceneValues, toCards } from '../../../lib/scene-cards';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// GET - All saved scenes in the DM's order (DM/admin only)
export const GET: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const rows = await db.select().from(Scene);
    rows.sort((a, b) => a.sortOrder - b.sortOrder);
    return json(await toCards(rows));
  } catch (error) {
    console.error('Error fetching scenes:', error);
    return json({ error: 'Failed to fetch scenes' }, 500);
  }
};

// POST - Save a scene: { name, setup } or { name, fromCurrent: true } (snapshot of the live screen)
export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    let candidate = body;
    if (body?.fromCurrent === true) {
      const state = await db.select().from(DMScreenState).where(eq(DMScreenState.id, 'current-dm-screen')).get();
      candidate = { name: body.name, setup: state ? snapshotSetup(state) : { spotlightIds: [] } };
    }
    const checked = validateScene(candidate);
    if (!checked.ok) return json({ error: checked.error }, 400);
    const existing = await db.select({ sortOrder: Scene.sortOrder }).from(Scene);
    const sortOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(Scene).values({ id, name: checked.name, sortOrder, ...sceneValues(checked.setup), createdAt: now, updatedAt: now });
    const row = await db.select().from(Scene).where(eq(Scene.id, id)).get();
    return json((await toCards([row!]))[0], 201);
  } catch (error) {
    console.error('Error creating scene:', error);
    return json({ error: 'Failed to create scene' }, 500);
  }
};
