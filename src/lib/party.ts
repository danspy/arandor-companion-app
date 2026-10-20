// The DM screen's party panel: the whole active party's numbers in one table
// (src/components/PartyPanel.astro). Everything comes from the stored D&D Beyond sheet.
import { ABILITY_KEYS, type Ability, type CharacterSheet } from './character-sheet';

type Passive = 'perception' | 'investigation' | 'insight';

export interface PartyRow {
  id: string;
  name: string;
  hp: number | null;
  maxHp: number | null;
  tempHp: number | null;
  ac: number | null; // null: no D&D Beyond sheet
  initiative: number | null;
  speed: number | null;
  passives: Record<Passive, number> | null;
  saves: Record<Ability, number> | null;
  best: Record<Passive, boolean>; // the party's highest in that column (ties all count)
}

interface PartyCharacter {
  id: string;
  name: string;
  isActive: boolean;
  hp: number | null;
  maxHp: number | null;
  tempHp: number | null;
  sheet: unknown;
}

const PASSIVES: Passive[] = ['perception', 'investigation', 'insight'];

export function partyOverview(characters: PartyCharacter[]): PartyRow[] {
  const rows = characters.filter((c) => c.isActive).sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
    const sheet = (c.sheet as CharacterSheet | null) ?? null;
    return {
      id: c.id,
      name: c.name,
      hp: c.hp,
      maxHp: c.maxHp,
      tempHp: c.tempHp,
      ac: sheet?.ac ?? null,
      initiative: sheet?.initiative ?? null,
      speed: sheet?.speed ?? null,
      passives: sheet ? { perception: sheet.passivePerception, investigation: sheet.passiveInvestigation, insight: sheet.passiveInsight } : null,
      saves: sheet ? Object.fromEntries(ABILITY_KEYS.map((a) => [a, sheet.saves[a].bonus])) as Record<Ability, number> : null,
      best: { perception: false, investigation: false, insight: false },
    };
  });
  for (const p of PASSIVES) {
    const top = Math.max(...rows.map((r) => r.passives?.[p] ?? -Infinity));
    for (const r of rows) r.best[p] = r.passives != null && r.passives[p] === top;
  }
  return rows;
}
