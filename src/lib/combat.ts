// Shared combat logic for the initiative tracker, the DM screen and the player display.
//
// The turn is stored as an index into the *active* entries in turn order
// (CombatState.currentTurnIndex). Everything that reorders that list (adding, removing,
// (de)activating or re-rolling a combatant) goes through `preserveTurn`, so the same
// combatant keeps the turn instead of the index silently pointing at someone else.

import { db, CombatState, InitiativeTracker, Character, User, eq } from '@/db';

export const COMBAT_STATE_ID = 'current-combat';

export type InitiativeEntry = typeof InitiativeTracker.$inferSelect;
export type CombatStateRow = typeof CombatState.$inferSelect;

/** Highest initiative first, ties by name. Every view uses this order. */
export function byTurnOrder(a: InitiativeEntry, b: InitiativeEntry): number {
  if (b.initiative !== a.initiative) return b.initiative - a.initiative;
  return a.name.localeCompare(b.name);
}

export async function getEntries(): Promise<InitiativeEntry[]> {
  return (await db.select().from(InitiativeTracker)).sort(byTurnOrder);
}

export async function getCombatState(): Promise<CombatStateRow> {
  const state = await db.select().from(CombatState).where(eq(CombatState.id, COMBAT_STATE_ID)).get();
  if (state) return state;
  const fresh = { id: COMBAT_STATE_ID, currentRound: 1, currentTurnIndex: 0, status: 'stopped', updatedAt: new Date() };
  await db.insert(CombatState).values(fresh);
  return fresh;
}

export async function setCombatState(update: Partial<Omit<CombatStateRow, 'id'>>): Promise<CombatStateRow> {
  await getCombatState();
  await db.update(CombatState).set({ ...update, updatedAt: new Date() }).where(eq(CombatState.id, COMBAT_STATE_ID));
  return getCombatState();
}

/**
 * The entry whose turn it is, or null when nobody is active. Also while paused or stopped:
 * the round and turn are kept then (fights can span sessions), so the display still shows them.
 */
export function currentEntry(entries: InitiativeEntry[], state: CombatStateRow): InitiativeEntry | null {
  const active = entries.filter((e) => e.isActive);
  return active[state.currentTurnIndex] ?? null;
}

/**
 * Runs a change to the initiative list and moves currentTurnIndex so the combatant who had
 * the turn still has it. If that combatant was removed or deactivated, the turn passes to
 * whoever now sits in their place in the order.
 */
export async function preserveTurn<T>(change: () => Promise<T>): Promise<T> {
  const state = await getCombatState();
  const beforeActive = (await getEntries()).filter((e) => e.isActive);
  const current = beforeActive[state.currentTurnIndex];

  const result = await change();
  if (state.status === 'stopped' || !current) return result;

  const afterActive = (await getEntries()).filter((e) => e.isActive);
  let index = afterActive.findIndex((e) => e.id === current.id);
  if (index === -1) {
    // Current combatant is gone: the next one still in the fight (by the old order) takes over.
    const next = beforeActive.slice(state.currentTurnIndex + 1).find((e) => afterActive.some((a) => a.id === e.id));
    index = next ? afterActive.findIndex((e) => e.id === next.id) : 0;
  }
  if (index !== state.currentTurnIndex) await setCombatState({ currentTurnIndex: Math.max(0, index) });
  return result;
}

export type TurnAction = 'start' | 'next' | 'prev' | 'new-fight';

/** Moves the turn on the server so two open screens can't compute different turns. */
export async function advanceTurn(action: TurnAction): Promise<CombatStateRow | { error: string }> {
  const active = (await getEntries()).filter((e) => e.isActive);
  if (active.length === 0) return { error: 'No active combatants in the initiative tracker' };

  const state = await getCombatState();
  // Starting never touches the round: a fight can span sessions, so Start always carries on
  // where it was paused or stopped. Only 'new-fight' (the DM's explicit button) goes to round 1.
  if (action === 'start') {
    return setCombatState({ status: 'active', currentTurnIndex: Math.min(state.currentTurnIndex, active.length - 1) });
  }
  if (action === 'new-fight') {
    return setCombatState({ status: 'active', currentRound: 1, currentTurnIndex: 0 });
  }

  let index = Math.min(state.currentTurnIndex, active.length - 1);
  let round = state.currentRound;
  if (action === 'next') {
    index += 1;
    if (index >= active.length) { index = 0; round += 1; }
  } else {
    index -= 1;
    if (index < 0) {
      if (round > 1) { index = active.length - 1; round -= 1; } else { index = 0; }
    }
  }
  return setCombatState({ status: 'active', currentTurnIndex: index, currentRound: round });
}

// ── What players may see ──────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'injured' | 'hurt' | 'bloodied' | 'unconscious' | 'dead' | null;

/** Health band shown instead of exact HP (see docs/DM-Tools.md). */
export function healthStatus(entry: Pick<InitiativeEntry, 'hp' | 'maxHp' | 'type'>): HealthStatus {
  if (entry.hp == null || entry.maxHp == null || entry.maxHp <= 0) return null;
  if (entry.hp <= 0) return entry.type === 'character' ? 'unconscious' : 'dead';
  const pct = (entry.hp / entry.maxHp) * 100;
  if (pct > 75) return 'healthy';
  if (pct > 50) return 'injured';
  if (pct > 25) return 'hurt';
  return 'bloodied';
}

export interface OwnedCharacters { ids: Set<string>; names: Set<string> }

/** Characters a user plays (Character.userId, or the legacy User.characterIds list). */
export async function ownedCharacters(userId: string | null | undefined): Promise<OwnedCharacters> {
  const owned: OwnedCharacters = { ids: new Set(), names: new Set() };
  if (!userId) return owned;
  const characters = await db.select({ id: Character.id, name: Character.name, userId: Character.userId }).from(Character);
  const user = await db.select().from(User).where(eq(User.id, userId)).get();
  const legacy = new Set(user?.characterIds ?? []);
  for (const c of characters) {
    if (c.userId ? c.userId === userId : legacy.has(c.id)) {
      owned.ids.add(c.id);
      owned.names.add(c.name);
    }
  }
  return owned;
}

/** Entries made before characterId existed are matched by name. */
export function isOwnEntry(entry: InitiativeEntry, owned: OwnedCharacters): boolean {
  if (entry.type !== 'character') return false;
  return entry.characterId ? owned.ids.has(entry.characterId) : owned.names.has(entry.name);
}

/**
 * The entry as someone without DM rights sees it: name, order and health band, plus exact
 * HP and death saves only for their own characters. AC and DM notes are never included.
 */
export function redactEntry(entry: InitiativeEntry, owned: OwnedCharacters) {
  const own = isOwnEntry(entry, owned);
  return {
    id: entry.id,
    name: entry.name,
    initiative: entry.initiative,
    type: entry.type,
    characterId: entry.characterId,
    isActive: entry.isActive,
    health: healthStatus(entry),
    hp: own ? entry.hp : null,
    maxHp: own ? entry.maxHp : null,
    tempHp: own ? entry.tempHp : null,
    deathSaveSuccesses: own || entry.hp === 0 ? entry.deathSaveSuccesses : 0,
    deathSaveFailures: own || entry.hp === 0 ? entry.deathSaveFailures : 0,
    isStable: entry.isStable,
    isOwn: own,
  };
}
