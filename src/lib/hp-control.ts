// Damage / heal field for a combatant ("7" then − or +), used by the initiative tracker, the DM
// screen's turn preview and the stat block panel. One delegated handler serves every field on
// the page; after a change it announces the updated entry (HP_CHANGED_EVENT) so each place can
// update what it shows, and every element marked data-hp-of="<entry id>" gets the new HP.
// The DM screen spotlight uses the same field for NPCs outside the fight (/api/npcs/[id]/hp).

export const HP_CHANGED_EVENT = 'arandor:hp-changed';

export interface HpEntry {
  id: string;
  hp: number | null;
  maxHp: number | null;
  tempHp: number | null;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The field as HTML (for places that render with innerHTML). Changes go to `endpoint`. */
export function hpControlHtml(entryId: string, name: string, endpoint = `/api/initiative/${encodeURIComponent(entryId)}/hp`): string {
  const n = escape(name);
  return `<span class="hp-change inline-flex items-center gap-1" data-entry-id="${escape(entryId)}" data-endpoint="${escape(endpoint)}">` +
    `<input type="number" min="0" max="10000" inputmode="numeric" class="t-input hp-amount" placeholder="0" aria-label="Damage or healing for ${n}" />` +
    `<button type="button" class="t-icon-btn hp-change-btn" data-kind="damage" title="Damage ${n} (Enter)" aria-label="Damage ${n}">−</button>` +
    `<button type="button" class="t-icon-btn hp-change-btn" data-kind="heal" title="Heal ${n}" aria-label="Heal ${n}">+</button>` +
    `</span>`;
}

/** "7/10 (+3)" */
export function formatHp(e: HpEntry): string {
  if (e.hp === null) return '–';
  return `${e.hp}${e.maxHp !== null ? `/${e.maxHp}` : ''}${e.tempHp ? ` (+${e.tempHp})` : ''}`;
}

async function change(box: HTMLElement, kind: 'damage' | 'heal') {
  const input = box.querySelector<HTMLInputElement>('.hp-amount')!;
  const amount = parseInt(input.value, 10);
  if (!Number.isInteger(amount) || amount <= 0) {
    input.focus();
    return;
  }
  const buttons = box.querySelectorAll('button');
  buttons.forEach((b) => (b.disabled = true));
  try {
    const res = await fetch(box.dataset.endpoint ?? `/api/initiative/${box.dataset.entryId}/hp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, amount }) });
    const entry = await res.json();
    if (!res.ok) throw new Error(entry.error ?? 'Could not change HP');
    input.value = '';
    document.querySelectorAll<HTMLElement>(`[data-hp-of="${CSS.escape(entry.id)}"]`).forEach((el) => {
      el.textContent = formatHp(entry);
      el.classList.remove('hp-flash-damage', 'hp-flash-heal');
      void el.offsetWidth;
      el.classList.add(kind === 'damage' ? 'hp-flash-damage' : 'hp-flash-heal');
    });
    window.dispatchEvent(new CustomEvent(HP_CHANGED_EVENT, { detail: { entry, kind } }));
  } catch (err) {
    void window.arandorConfirm?.(err instanceof Error ? err.message : 'Could not change HP', { confirmLabel: 'OK' });
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

let wired = false;
/** Makes every .hp-change field on the page work (call once; survives redraws). */
export function wireHpControls() {
  if (wired) return;
  wired = true;
  document.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.hp-change-btn');
    if (button) void change(button.closest<HTMLElement>('.hp-change')!, button.dataset.kind as 'damage' | 'heal');
  });
  document.addEventListener('keydown', (e) => {
    const input = (e.target as HTMLElement).closest?.('.hp-amount');
    if (input && e.key === 'Enter') {
      e.preventDefault();
      void change(input.closest<HTMLElement>('.hp-change')!, 'damage');
    }
  });
}
