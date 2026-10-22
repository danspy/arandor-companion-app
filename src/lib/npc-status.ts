// HP and conditions of NPCs for the DM screen spotlight (NPC.hp, maxHp, conditions). They are
// the DM's: only DM/admin see or change them, every other NPC response leaves them out. An NPC
// whose HP was never set uses the HP of the stat block it is linked to (Creature.npcIds) until
// the first change, which writes it to the NPC. An NPC in the initiative tracker has the same HP
// and conditions there (lib/npc-combatants). Pure (server and browser).

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

interface TrackerRow { name: string; type: string; characterId: string | null; isActive: boolean }

/**
 * The combatant a spotlight entry is while a fight runs (not stopped): a party character by its
 * character id (or name, for entries without one), an NPC by its name like the stat block links
 * (lib/creature-links). Its HP and conditions then win over the NPC's or character's own.
 */
export function spotlightCombatant<T extends TrackerRow>(
  entries: T[],
  combatStatus: string | null | undefined,
  kind: 'character' | 'npc',
  who: { id: string; name: string },
): T | null {
  if (!combatStatus || combatStatus === 'stopped') return null;
  const name = who.name.trim();
  return entries.find((e) => e.isActive && (kind === 'character'
    ? e.type === 'character' && (e.characterId ? e.characterId === who.id : e.name.trim() === name)
    : e.type !== 'character' && e.name.trim() === name)) ?? null;
}

/**
 * HP and conditions of a combatant joining the fight as a named NPC: what the request sends wins
 * (the NPC then follows), the rest is the NPC as it is now. Without an NPC, just what was sent.
 */
export function joiningStatus(
  sent: { hp: number | null; maxHp: number | null; conditions: string[] | null },
  npc: { hp: number | null; maxHp: number | null; conditions: string[] } | null,
): { hp: number | null; maxHp: number | null; conditions: string[] } {
  if (!npc) return { hp: sent.hp, maxHp: sent.maxHp, conditions: sent.conditions ?? [] };
  let hp = sent.hp ?? npc.hp;
  let maxHp = sent.maxHp ?? npc.maxHp;
  // More HP than the max: a typed-in max HP holds, the NPC's own grows with them
  if (hp !== null && maxHp !== null && hp > maxHp) {
    if (sent.maxHp !== null) hp = maxHp;
    else maxHp = hp;
  }
  return { hp, maxHp, conditions: sent.conditions ?? npc.conditions };
}

/** The combatant that is this NPC (by name, never a party character), in a running fight or not. */
export function combatantOfNpc<T extends TrackerRow>(entries: T[], name: string): T | null {
  const n = name.trim();
  return entries.find((e) => e.type !== 'character' && e.name.trim() === n) ?? null;
}
