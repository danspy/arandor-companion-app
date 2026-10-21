import type { APIRoute } from 'astro';
import { db, DMScreenState, Scene, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../../lib/middleware';
import { setupToStateUpdate } from '../../../../lib/scenes';
import { existenceSets, rowSetup } from '../../../../lib/scene-cards';

const DM_SCREEN_STATE_ID = 'current-dm-screen';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// POST - Put a scene on the screen. Replaces location and spotlight only; timer, initiative,
// wallpaper and the screen mode stay as they are. Deleted NPCs, characters and locations are dropped.
export const POST: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const scene = await db.select().from(Scene).where(eq(Scene.id, params.id!)).get();
    if (!scene) return json({ error: 'Scene not found' }, 404);
    const setup = rowSetup(scene);
    const update = { ...setupToStateUpdate(setup, await existenceSets(setup)), updatedAt: new Date() };
    const state = await db.select({ id: DMScreenState.id }).from(DMScreenState).where(eq(DMScreenState.id, DM_SCREEN_STATE_ID)).get();
    if (state) {
      await db.update(DMScreenState).set(update).where(eq(DMScreenState.id, DM_SCREEN_STATE_ID));
    } else {
      // A new row starts without a session, like on the DM screen
      await db.insert(DMScreenState).values({ id: DM_SCREEN_STATE_ID, customAssets: [], screenMode: 'off', screenVisible: false, ...update });
    }
    const updated = await db.select().from(DMScreenState).where(eq(DMScreenState.id, DM_SCREEN_STATE_ID)).get();
    return json(updated);
  } catch (error) {
    console.error('Error applying scene:', error);
    return json({ error: 'Failed to apply scene' }, 500);
  }
};
