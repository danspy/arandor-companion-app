// "Add to initiative" from the bestiary: a dialog that adds one or more copies of a creature to
// the initiative tracker with its AC, average (or overridden) HP and a rolled initiative each.
// Used on the stat block page and in the tracker.

import { nextCopyNumbers } from './statblock';

export interface QuickAddCreature {
  id: string;
  name: string;
  ac: number | null;
  hp: number | null;
  hpFormula: string | null;
  initiative: number | null;
}

export interface QuickAddOptions {
  /** A named NPC that uses this stat block: one copy under the NPC's name, type NPC. */
  npcName?: string;
  /** That NPC's HP now (its own, else the stat block's): it joins with them and its conditions. */
  npcHp?: { hp: number | null; maxHp: number | null };
  onAdded?: (count: number) => void;
}

const d20 = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 20) + 1;
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function openQuickAdd(creature: QuickAddCreature, options: QuickAddOptions = {}) {
  const npc = options.npcName;
  const bonus = creature.initiative ?? 0;

  const overlay = el('div', 'qa-overlay');
  const panel = el('form', 't-modal-panel qa-panel');
  panel.noValidate = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', `Add ${npc ?? creature.name} to initiative`);

  const title = el('h2', 'qa-title', npc ? `Add ${npc} to initiative` : 'Add to initiative');
  const sub = el('p', 't-muted text-sm mb-4', npc ? `Uses the stat block "${creature.name}"` : creature.name);

  const field = (label: string, input: HTMLInputElement, hint?: string) => {
    const wrap = el('label', 'qa-field');
    wrap.append(el('span', 't-label', label), input);
    if (hint) wrap.append(el('span', 't-faint text-xs', hint));
    return wrap;
  };
  const input = (type: string, value: string, attrs: Record<string, string> = {}) => {
    const i = el('input', 't-input px-3 py-2');
    i.type = type;
    i.value = value;
    for (const [k, v] of Object.entries(attrs)) i.setAttribute(k, v);
    return i;
  };

  const nameInput = input('text', npc ?? creature.name, { maxlength: '60', 'aria-label': 'Name' });
  const countInput = input('number', '1', { min: '1', max: '20', 'aria-label': 'How many' });
  const npcHp = npc ? options.npcHp : undefined;
  const startHp = npcHp?.hp ?? creature.hp;
  const hpInput = input('number', startHp !== null ? String(startHp) : '', { min: '0', max: '10000', 'aria-label': 'HP each' });
  const hpHint = npcHp?.hp != null
    ? `${npc} has ${npcHp.hp}${npcHp.maxHp !== null ? `/${npcHp.maxHp}` : ''} now; change it to override`
    : creature.hp !== null ? `Average ${creature.hp}${creature.hpFormula ? ` (${creature.hpFormula})` : ''}; change it to override` : 'No HP in the stat block';

  const grid = el('div', 'qa-grid');
  grid.append(field('Name', nameInput));
  if (!npc) grid.append(field('How many', countInput));
  grid.append(field(npc ? 'HP' : 'HP each', hpInput, hpHint));

  // Initiative per copy: rolled, editable, "Reroll" rolls them all again
  const rollsHead = el('div', 'qa-rolls-head');
  const reroll = el('button', 't-link text-sm', 'Reroll');
  reroll.type = 'button';
  rollsHead.append(el('span', 't-label', `Initiative (d20 ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)})`), reroll);
  const rollsList = el('div', 'qa-rolls');
  const error = el('p', 'qa-error text-sm');
  error.hidden = true;

  const actions = el('div', 'flex flex-wrap gap-3 mt-5');
  const addButton = el('button', 't-btn-primary', 'Add');
  addButton.type = 'submit';
  const cancel = el('button', 't-btn-secondary', 'Cancel');
  cancel.type = 'button';
  actions.append(addButton, cancel);
  panel.append(title, sub, grid, rollsHead, rollsList, error, actions);
  overlay.append(panel);

  let existingNames: string[] = [];
  let rolls: number[] = [];
  const count = () => (npc ? 1 : Math.min(20, Math.max(1, parseInt(countInput.value, 10) || 1)));
  const names = () => (npc ? [nameInput.value.trim() || npc] : nextCopyNumbers(nameInput.value.trim() || creature.name, existingNames, count()));

  function renderRolls() {
    while (rolls.length < count()) rolls.push(d20() + bonus);
    rolls.length = count();
    const ns = names();
    rollsList.replaceChildren(
      ...ns.map((n, i) => {
        const row = el('label', 'qa-roll');
        const value = input('number', String(rolls[i]), { 'aria-label': `Initiative of ${n}` });
        value.addEventListener('input', () => (rolls[i] = parseInt(value.value, 10)));
        row.append(el('span', 'qa-roll-name', n), value);
        return row;
      })
    );
  }
  reroll.addEventListener('click', () => {
    rolls = [];
    renderRolls();
  });
  countInput.addEventListener('input', renderRolls);
  nameInput.addEventListener('input', renderRolls);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  cancel.addEventListener('click', close);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });

  panel.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hp = hpInput.value.trim() === '' ? null : parseInt(hpInput.value, 10);
    if (hp !== null && (!Number.isInteger(hp) || hp < 0)) return showError('HP must be a whole number');
    if (rolls.some((r) => !Number.isInteger(r))) return showError('Every initiative needs a number');
    // An NPC keeps its max HP (more HP than that raise it)
    const maxHp = hp !== null && npcHp?.maxHp != null ? Math.max(npcHp.maxHp, hp) : hp;
    addButton.disabled = true;
    const ns = names();
    try {
      for (const [i, name] of ns.entries()) {
        const res = await fetch('/api/initiative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, initiative: rolls[i], type: npc ? 'npc' : 'monster', hp, maxHp, ac: creature.ac, creatureId: creature.id, isActive: true }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Could not add ${name}`);
      }
      close();
      options.onAdded?.(ns.length);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not add');
      addButton.disabled = false;
    }
  });
  function showError(message: string) {
    error.textContent = message;
    error.hidden = false;
  }

  document.body.append(overlay);
  renderRolls();
  (npc ? hpInput : countInput).focus();
  // Number the copies after the ones already in the fight ("Goblin 5, 6" when 1–4 are there)
  fetch('/api/initiative', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : []))
    .then((entries: { name: string }[]) => {
      existingNames = entries.map((e) => e.name);
      renderRolls();
    })
    .catch(() => {});
}
