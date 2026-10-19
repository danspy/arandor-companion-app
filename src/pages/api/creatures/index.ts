import type { APIRoute } from 'astro';
import { db, Creature } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { validateCreature } from '../../../lib/statblock';
import { syncCombatantLinks } from '../../../lib/creature-links';

// The bestiary (DM/admin only, also for reading: stat blocks are never sent to players).

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// GET - All creatures, by name. ?full=1 includes the whole stat blocks (otherwise a summary).
export const GET: APIRoute = async ({ cookies, url }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const rows = (await db.select().from(Creature)).sort((a, b) => a.name.localeCompare(b.name));
    if (url.searchParams.get('full')) return json(rows);
    return json(rows.map(({ id, name, typeLine, ac, hp, hpFormula, initiative, cr, npcIds }) => ({ id, name, typeLine, ac, hp, hpFormula, initiative, cr, npcIds })));
  } catch (error) {
    console.error('Error fetching creatures:', error);
    return json({ error: 'Failed to fetch creatures' }, 500);
  }
};

// POST - New creature
export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const checked = validateCreature(body);
    if (!checked.ok) return json({ error: checked.error }, 400);
    const now = new Date();
    const id = crypto.randomUUID();
    await db.insert(Creature).values({ id, ...checked.creature, createdAt: now, updatedAt: now });
    // Its NPCs may already be in the fight
    await syncCombatantLinks(id, checked.creature.npcIds);
    return json({ id, ...checked.creature, createdAt: now, updatedAt: now }, 201);
  } catch (error) {
    console.error('Error creating creature:', error);
    return json({ error: 'Failed to create creature' }, 500);
  }
};
