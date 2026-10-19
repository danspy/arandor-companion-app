import type { APIRoute } from 'astro';
import { db, Creature, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { srdCreature, srdToCreature } from '../../../lib/srd';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// POST { key } - The DM's own copy of an SRD 5.2 creature: the existing one (with any edits made
// since), or a new one. Used by "Add to fight" and "Copy to my bestiary" in the SRD library.
export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const { key } = (await request.json().catch(() => ({}))) as { key?: string };
    const source = typeof key === 'string' ? srdCreature(key) : undefined;
    if (!source) return json({ error: 'Unknown SRD creature' }, 404);
    const existing = await db.select().from(Creature).where(eq(Creature.srdKey, source.key)).get();
    if (existing) return json(existing);
    const now = new Date();
    const row = { id: crypto.randomUUID(), ...srdToCreature(source), srdKey: source.key, createdAt: now, updatedAt: now };
    await db.insert(Creature).values(row);
    return json(row, 201);
  } catch (error) {
    console.error('Error copying SRD creature:', error);
    return json({ error: 'Failed to copy the creature' }, 500);
  }
};
