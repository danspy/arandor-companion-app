// Named NPCs that use a bestiary stat block (Creature.npcIds) and their combatants in the
// initiative tracker, which only know the NPC by name. Server side.

import { db, Creature, InitiativeTracker, NPC, and, eq, inArray, isNull } from '@/db';

/** The stat block an NPC (by its name in the tracker) uses, if any. */
export async function creatureIdForNpcName(name: string): Promise<string | null> {
  const npcs = await db.select({ id: NPC.id }).from(NPC).where(eq(NPC.name, name.trim()));
  if (!npcs.length) return null;
  const ids = new Set(npcs.map((n) => n.id));
  const creatures = await db.select({ id: Creature.id, npcIds: Creature.npcIds }).from(Creature);
  return creatures.find((c) => (c.npcIds as string[]).some((id) => ids.has(id)))?.id ?? null;
}

/**
 * After a stat block's NPC list changed: combatants of newly linked NPCs that are already in the
 * fight get the link (if they have none yet); those of NPCs no longer linked lose it. HP, AC and
 * everything else stay as they are.
 */
export async function syncCombatantLinks(creatureId: string, npcIds: string[], previousNpcIds: string[] = []) {
  const added = npcIds.filter((id) => !previousNpcIds.includes(id));
  const removed = previousNpcIds.filter((id) => !npcIds.includes(id));
  const names = async (ids: string[]) => (ids.length ? (await db.select({ name: NPC.name }).from(NPC).where(inArray(NPC.id, ids))).map((n) => n.name) : []);

  const addNames = await names(added);
  if (addNames.length) {
    await db.update(InitiativeTracker)
      .set({ creatureId, updatedAt: new Date() })
      .where(and(eq(InitiativeTracker.type, 'npc'), inArray(InitiativeTracker.name, addNames), isNull(InitiativeTracker.creatureId)));
  }
  const removeNames = await names(removed);
  if (removeNames.length) {
    await db.update(InitiativeTracker)
      .set({ creatureId: null, updatedAt: new Date() })
      .where(and(eq(InitiativeTracker.creatureId, creatureId), inArray(InitiativeTracker.name, removeNames)));
  }
}
