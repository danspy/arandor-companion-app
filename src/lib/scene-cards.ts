// Server side: Scene rows as the cards the DM screen shows (resolved location and portraits).
import { db, Character, Location, NPC, Scene, inArray } from '@/db';
import { parseSpotlightKey } from './spotlight';
import { normalizeSetup, type SceneSetup } from './scenes';

type SceneRow = typeof Scene.$inferSelect;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function rowSetup(r: SceneRow): SceneSetup {
  return normalizeSetup({
    locationId: r.locationId ?? null,
    locationHidden: !!r.locationHidden,
    spotlightIds: strings(r.spotlightIds),
    hiddenIds: strings(r.hiddenIds),
    focusIds: strings(r.focusIds),
    npcsHidden: !!r.npcsHidden,
  });
}

export async function existenceSets(setup: SceneSetup) {
  const parsed = setup.spotlightIds.map(parseSpotlightKey);
  const npcIds = parsed.filter((p) => p.kind === 'npc').map((p) => p.id);
  const characterIds = parsed.filter((p) => p.kind === 'character').map((p) => p.id);
  const [npcs, characters, locations] = await Promise.all([
    npcIds.length ? db.select({ id: NPC.id }).from(NPC).where(inArray(NPC.id, npcIds)) : [],
    characterIds.length ? db.select({ id: Character.id }).from(Character).where(inArray(Character.id, characterIds)) : [],
    setup.locationId ? db.select({ id: Location.id }).from(Location).where(inArray(Location.id, [setup.locationId])) : [],
  ]);
  return {
    npcIds: new Set(npcs.map((r) => r.id)),
    characterIds: new Set(characters.map((r) => r.id)),
    locationIds: new Set(locations.map((r) => r.id)),
  };
}

export async function toCards(rows: SceneRow[]) {
  const setups = rows.map(rowSetup);
  const keys = [...new Set(setups.flatMap((s) => s.spotlightIds))].map((key) => ({ key, ...parseSpotlightKey(key) }));
  const npcIds = keys.filter((k) => k.kind === 'npc').map((k) => k.id);
  const characterIds = keys.filter((k) => k.kind === 'character').map((k) => k.id);
  const locationIds = [...new Set(setups.map((s) => s.locationId).filter((x): x is string => !!x))];
  const [npcs, characters, locations] = await Promise.all([
    npcIds.length ? db.select({ id: NPC.id, name: NPC.name, avatarUrl: NPC.avatarUrl }).from(NPC).where(inArray(NPC.id, npcIds)) : [],
    characterIds.length ? db.select({ id: Character.id, name: Character.name, avatarUrl: Character.avatarUrl }).from(Character).where(inArray(Character.id, characterIds)) : [],
    locationIds.length ? db.select({ id: Location.id, name: Location.name, imageUrl: Location.imageUrl }).from(Location).where(inArray(Location.id, locationIds)) : [],
  ]);
  return rows.map((r, i) => {
    const setup = setups[i];
    const location = setup.locationId ? locations.find((l) => l.id === setup.locationId) ?? null : null;
    return {
      id: r.id,
      name: r.name,
      sortOrder: r.sortOrder,
      setup,
      location,
      locationMissing: !!setup.locationId && !location,
      portraits: setup.spotlightIds.map((key) => {
        const p = parseSpotlightKey(key);
        const found = p.kind === 'character' ? characters.find((c) => c.id === p.id) : npcs.find((n) => n.id === p.id);
        return { key, name: found?.name ?? '', avatarUrl: found?.avatarUrl ?? null, missing: !found };
      }),
    };
  });
}

export const sceneValues = (setup: SceneSetup) => ({
  locationId: setup.locationId,
  locationHidden: setup.locationHidden,
  spotlightIds: setup.spotlightIds,
  hiddenIds: setup.hiddenIds,
  focusIds: setup.focusIds,
  npcsHidden: setup.npcsHidden,
});
