// Conditions a combatant can have (2024 rules), plus Concentration, which the table also tracks.
// Stored per initiative entry as a list of names; Exhaustion carries its level ("Exhaustion 2").
// Pure.

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed',
  'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Concentration',
] as const;
export const MAX_EXHAUSTION = 6;

const EXHAUSTION = /^Exhaustion ([1-6])$/;

/** A clean, ordered list: known conditions only, at most one Exhaustion level. */
export function cleanConditions(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) return null;
  const set = new Set(value as string[]);
  const out: string[] = CONDITIONS.filter((c) => set.has(c));
  const exhaustion = Math.max(0, ...[...set].map((v) => Number(v.match(EXHAUSTION)?.[1] ?? 0)));
  if (exhaustion) out.push(`Exhaustion ${exhaustion}`);
  if ([...set].some((v) => !(CONDITIONS as readonly string[]).includes(v) && !EXHAUSTION.test(v))) return null;
  return out;
}

export const exhaustionLevel = (conditions: string[]) => Number(conditions.find((c) => EXHAUSTION.test(c))?.match(EXHAUSTION)![1] ?? 0);
