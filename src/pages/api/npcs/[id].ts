import type { APIRoute } from 'astro';
import { db, Creature, NPC, eq } from '@/db';
import { isDungeonmasterOrAdmin, requireDungeonmasterOrAdmin, requirePlayerOrAbove } from '../../../lib/middleware';
import { statBlockHpByNpc } from '../../../lib/creature-links';
import { effectiveNpcHp, npcStatusUpdate, publicNpc } from '../../../lib/npc-status';
import { shareFromNpc } from '../../../lib/npc-combatants';

// HP and conditions (lib/npc-status) only reach the DM and admins
export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const npc = await db.select().from(NPC).where(eq(NPC.id, params.id!));
    
    if (npc.length === 0) {
      return new Response(JSON.stringify({ error: 'NPC not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify((await isDungeonmasterOrAdmin(cookies)) ? npc[0] : publicNpc(npc[0])), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch NPC' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const now = new Date();
    
    await db.update(NPC)
      .set({
        name: body.name,
        race: body.race,
        occupation: body.occupation,
        location: body.location,
        locationId: body.locationId,
        description: body.description,
        relationship: body.relationship,
        notes: body.notes,
        avatarUrl: body.avatarUrl,
        updatedAt: now,
      })
      .where(eq(NPC.id, params.id!));

    const updatedNPC = await db.select().from(NPC).where(eq(NPC.id, params.id!));
    
    return new Response(JSON.stringify((await isDungeonmasterOrAdmin(cookies)) ? updatedNPC[0] : publicNpc(updatedNPC[0])), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update NPC' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    await db.delete(NPC).where(eq(NPC.id, params.id!));
    // Stat blocks it used no longer list it
    for (const c of await db.select({ id: Creature.id, npcIds: Creature.npcIds }).from(Creature)) {
      if (c.npcIds.includes(params.id!)) {
        await db.update(Creature).set({ npcIds: c.npcIds.filter((id: string) => id !== params.id) }).where(eq(Creature.id, c.id));
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete NPC' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PATCH { hp?, maxHp?, conditions? } - The NPC's status on the DM screen (DM/admin). Only the
// fields sent change; HP stays within 0 and max HP (the linked stat block's while it has none).
// Its combatants in the initiative tracker follow (lib/npc-combatants).
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    const npc = await db.select().from(NPC).where(eq(NPC.id, params.id!)).get();
    if (!npc) return json({ error: 'NPC not found' }, 404);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid JSON' }, 400);

    const result = npcStatusUpdate(body, effectiveNpcHp(npc, (await statBlockHpByNpc()).get(npc.id)));
    if ('error' in result) return json({ error: result.error }, 400);
    if (Object.keys(result.update).length) {
      await db.update(NPC).set({ ...result.update, updatedAt: new Date() }).where(eq(NPC.id, npc.id));
      await shareFromNpc(npc.id);
    }
    return json((await db.select().from(NPC).where(eq(NPC.id, npc.id)).get())!);
  } catch (error) {
    console.error('Error changing NPC status:', error);
    return json({ error: 'Failed to update NPC' }, 500);
  }
};
