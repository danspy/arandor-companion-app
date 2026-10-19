// The combatant panel at the right edge (initiative tracker, DM screen; DM only): quick edit of
// one combatant (initiative, HP, AC, notes, in combat, conditions), damage/heal, its stat block
// if it has one (or a way to link one), so the fight stays in view. Every change is saved as
// soon as a field is left, through PATCH /api/initiative/[id], and announced as
// COMBATANT_CHANGED_EVENT so the page can update. A stat block can also be shown on its own.

import { renderStatBlock } from './statblock-view';
import { formatHp, hpControlHtml, wireHpControls, HP_CHANGED_EVENT, type HpEntry } from './hp-control';
import { CONDITIONS, EFFECTS, MAX_EXHAUSTION, TAG_LIMITS, exhaustionLevel, tagKind } from './conditions';
import type { CreatureData } from './statblock';

export const COMBATANT_CHANGED_EVENT = 'arandor:combatant-changed';
export const PANEL_CLOSED_EVENT = 'arandor:combatant-panel-closed';

export interface Combatant extends HpEntry {
  name: string;
  type: string;
  initiative: number;
  ac: number | null;
  notes: string | null;
  isActive: boolean;
  conditions: string[];
  creatureId: string | null;
}

let panel: HTMLElement | null = null;
let current: string | null = null;

// A page change (ClientRouter) replaces the body and with it the panel
document.addEventListener('astro:before-swap', () => {
  document.documentElement.classList.remove('sb-panel-open');
  current = null;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !(e.target as HTMLElement).closest?.('input, textarea, select')) closeStatBlock();
});

function ensurePanel(): HTMLElement {
  if (panel && document.body.contains(panel)) return panel;
  panel = document.createElement('aside');
  panel.className = 'sb-panel';
  panel.setAttribute('aria-label', 'Combatant');
  panel.setAttribute('aria-hidden', 'true');
  document.body.append(panel);
  return panel;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** The combatant whose panel is open (an initiative entry id), if any. */
export const openCombatantId = () => (current && !current.startsWith('creature:') && panel?.classList.contains('is-open') ? current : null);

export function closeStatBlock() {
  if (!panel) return;
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('sb-panel-open');
  current = null;
  window.dispatchEvent(new CustomEvent(PANEL_CLOSED_EVENT));
}

function show(p: HTMLElement, key: string) {
  current = key;
  p.replaceChildren(document.createTextNode('Loading…'));
  p.classList.add('is-open');
  p.setAttribute('aria-hidden', 'false');
  // Wide screens make room for it (see statblock.css), so the fight stays in view
  document.documentElement.classList.add('sb-panel-open');
}

function bar(title: string, creatureId: string | null) {
  const b = el('div', 'sb-panel-bar');
  b.append(el('span', 'sb-panel-who', title));
  const links = el('div', 'flex items-center gap-3');
  if (creatureId) {
    const open = el('a', 't-link text-sm', 'Open');
    open.href = `/tools/bestiary/${encodeURIComponent(creatureId)}`;
    open.title = 'Open the stat block page';
    links.append(open);
  }
  const close = el('button', 't-icon-btn', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the panel');
  close.addEventListener('click', closeStatBlock);
  links.append(close);
  b.append(links);
  return b;
}

/** A combatant's panel: open it, or close it when it is already open for them. */
export async function toggleCombatant(entryId: string) {
  const p = ensurePanel();
  if (current === entryId && p.classList.contains('is-open')) return closeStatBlock();
  await openCombatant(entryId);
}

export async function openCombatant(entryId: string) {
  const p = ensurePanel();
  show(p, entryId);
  try {
    const res = await fetch(`/api/initiative/${encodeURIComponent(entryId)}`, { cache: 'no-store' });
    if (current !== entryId) return;
    if (!res.ok) throw new Error(res.status === 404 ? 'This combatant is no longer in the fight.' : 'Could not load the combatant.');
    const entry = (await res.json()) as Combatant;
    let creature: (CreatureData & { id: string }) | null = null;
    if (entry.creatureId) {
      const cr = await fetch(`/api/creatures/${encodeURIComponent(entry.creatureId)}`, { cache: 'no-store' });
      if (cr.ok) creature = await cr.json();
    }
    if (current !== entryId) return;
    p.replaceChildren(bar(entry.name, creature?.id ?? null), quickEdit(entry, !!creature));
    if (creature) p.append(renderStatBlock(creature, { rollerName: entry.name, showNotes: true }));
  } catch (err) {
    p.replaceChildren(bar('', null), document.createTextNode(err instanceof Error ? err.message : 'Could not load the combatant.'));
  }
}

/** Kept for callers that only know the stat block (and maybe the combatant). */
export async function toggleStatBlock(creatureId: string, combatantName: string, entryId?: string) {
  if (entryId) return toggleCombatant(entryId);
  const p = ensurePanel();
  const key = `creature:${creatureId}`;
  if (current === key && p.classList.contains('is-open')) return closeStatBlock();
  show(p, key);
  const res = await fetch(`/api/creatures/${encodeURIComponent(creatureId)}`, { cache: 'no-store' });
  if (current !== key) return;
  if (!res.ok) return p.replaceChildren(bar('', null), document.createTextNode('Could not load the stat block.'));
  p.replaceChildren(bar('Stat block', creatureId), renderStatBlock(await res.json(), { rollerName: combatantName, showNotes: true }));
}

// ── Quick edit ──────────────────────────────────────────────────────────────

function quickEdit(entry: Combatant, hasCreature: boolean): HTMLElement {
  wireHpControls();
  const box = el('section', 'cp-edit');
  box.setAttribute('aria-label', `Quick edit: ${entry.name}`);
  const status = el('p', 'cp-status text-xs', '');
  status.setAttribute('role', 'status');

  async function save(change: Partial<Combatant>) {
    status.textContent = 'Saving…';
    status.dataset.state = '';
    try {
      const res = await fetch(`/api/initiative/${encodeURIComponent(entry.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not save');
      Object.assign(entry, body);
      status.textContent = 'Saved';
      status.dataset.state = 'ok';
      document.querySelectorAll<HTMLElement>(`[data-hp-of="${CSS.escape(entry.id)}"]`).forEach((h) => (h.textContent = formatHp(entry)));
      window.dispatchEvent(new CustomEvent(COMBATANT_CHANGED_EVENT, { detail: { entry: body, changed: Object.keys(change) } }));
      return true;
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : 'Could not save';
      status.dataset.state = 'error';
      return false;
    }
  }

  const number = (label: string, key: 'initiative' | 'ac' | 'hp' | 'maxHp' | 'tempHp', nullable = true) => {
    const wrap = el('label', 'cp-field');
    const input = el('input', 't-input cp-input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.value = entry[key] === null ? '' : String(entry[key]);
    input.dataset.field = key;
    input.addEventListener('change', async () => {
      const v = input.value.trim();
      if (v === '' && !nullable) {
        input.value = String(entry[key]);
        return;
      }
      if (!(await save({ [key]: v === '' ? null : Number(v) }))) input.value = entry[key] === null ? '' : String(entry[key]);
    });
    wrap.append(el('span', 't-label', label), input);
    return wrap;
  };

  const grid = el('div', 'cp-grid');
  grid.append(number('Initiative', 'initiative', false), number('AC', 'ac'), number('HP', 'hp'), number('Max HP', 'maxHp'), number('Temp HP', 'tempHp'));
  const active = el('label', 'cp-check');
  const activeBox = el('input');
  activeBox.type = 'checkbox';
  activeBox.checked = entry.isActive;
  activeBox.addEventListener('change', () => save({ isActive: activeBox.checked }));
  active.append(activeBox, document.createTextNode(' In combat'));
  grid.append(active);

  // Damage / heal (the HP field above follows)
  const hp = el('div', 'sb-panel-hp');
  hp.innerHTML = `<span class="t-label">HP</span> <b></b> ${entry.hp !== null ? hpControlHtml(entry.id, entry.name) : ''}`;
  const hpValue = hp.querySelector('b')!;
  hpValue.dataset.hpOf = entry.id;
  hpValue.textContent = formatHp(entry);
  const onHp = (e: Event) => {
    const changed = (e as CustomEvent<{ entry: HpEntry }>).detail.entry;
    if (changed.id !== entry.id) return;
    if (!document.body.contains(box)) return window.removeEventListener(HP_CHANGED_EVENT, onHp);
    Object.assign(entry, changed);
    for (const k of ['hp', 'tempHp'] as const) {
      const input = grid.querySelector<HTMLInputElement>(`[data-field="${k}"]`)!;
      if (document.activeElement !== input) input.value = entry[k] === null ? '' : String(entry[k]);
    }
  };
  window.addEventListener(HP_CHANGED_EVENT, onHp);

  // Conditions and effects: toggle chips, Exhaustion with its level, and the DM's own tags
  const conditions = el('div', 'cp-tags');
  const toggle = async (tag: string) => {
    const next = entry.conditions.includes(tag) ? entry.conditions.filter((x) => x !== tag) : [...entry.conditions, tag];
    if (await save({ conditions: next })) renderConditions();
  };
  const chipGroup = (label: string, tags: readonly string[], kind: string) => {
    const group = el('div', 'cp-conditions');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    for (const tag of tags) {
      const b = el('button', `cp-chip is-${kind}`, tag);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(entry.conditions.includes(tag)));
      b.addEventListener('click', () => toggle(tag));
      group.append(b);
    }
    return group;
  };
  const renderConditions = () => {
    const official = chipGroup('Conditions', CONDITIONS, 'condition');
    const exhaustion = el('label', 'cp-exhaustion');
    const select = el('select', 't-input');
    for (let i = 0; i <= MAX_EXHAUSTION; i++) {
      const o = el('option', '', i ? String(i) : '–');
      o.value = String(i);
      select.append(o);
    }
    select.value = String(exhaustionLevel(entry.conditions));
    select.addEventListener('change', async () => {
      const level = Number(select.value);
      const next = [...entry.conditions.filter((c) => !/^Exhaustion /.test(c)), ...(level ? [`Exhaustion ${level}`] : [])];
      if (await save({ conditions: next })) renderConditions();
    });
    exhaustion.append(document.createTextNode('Exhaustion '), select);
    official.append(exhaustion);

    // Own tags: shown with ×, plus a field to add one
    const own = el('div', 'cp-conditions');
    own.setAttribute('role', 'group');
    own.setAttribute('aria-label', 'Own tags');
    for (const tag of entry.conditions.filter((t) => tagKind(t) === 'custom')) {
      const b = el('button', 'cp-chip is-custom', `${tag} ✕`);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'true');
      b.setAttribute('aria-label', `Remove ${tag}`);
      b.addEventListener('click', () => toggle(tag));
      own.append(b);
    }
    const add = el('input', 't-input cp-own');
    add.placeholder = 'Add your own, e.g. Cursed';
    add.maxLength = TAG_LIMITS.length;
    add.setAttribute('aria-label', 'Add your own tag');
    add.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const tag = add.value.trim();
      if (!tag || entry.conditions.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
      if (await save({ conditions: [...entry.conditions, tag] })) {
        renderConditions();
        conditions.querySelector<HTMLInputElement>('.cp-own')?.focus();
      }
    });
    own.append(add);

    conditions.replaceChildren(
      el('p', 't-label cp-heading', 'Conditions'), official,
      el('p', 't-label cp-heading', 'Spells and effects'), chipGroup('Spells and effects', EFFECTS, 'effect'),
      el('p', 't-label cp-heading', 'Own tags'), own,
    );
  };
  renderConditions();

  const notesWrap = el('label', 'cp-field cp-notes');
  const notes = el('textarea', 't-input cp-input');
  notes.rows = 2;
  notes.value = entry.notes ?? '';
  notes.addEventListener('change', () => save({ notes: notes.value }));
  notesWrap.append(el('span', 't-label', 'DM notes'), notes);

  box.append(grid, hp, conditions, notesWrap);

  // No stat block yet: pick one from the bestiary
  if (!hasCreature) {
    const link = el('div', 'cp-link');
    const select = el('select', 't-input');
    select.setAttribute('aria-label', 'Stat block from the bestiary');
    select.append(Object.assign(el('option', '', 'Link a stat block from the bestiary…'), { value: '' }));
    const button = el('button', 't-btn-secondary text-sm', 'Link');
    button.type = 'button';
    button.disabled = true;
    select.addEventListener('change', () => (button.disabled = !select.value));
    button.addEventListener('click', async () => {
      if (select.value && (await save({ creatureId: select.value }))) void openCombatant(entry.id);
    });
    link.append(select, button);
    box.append(link);
    fetch('/api/creatures', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: string; name: string; cr: string | null }[]) => {
        for (const c of list) select.append(Object.assign(el('option', '', `${c.name}${c.cr ? ` (CR ${c.cr})` : ''}`), { value: c.id }));
        if (!list.length) select.options[0].textContent = 'No stat blocks in the bestiary yet';
      })
      .catch(() => {});
  }
  box.append(status);
  return box;
}
