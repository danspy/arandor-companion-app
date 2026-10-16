// Shared dice engine for the floating dice button and the dice roller page.
// One DiceBox instance renders into a full-viewport overlay (#dice-overlay),
// so dice tumble over the whole page wherever the roll was started.

export const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
export type DieType = (typeof DIE_TYPES)[number];
export type DiceSelection = Partial<Record<DieType, number>>;
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface DieResult {
  sides: number;
  value: number;
  dropped?: boolean;
}

export interface RollRecord {
  formula: string;
  dice: DieResult[];
  modifier: number;
  total: number;
  mode: RollMode;
  crit: 'success' | 'fail' | null;
  timestamp: number;
}

export const ROLL_EVENT = 'arandor:dice-roll';
export const HISTORY_CLEARED_EVENT = 'arandor:dice-history-cleared';

const HISTORY_KEY = 'arandor-dice-history';
const HISTORY_LIMIT = 20;
const OVERLAY_ID = 'dice-overlay';
const SETTLE_TIMEOUT_MS = 10000;
const LINGER_MS = 3500;

const DICE_COLORS: Record<DieType, string> = {
  d4: '#8b4545',
  d6: '#8b4545',
  d8: '#8b4545',
  d10: '#8b4545',
  d12: '#8b4545',
  d20: '#d97706',
  d100: '#475569',
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

async function physicalRoll(selection: DiceSelection): Promise<DieResult[]> {
  if (prefersReducedMotion()) return fallbackRoll(selection);

  const box = await getDiceBox();
  if (!box) return fallbackRoll(selection);

  const overlay = getOverlay();
  if (hideTimer) clearTimeout(hideTimer);
  overlay.classList.add('is-rolling');
  overlay.style.opacity = '1';
  box.resizeWorld();
  await box.clear();

  const notation = DIE_TYPES.filter((d) => (selection[d] ?? 0) > 0).map((d) => ({
    qty: selection[d],
    sides: d === 'd100' ? 'd100' : parseInt(d.slice(1)),
    themeColor: DICE_COLORS[d],
  }));

  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), SETTLE_TIMEOUT_MS));
  try {
    const raw = await Promise.race([box.roll(notation), timeout]);
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
