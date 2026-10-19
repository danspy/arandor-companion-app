// The DM screen's spotlight holds NPCs and party characters in one ordered list
// (DMScreenState.spotlightNpcIds, and hiddenNpcIds for the hidden ones). NPCs are stored by
// their id, characters as "character:<id>", so both kinds share one order and one set of
// hide/clear controls without a separate column.

export const CHARACTER_KEY_PREFIX = 'character:';

export const characterKey = (id: string) => `${CHARACTER_KEY_PREFIX}${id}`;

export function parseSpotlightKey(key: string): { kind: 'character' | 'npc'; id: string } {
  return key.startsWith(CHARACTER_KEY_PREFIX)
    ? { kind: 'character', id: key.slice(CHARACTER_KEY_PREFIX.length) }
    : { kind: 'npc', id: key };
}

// The one line under the name on a portrait
export const npcSubtitle = (npc: { occupation: string | null; race: string | null }) => npc.occupation || npc.race || '';
export const characterSubtitle = (c: { race: string; class: string }) => [c.race, c.class].filter(Boolean).join(' · ');
