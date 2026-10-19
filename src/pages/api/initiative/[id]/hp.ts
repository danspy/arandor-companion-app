import type { APIRoute } from 'astro';
import { db, Character, InitiativeTracker, eq } from '@/db';
import { getCurrentUser } from '../../../../lib/auth';
import { requireAuth } from '../../../../lib/middleware';
import { applyHpChange, isOwnEntry, ownedCharacters, redactEntry } from '../../../../lib/combat';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// POST { kind: 'damage' | 'heal', amount } - Damage or heal one combatant.
// DM/admin: anyone. Players: their own characters only. A character's own record follows
// (like /api/initiative/update-hp), so its HP is right outside the fight too.
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;
  try {
    const user = await getCurrentUser(cookies);
    if (!user) return json({ error: 'User not found' }, 401);
    const entry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, params.id!)).get();
    if (!entry) return json({ error: 'Initiative entry not found' }, 404);

    const isDm = user.role === 'admin' || user.role === 'dungeonmaster';
    const owned = await ownedCharacters(isDm ? null : user.id);
    if (!isDm && !isOwnEntry(entry, owned)) return json({ error: 'You can only change your own characters' }, 403);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const amount = Number(body?.amount);
    if (body?.kind !== 'damage' && body?.kind !== 'heal') return json({ error: "kind must be 'damage' or 'heal'" }, 400);
    if (!Number.isInteger(amount) || amount < 0 || amount > 10000) return json({ error: 'amount must be a whole number from 0 to 10000' }, 400);
    if (entry.hp === null && entry.maxHp === null) return json({ error: 'This combatant has no hit points set' }, 400);

    const change = applyHpChange(entry, body.kind, amount);
    const update: Partial<typeof InitiativeTracker.$inferInsert> = { hp: change.hp, tempHp: change.tempHp, updatedAt: new Date() };
    if (change.resetDeathSaves && change.hp > 0) Object.assign(update, { deathSaveSuccesses: 0, deathSaveFailures: 0, isStable: false });
    await db.update(InitiativeTracker).set(update).where(eq(InitiativeTracker.id, entry.id));

    if (entry.type === 'character') {
      const character = entry.characterId
        ? await db.select().from(Character).where(eq(Character.id, entry.characterId)).get()
        : (await db.select().from(Character)).find((c) => c.name === entry.name);
      if (character) {
        const charUpdate: Partial<typeof Character.$inferInsert> = { hp: change.hp, tempHp: change.tempHp, updatedAt: new Date() };
        if (update.deathSaveSuccesses === 0) Object.assign(charUpdate, { deathSaveSuccesses: 0, deathSaveFailures: 0, isStable: false });
        await db.update(Character).set(charUpdate).where(eq(Character.id, character.id));
      }
    }

    const updated = (await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, entry.id)).get())!;
    return json(isDm ? updated : redactEntry(updated, owned));
  } catch (error) {
    console.error('Error changing HP:', error);
    return json({ error: 'Failed to change HP' }, 500);
  }
};
