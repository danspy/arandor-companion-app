// Damage and healing for initiative entries (used by /api/initiative/[id]/hp). Pure.

export interface HpChange {
  hp: number;
  tempHp: number;
  /** Healing from 0 HP ends dying: death saves start over. */
  resetDeathSaves: boolean;
}

/**
 * Damage takes temporary HP first, then HP, down to 0. Healing goes up to max HP (no max
 * known: no limit) and never adds temporary HP.
 */
export function applyHpChange(entry: { hp: number | null; maxHp: number | null; tempHp: number | null }, kind: 'damage' | 'heal', amount: number): HpChange {
  const hp = entry.hp ?? 0;
  const temp = entry.tempHp ?? 0;
  if (kind === 'damage') {
    const fromTemp = Math.min(temp, amount);
    return { hp: Math.max(0, hp - (amount - fromTemp)), tempHp: temp - fromTemp, resetDeathSaves: false };
  }
  const max = entry.maxHp ?? Infinity;
  return { hp: Math.min(Math.max(hp, 0) + amount, Math.max(max, hp)), tempHp: temp, resetDeathSaves: amount > 0 };
}
