// Roll buttons on the character page: <button class="cs-roll" data-roll="1d20+5" data-roll-name="Stealth">.
// An attack button also carries data-roll-damage (rolled with the hit, critical hits double it).
// Advantage/disadvantage ([data-roll-mode]) applies to the next d20 roll, then falls back to Normal,
// like the bestiary stat block. Delegated and bound once, so it survives ClientRouter page swaps.
import { rollParts, type RollMode } from './dice';
import type { RollPart } from './dice-notation';

let wired = false;
let mode: RollMode = 'normal';

function setMode(m: RollMode) {
  mode = m;
  document.querySelectorAll<HTMLElement>('[data-roll-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rollMode === m)));
}

/** The d20 expression for a bonus: 1d20+5, 1d20-1, 1d20. */
export const d20 = (bonus: number) => (bonus === 0 ? '1d20' : `1d20${bonus > 0 ? '+' : ''}${bonus}`);

/** +5 / −1 / +0 for display. */
export const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

export function wireCharacterRolls() {
  if (wired) return;
  wired = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const modeButton = target.closest<HTMLElement>('[data-roll-mode]');
    if (modeButton) return setMode(modeButton.dataset.rollMode as RollMode);
    const button = target.closest<HTMLElement>('.cs-roll');
    if (!button?.dataset.roll) return;
    const who = document.getElementById('character-page')?.dataset.characterName || 'Character';
    const what = button.dataset.rollName || '';
    const parts: RollPart[] = [{ label: button.dataset.rollLabel || what, expr: button.dataset.roll }];
    if (button.dataset.rollDamage) parts.push({ label: button.dataset.rollDamageLabel || 'Damage', expr: button.dataset.rollDamage });
    const isD20 = button.dataset.roll.startsWith('1d20');
    const m = isD20 ? mode : 'normal';
    if (isD20) setMode('normal');
    void rollParts(parts, { mode: m, name: `${who} · ${what}` });
  });
  // A fresh page starts at Normal
  document.addEventListener('astro:page-load', () => setMode('normal'));
}
