import type { APIRoute } from 'astro';
import { db, Creature, InitiativeTracker, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { validateCreature } from '../../../lib/statblock';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// GET - One stat block (DM/admin only)
export const GET: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const row = await db.select().from(Creature).where(eq(Creature.id, params.id!)).get();
    return row ? json(row) : json({ error: 'Creature not found' }, 404);
  } catch (error) {
    console.error('Error fetching creature:', error);
    return json({ error: 'Failed to fetch creature' }, 500);
  }
};

// PUT - Replace a stat block
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const existing = await db.select().from(Creature).where(eq(Creature.id, params.id!)).get();
    if (!existing) return json({ error: 'Creature not found' }, 404);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const checked = validateCreature(body);
    if (!checked.ok) return json({ error: checked.error }, 400);
    const updatedAt = new Date();
    await db.update(Creature).set({ ...checked.creature, updatedAt }).where(eq(Creature.id, existing.id));
    return json({ ...existing, ...checked.creature, updatedAt });
  } catch (error) {
    console.error('Error updating creature:', error);
    return json({ error: 'Failed to update creature' }, 500);
  }
};

// DELETE - Remove a stat block. Combatants added from it stay in the fight, without the link.
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    await db.update(InitiativeTracker).set({ creatureId: null }).where(eq(InitiativeTracker.creatureId, params.id!));
    await db.delete(Creature).where(eq(Creature.id, params.id!));
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting creature:', error);
    return json({ error: 'Failed to delete creature' }, 500);
  }
};
