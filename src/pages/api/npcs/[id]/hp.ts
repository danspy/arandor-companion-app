import type { APIRoute } from 'astro';
import { db, NPC, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../../lib/middleware';
import { statBlockHpByNpc } from '../../../../lib/creature-links';
import { applyHpChange } from '../../../../lib/hp';
import { effectiveNpcHp, MAX_NPC_HP } from '../../../../lib/npc-status';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// POST { kind: 'damage' | 'heal', amount } - Damage or heal an NPC outside the fight (the DM
// screen spotlight; DM/admin). An NPC without HP of its own starts from its stat block's, and
// keeps them from then on. Answers like /api/initiative/[id]/hp (with tempHp), so the same HP
// field (lib/hp-control) works for both.
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const npc = await db.select().from(NPC).where(eq(NPC.id, params.id!)).get();
    if (!npc) return json({ error: 'NPC not found' }, 404);
    const body = await request.json().catch(() => null);
    const amount = Number(body?.amount);
    if (body?.kind !== 'damage' && body?.kind !== 'heal') return json({ error: "kind must be 'damage' or 'heal'" }, 400);
    if (!Number.isInteger(amount) || amount < 0 || amount > MAX_NPC_HP) return json({ error: `amount must be a whole number from 0 to ${MAX_NPC_HP}` }, 400);

    const current = effectiveNpcHp(npc, (await statBlockHpByNpc()).get(npc.id));
    if (current.hp === null && current.maxHp === null) return json({ error: 'This NPC has no hit points set' }, 400);
    const { hp } = applyHpChange({ ...current, tempHp: null }, body.kind, amount);
    await db.update(NPC).set({ hp, maxHp: current.maxHp, updatedAt: new Date() }).where(eq(NPC.id, npc.id));

    const updated = (await db.select().from(NPC).where(eq(NPC.id, npc.id)).get())!;
    return json({ ...updated, tempHp: null });
  } catch (error) {
    console.error('Error changing NPC HP:', error);
    return json({ error: 'Failed to change HP' }, 500);
  }
};
