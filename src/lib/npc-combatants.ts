// One HP and one set of conditions per named NPC. The NPC keeps them (NPC.hp, maxHp, conditions;
// lib/npc-status) and its combatants in the initiative tracker, which know it only by name (like
// lib/creature-links), carry the same: a change to either is written to both, so the DM screen,
// the tracker and the next session show the same. Party characters and combatants without an
// NPC of their name keep their own. Server side.

import { db, InitiativeTracker, NPC, eq, sql } from '@/db';
import { statBlockHpByNpc } from './creature-links';
import { effectiveNpcHp } from './npc-status';

interface Status { hp: number | null; maxHp: number | null; conditions: string[] }

const npcsNamed = (name: string) => sql`trim(${NPC.name}) = ${name.trim()}`;
const combatantsNamed = (name: string) => sql`trim(${InitiativeTracker.name}) = ${name.trim()} and ${InitiativeTracker.type} != 'character'`;

async function statusOf(npc: typeof NPC.$inferSelect): Promise<Status> {
  return { ...effectiveNpcHp(npc, (await statBlockHpByNpc()).get(npc.id)), conditions: npc.conditions as string[] };
}

/** The status of the NPC a combatant of this name and type is (its stat block's HP while it has none), or null. */
export async function npcStatusFor(name: string, type: string): Promise<Status | null> {
  if (type === 'character') return null;
  const npc = await db.select().from(NPC).where(npcsNamed(name)).get();
  return npc ? statusOf(npc) : null;
}

/** After a combatant joined or its HP or conditions changed: its NPC and the NPC's other combatants follow. */
export async function shareFromCombatant(entryId: string) {
  const entry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, entryId)).get();
  if (!entry || entry.type === 'character') return;
  if (!(await db.select({ id: NPC.id }).from(NPC).where(npcsNamed(entry.name)).get())) return;
  const status: Status = { hp: entry.hp, maxHp: entry.maxHp, conditions: entry.conditions as string[] };
  const updatedAt = new Date();
  await db.update(NPC).set({ ...status, updatedAt }).where(npcsNamed(entry.name));
  await db.update(InitiativeTracker).set({ ...status, updatedAt }).where(combatantsNamed(entry.name));
}

/** After an NPC's HP or conditions changed on the DM screen: its combatants follow. */
export async function shareFromNpc(npcId: string) {
  const npc = await db.select().from(NPC).where(eq(NPC.id, npcId)).get();
  if (!npc) return;
  await db.update(InitiativeTracker).set({ ...(await statusOf(npc)), updatedAt: new Date() }).where(combatantsNamed(npc.name));
}
