// What a combatant is affected by, as tags (stored per initiative entry, everyone sees them):
// - the conditions of the 2024 rules (Exhaustion with its level: "Exhaustion 2"),
// - spells and effects tables track the same way (Hexed, Hunter's Mark, Blessed, …),
// - and the DM's own tags ("Cursed by Runara").
// Pure.

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed',
  'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
] as const;

export const EFFECTS = [
  'Concentration', 'Blessed', 'Baned', 'Hexed', "Hunter's Mark", 'Faerie Fire', 'Guiding Bolt', 'Hasted', 'Slowed',
  'Shield of Faith', 'Sanctuary', 'Raging', 'Dodging', 'Hidden', 'Inspired',
] as const;

export const MAX_EXHAUSTION = 6;
export const TAG_LIMITS = { length: 32, count: 20 } as const;

const EXHAUSTION = /^Exhaustion ([1-6])$/;
const known = new Set<string>([...CONDITIONS, ...EFFECTS]);

export type TagKind = 'condition' | 'effect' | 'custom';
/** For colouring: official conditions (incl. Exhaustion), spells/effects, or the DM's own tags. */
export function tagKind(tag: string): TagKind {
  if ((CONDITIONS as readonly string[]).includes(tag) || EXHAUSTION.test(tag)) return 'condition';
  return (EFFECTS as readonly string[]).includes(tag) ? 'effect' : 'custom';
}

/**
 * A clean, ordered list: conditions, then effects (both in list order), then Exhaustion (one
 * level), then own tags as given (trimmed, no duplicates). Null when the value can't be a list
 * of tags (not text, too long, too many).
 */
export function cleanConditions(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) return null;
  const tags = (value as string[]).map((v) => v.replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (tags.some((t) => t.length > TAG_LIMITS.length)) return null;
  const set = new Set(tags);
  const out: string[] = [...CONDITIONS.filter((c) => set.has(c)), ...EFFECTS.filter((c) => set.has(c))];
  const exhaustion = Math.max(0, ...tags.map((t) => Number(t.match(EXHAUSTION)?.[1] ?? 0)));
  if (exhaustion) out.push(`Exhaustion ${exhaustion}`);
  const seen = new Set(out.map((t) => t.toLowerCase()));
  for (const t of tags) {
    if (known.has(t) || EXHAUSTION.test(t) || /^exhaustion\b/i.test(t) || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.length > TAG_LIMITS.count ? null : out;
}

export const exhaustionLevel = (conditions: string[]) => Number(conditions.find((c) => EXHAUSTION.test(c))?.match(EXHAUSTION)![1] ?? 0);
