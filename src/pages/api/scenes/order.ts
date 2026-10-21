import type { APIRoute } from 'astro';
import { db, Scene, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// PUT - Set the order of the scenes: { ids } front to back
export const PUT: APIRoute = async ({ request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const ids = body?.ids;
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return json({ error: 'ids must be a list of scene ids' }, 400);
    const known = new Set((await db.select({ id: Scene.id }).from(Scene)).map((r) => r.id));
    if (ids.some((id: string) => !known.has(id)) || new Set(ids).size !== ids.length) return json({ error: 'Unknown or duplicate scene id' }, 400);
    for (let i = 0; i < ids.length; i++) {
      await db.update(Scene).set({ sortOrder: i + 1 }).where(eq(Scene.id, ids[i]));
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error ordering scenes:', error);
    return json({ error: 'Failed to order scenes' }, 500);
  }
};
