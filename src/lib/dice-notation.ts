// Written dice rolls ("1d20+5", "2d6 + 1d4 + 3", German "1W20+5") and saved roll presets.
// Pure functions, used by the dice engine in the browser and by the presets API on the server.

export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_DICE = 50; // per roll part

export interface DiceTerm {
  count: number;
  sides: number;
  sign: 1 | -1;
}

export interface ParsedRoll {
  dice: DiceTerm[];
  modifier: number;
}

export type ParseResult = { ok: true; roll: ParsedRoll } | { ok: false; error: string };

const TERM = /([+-])?(?:(\d*)[dw](\d+)|(\d+))/y;

export function parseRoll(input: string): ParseResult {
  // "1d20 5" would otherwise run together into "1d205"
  if (/[\dw]\s+\d/i.test(input)) return { ok: false, error: 'Put a + or − between the parts, e.g. 1d20+5' };
  const text = input.replace(/\s+/g, '').toLowerCase();
  if (!text) return { ok: false, error: 'Enter a roll, e.g. 1d20+5' };

  const roll: ParsedRoll = { dice: [], modifier: 0 };
  let pos = 0;
  while (pos < text.length) {
    TERM.lastIndex = pos;
    const m = TERM.exec(text);
    // Every term after the first needs its + or −
    if (!m || (pos > 0 && !m[1])) return { ok: false, error: `Can't read "${text.slice(pos)}"` };
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3] !== undefined) {
      const count = m[2] ? parseInt(m[2], 10) : 1;
      const sides = parseInt(m[3], 10);
      if (!(DICE_SIDES as readonly number[]).includes(sides)) return { ok: false, error: `There is no d${sides} (use d4, d6, d8, d10, d12, d20 or d100)` };
      if (count < 1) return { ok: false, error: 'Roll at least one die' };
      roll.dice.push({ count, sides, sign });
    } else {
      roll.modifier += sign * parseInt(m[4], 10);
    }
    pos = TERM.lastIndex;
  }

  const total = roll.dice.reduce((n, d) => n + d.count, 0);
  if (total === 0) return { ok: false, error: 'Add at least one die, e.g. 1d20' };
  if (total > MAX_DICE) return { ok: false, error: `At most ${MAX_DICE} dice per roll` };
  if (Math.abs(roll.modifier) > 999) return { ok: false, error: 'The bonus is too large' };
  return { ok: true, roll };
}

/** Canonical form: "1d20+5", "2d6+1d4-1". */
export function formatRoll(roll: ParsedRoll): string {
  let out = '';
  roll.dice.forEach((d, i) => {
    if (i > 0 || d.sign < 0) out += d.sign < 0 ? '-' : '+';
    out += `${d.count}d${d.sides}`;
  });
  if (roll.modifier) out += roll.modifier > 0 ? `+${roll.modifier}` : `${roll.modifier}`;
  return out;
}

/** A lone d20 (plus bonus): the part advantage, disadvantage and critical hits apply to. */
export function isD20Check(roll: ParsedRoll): boolean {
  return roll.dice.length === 1 && roll.dice[0].count === 1 && roll.dice[0].sides === 20 && roll.dice[0].sign === 1;
}

// ── Presets ────────────────────────────────────────────────────────────────

export interface RollPart {
  label: string; // e.g. "To hit", "Slashing"; may be empty
  expr: string; // e.g. "1d20+5"
}

export interface DicePreset {
  id: string;
  name: string;
  parts: RollPart[];
}

export const PRESET_LIMITS = { presets: 30, parts: 4, name: 40, label: 24, expr: 60 } as const;

/** Checks a whole preset list (as sent by a browser); expressions are stored in canonical form. */
export function validatePresets(value: unknown): { ok: true; presets: DicePreset[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: 'Presets must be a list' };
  if (value.length > PRESET_LIMITS.presets) return { ok: false, error: `At most ${PRESET_LIMITS.presets} presets` };
  const presets: DicePreset[] = [];
  const ids = new Set<string>();
  for (const [i, p] of value.entries()) {
    const where = `Preset ${i + 1}`;
    if (!p || typeof p !== 'object') return { ok: false, error: `${where} is not a preset` };
    const { id, name, parts } = p as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[\w-]{1,40}$/.test(id) || ids.has(id)) return { ok: false, error: `${where} has no valid id` };
    ids.add(id);
    if (typeof name !== 'string' || !name.trim()) return { ok: false, error: `${where} needs a name` };
    if (name.trim().length > PRESET_LIMITS.name) return { ok: false, error: `${where}: the name is too long` };
    if (!Array.isArray(parts) || parts.length < 1 || parts.length > PRESET_LIMITS.parts) {
      return { ok: false, error: `${where}: 1 to ${PRESET_LIMITS.parts} rolls` };
    }
    const clean: RollPart[] = [];
    for (const part of parts) {
      const { label, expr } = (part ?? {}) as Record<string, unknown>;
      if (typeof label !== 'string' || label.trim().length > PRESET_LIMITS.label) return { ok: false, error: `${where}: a label is too long` };
      if (typeof expr !== 'string' || expr.length > PRESET_LIMITS.expr) return { ok: false, error: `${where}: a roll is missing` };
      const parsed = parseRoll(expr);
      if (!parsed.ok) return { ok: false, error: `${where} (${name.trim()}): ${parsed.error}` };
      clean.push({ label: label.trim(), expr: formatRoll(parsed.roll) });
    }
    presets.push({ id, name: name.trim(), parts: clean });
  }
  return { ok: true, presets };
}
