// Shared dice engine for the floating dice button and the dice roller page.
// One DiceBox instance renders into a full-viewport overlay (#dice-overlay),
// so dice tumble over the whole page wherever the roll was started.

import { formatRoll, isD20Check, parseRoll, type ParsedRoll, type RollPart } from './dice-notation';

export const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
export type DieType = (typeof DIE_TYPES)[number];
export type DiceSelection = Partial<Record<DieType, number>>;
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface DieResult {
  sides: number;
  value: number;
  dropped?: boolean;
  part?: number; // index into RollRecord.parts
  negative?: boolean; // subtracted ("1d20-1d4")
  bonus?: boolean; // extra damage die from a critical hit
}

/** One labelled part of a multi-part roll, e.g. "To hit 1d20+5" or "Slashing 1d8+3". */
export interface PartResult {
  label: string;
  formula: string;
  modifier: number;
  total: number;
  crit: 'success' | 'fail' | null;
}

export interface RollRecord {
  formula: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  mode: RollMode;
  crit: 'success' | 'fail' | null;
  timestamp: number;
  name?: string; // preset name
  parts?: PartResult[]; // written rolls and presets; total/modifier/crit above are the first part's
  critDoubled?: boolean; // a critical hit doubled the damage dice
}

export const ROLL_EVENT = 'arandor:dice-roll';
export const HISTORY_CLEARED_EVENT = 'arandor:dice-history-cleared';
/** Fired with the new list when the user's saved rolls change (detail: DicePreset[]). */
export const PRESETS_CHANGED_EVENT = 'arandor:dice-presets-changed';

const HISTORY_KEY = 'arandor-dice-history';
const HISTORY_LIMIT = 20;
const OVERLAY_ID = 'dice-overlay';
const SETTLE_TIMEOUT_MS = 10000;
const LINGER_MS = 3500;

// Theme bronze (--color-primary-*): bronze dice, a gold d20, dark leather d100.
const DICE_COLORS: Record<DieType, string> = {
  d4: '#8d5a18',
  d6: '#8d5a18',
  d8: '#8d5a18',
  d10: '#8d5a18',
  d12: '#8d5a18',
  d20: '#c99032',
  d100: '#4e3010',
};

// ── History (per browser) ──────────────────────────────────────────────────

export function getHistory(): RollRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as RollRecord[]) : [];
  } catch {
    return [];
  }
}

function pushHistory(record: RollRecord) {
  const history = [record, ...getHistory()].slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Private mode or storage full: history just isn't kept.
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(HISTORY_CLEARED_EVENT));
}

// ── Formatting ─────────────────────────────────────────────────────────────

export function formatModifier(modifier: number): string {
  if (modifier === 0) return '';
  return modifier > 0 ? `+${modifier}` : `${modifier}`;
}

export function formatSelection(selection: DiceSelection, modifier = 0, mode: RollMode = 'normal'): string {
  if (mode !== 'normal') {
    const label = mode === 'advantage' ? 'd20 (adv)' : 'd20 (dis)';
    return [label, formatModifier(modifier)].filter(Boolean).join(' ');
  }
  const parts = DIE_TYPES.filter((d) => (selection[d] ?? 0) > 0).map((d) => `${selection[d]}${d}`);
  if (parts.length === 0) return '';
  return [...parts, formatModifier(modifier)].filter(Boolean).join(' ');
}

export function diceCount(selection: DiceSelection): number {
  return DIE_TYPES.reduce((sum, d) => sum + (selection[d] ?? 0), 0);
}

// ── Overlay + DiceBox singleton ────────────────────────────────────────────

let diceBox: any = null;
let initPromise: Promise<any> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let rolling = false;

function getOverlay(): HTMLElement {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    // Pages that don't use the main layout still get an overlay.
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('aria-hidden', 'true');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '10005',
      opacity: '0',
      transition: 'opacity .4s ease',
    });
    document.body.appendChild(overlay);
  }
  return overlay;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function getDiceBox(): Promise<any> {
  if (diceBox) return diceBox;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        getOverlay();
        const { default: DiceBox } = await import('@3d-dice/dice-box');
        const box = new DiceBox({
          container: `#${OVERLAY_ID}`,
          assetPath: '/assets/dice-box/',
          theme: 'default',
          throwForce: 6,
          startingHeight: 8,
          spinForce: 5,
          lightIntensity: 0.9,
          gravity: 2,
          scale: window.innerWidth < 640 ? 7 : 5,
        });
        await box.init();
        diceBox = box;
        return box;
      } catch (e) {
        console.warn('DiceBox init failed, falling back to plain random rolls', e);
        return null;
      }
    })();
  }
  return initPromise;
}

function randomInt(sides: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % sides) + 1;
}

function fallbackRoll(selection: DiceSelection): DieResult[] {
  const results: DieResult[] = [];
  for (const die of DIE_TYPES) {
    const sides = parseInt(die.slice(1));
    for (let i = 0; i < (selection[die] ?? 0); i++) results.push({ sides, value: randomInt(sides) });
  }
  return results;
}

function normaliseResults(raw: any[]): DieResult[] {
  return raw.map((r) => {
    const sides = typeof r.sides === 'number' ? r.sides : parseInt(String(r.sides).replace(/\D/g, '')) || 0;
    let value = Number(r.value);
    if (sides === 100 && value === 0) value = 100;
    return { sides, value };
  });
}

// add: throw these dice onto the table without clearing it (bonus dice of a critical hit)
async function physicalRoll(selection: DiceSelection, add = false): Promise<DieResult[]> {
  if (prefersReducedMotion()) return fallbackRoll(selection);

  const box = await getDiceBox();
  if (!box) return fallbackRoll(selection);

  const overlay = getOverlay();
  if (hideTimer) clearTimeout(hideTimer);
  overlay.classList.add('is-rolling');
  overlay.style.opacity = '1';
  box.resizeWorld();
  if (!add) await box.clear();

  const notation = DIE_TYPES.filter((d) => (selection[d] ?? 0) > 0).map((d) => ({
    qty: selection[d],
    sides: d === 'd100' ? 'd100' : parseInt(d.slice(1)),
    themeColor: DICE_COLORS[d],
  }));

  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), SETTLE_TIMEOUT_MS));
  try {
    const raw = await Promise.race([add ? box.add(notation) : box.roll(notation), timeout]);
    return normaliseResults(raw);
  } catch {
    console.warn('DiceBox roll timed out, using fallback');
    return fallbackRoll(selection);
  } finally {
    hideTimer = setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.classList.remove('is-rolling');
      hideTimer = setTimeout(() => box.clear(), 450);
    }, LINGER_MS);
  }
}

/** Pre-load the 3D engine (e.g. when the dice panel opens) so the first roll is instant. */
export function warmUp() {
  if (!prefersReducedMotion()) void getDiceBox();
}

/** Take any dice still lying on the screen away now (no-op while a roll is in flight). */
export function clearTable() {
  if (rolling) return;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.classList.remove('is-rolling');
  }
  void diceBox?.clear();
}

export function isRolling() {
  return rolling;
}

/**
 * Roll dice over the whole page. Resolves with the result, or null if a roll
 * is already in progress. Every finished roll is stored in history and
 * broadcast as a ROLL_EVENT on window.
 */
export async function roll(
  selection: DiceSelection,
  modifier = 0,
  mode: RollMode = 'normal'
): Promise<RollRecord | null> {
  if (rolling) return null;
  const effective: DiceSelection = mode === 'normal' ? selection : { d20: 2 };
  if (diceCount(effective) === 0) return null;

  rolling = true;
  try {
    const dice = await physicalRoll(effective);

    let keptSum: number;
    let crit: RollRecord['crit'] = null;

    if (mode !== 'normal' && dice.length >= 2) {
      const [a, b] = dice;
      const keepFirst = mode === 'advantage' ? a.value >= b.value : a.value <= b.value;
      (keepFirst ? b : a).dropped = true;
      const kept = keepFirst ? a : b;
      keptSum = kept.value;
      if (kept.value === 20) crit = 'success';
      if (kept.value === 1) crit = 'fail';
    } else {
      keptSum = dice.reduce((s, d) => s + d.value, 0);
      if (dice.length === 1 && dice[0].sides === 20) {
        if (dice[0].value === 20) crit = 'success';
        if (dice[0].value === 1) crit = 'fail';
      }
    }

    const record: RollRecord = {
      formula: formatSelection(effective, modifier, mode),
      dice,
      modifier,
      total: keptSum + modifier,
      mode,
      crit,
      timestamp: Date.now(),
    };
    pushHistory(record);
    window.dispatchEvent(new CustomEvent<RollRecord>(ROLL_EVENT, { detail: record }));
    return record;
  } finally {
    rolling = false;
  }
}

// ── Written rolls and presets ──────────────────────────────────────────────

function addDice(selection: DiceSelection, roll: ParsedRoll, times = 1) {
  for (const d of roll.dice) {
    const die = `d${d.sides}` as DieType;
    selection[die] = (selection[die] ?? 0) + d.count * times;
  }
}

/** Hands thrown dice out to the terms that asked for them (dice of one type are interchangeable). */
function takeDice(pool: Map<number, DieResult[]>, sides: number, count: number): DieResult[] {
  return (pool.get(sides) ?? []).splice(0, count);
}

function poolOf(dice: DieResult[]): Map<number, DieResult[]> {
  const pool = new Map<number, DieResult[]>();
  for (const d of dice) pool.set(d.sides, [...(pool.get(d.sides) ?? []), d]);
  return pool;
}

/**
 * Roll one or more labelled parts in a single throw, e.g. a preset
 * [{ label: 'To hit', expr: '1d20+5' }, { label: 'Slashing', expr: '1d8+3' }] or a typed "3d6+2".
 * Advantage/disadvantage applies to the first part that is a lone d20 (the attack or check).
 * When that part rolls a natural 20, the dice of the parts after it are rolled a second time
 * and added (critical hit). Resolves with null if a roll is running or a part can't be read.
 */
export async function rollParts(
  parts: RollPart[],
  { mode = 'normal', name }: { mode?: RollMode; name?: string } = {}
): Promise<RollRecord | null> {
  if (rolling || parts.length === 0) return null;
  const parsed: ParsedRoll[] = [];
  for (const p of parts) {
    const r = parseRoll(p.expr);
    if (!r.ok) return null;
    parsed.push(r.roll);
  }
  const check = parsed.findIndex(isD20Check);
  const effectiveMode: RollMode = check >= 0 ? mode : 'normal';

  rolling = true;
  try {
    const selection: DiceSelection = {};
    parsed.forEach((r, i) => addDice(selection, r, i === check && effectiveMode !== 'normal' ? 2 : 1));
    const pool = poolOf(await physicalRoll(selection));

    const dice: DieResult[] = [];
    const results: PartResult[] = parsed.map((r, i) => {
      const mine: DieResult[] = [];
      for (const term of r.dice) {
        const n = i === check && effectiveMode !== 'normal' ? 2 : term.count;
        for (const d of takeDice(pool, term.sides, n)) mine.push({ ...d, part: i, negative: term.sign < 0 || undefined });
      }
      let crit: PartResult['crit'] = null;
      if (i === check) {
        if (mine.length === 2) {
          const [a, b] = mine;
          const keepFirst = effectiveMode === 'advantage' ? a.value >= b.value : a.value <= b.value;
          (keepFirst ? b : a).dropped = true;
        }
        const kept = mine.find((d) => !d.dropped)!;
        crit = kept.value === 20 ? 'success' : kept.value === 1 ? 'fail' : null;
      }
      dice.push(...mine);
      const sum = mine.filter((d) => !d.dropped).reduce((s, d) => s + (d.negative ? -d.value : d.value), 0);
      const formula = formatRoll(r) + (i === check && effectiveMode !== 'normal' ? (effectiveMode === 'advantage' ? ' (adv)' : ' (dis)') : '');
      return { label: parts[i].label, formula, modifier: r.modifier, total: sum + r.modifier, crit };
    });

    // Critical hit: the damage dice once more, thrown onto the table next to the first ones
    let critDoubled = false;
    if (check >= 0 && results[check].crit === 'success' && parsed.slice(check + 1).some((r) => r.dice.length)) {
      const extra: DiceSelection = {};
      parsed.slice(check + 1).forEach((r) => addDice(extra, r));
      const bonusPool = poolOf(await physicalRoll(extra, true));
      parsed.forEach((r, i) => {
        if (i <= check) return;
        for (const term of r.dice) {
          for (const d of takeDice(bonusPool, term.sides, term.count)) {
            dice.push({ ...d, part: i, negative: term.sign < 0 || undefined, bonus: true });
            results[i].total += term.sign < 0 ? -d.value : d.value;
          }
        }
      });
      critDoubled = true;
    }

    const first = results[0];
    const record: RollRecord = {
      formula: name ?? results.map((r) => r.formula).join(', '),
      dice,
      modifier: first.modifier,
      total: first.total,
      mode: effectiveMode,
      crit: check >= 0 ? results[check].crit : null,
      timestamp: Date.now(),
      name,
      parts: results,
      critDoubled: critDoubled || undefined,
    };
    pushHistory(record);
    window.dispatchEvent(new CustomEvent<RollRecord>(ROLL_EVENT, { detail: record }));
    return record;
  } finally {
    rolling = false;
  }
}
