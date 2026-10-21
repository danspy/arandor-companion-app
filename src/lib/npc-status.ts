// HP and conditions of NPCs for the DM screen spotlight (NPC.hp, maxHp, conditions). They are
// the DM's: only DM/admin see or change them, every other NPC response leaves them out. An NPC
// whose HP was never set uses the HP of the stat block it is linked to (Creature.npcIds) until
// the first change, which writes it to the NPC. Pure (server and browser).

import { cleanConditions } from './conditions';

export const NPC_STATUS_FIELDS = ['hp', 'maxHp', 'conditions'] as const;
export const MAX_NPC_HP = 10000;

/** An NPC row as players may see it: without the DM's status fields. */
export function publicNpc<T extends Record<string, unknown>>(npc: T): Omit<T, (typeof NPC_STATUS_FIELDS)[number]> {
  const { hp: _hp, maxHp: _maxHp, conditions: _conditions, ...rest } = npc;
  return rest;
}

/**
 * HP to show and change: the NPC's own, else the linked stat block's (average HP). Max HP
 * without current HP means unhurt.
 */
export function effectiveNpcHp(npc: { hp: number | null; maxHp: number | null }, statBlockHp: number | null | undefined) {
  const maxHp = npc.maxHp ?? statBlockHp ?? null;
  return { hp: npc.hp ?? maxHp, maxHp };
}

/**
 * Checks a PATCH body ({ hp?, maxHp?, conditions? }) against the NPC as it is now (with the
 * stat block fallback) and returns the columns to write, or an error. HP stays within 0 and the
 * max HP (when there is one); a lower max HP pulls the HP down with it.
 */
export function npcStatusUpdate(
  body: Record<string, unknown>,
  current: { hp: number | null; maxHp: number | null },
): { update: { hp?: number | null; maxHp?: number | null; conditions?: string[] } } | { error: string } {
  const update: { hp?: number | null; maxHp?: number | null; conditions?: string[] } = {};
  for (const key of ['hp', 'maxHp'] as const) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null || v === '') {
      update[key] = null;
      continue;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > MAX_NPC_HP) return { error: `${key} must be a whole number from 0 to ${MAX_NPC_HP}` };
    update[key] = n;
  }
  if ('conditions' in body) {
    const conditions = cleanConditions(body.conditions);
    if (!conditions) return { error: 'conditions must be a list of short tags' };
    update.conditions = conditions;
  }
  const maxHp = 'maxHp' in update ? update.maxHp! : current.maxHp;
  const hp = 'hp' in update ? update.hp! : current.hp;
  if (hp !== null && maxHp !== null && hp > maxHp) update.hp = maxHp;
  return { update };
}
