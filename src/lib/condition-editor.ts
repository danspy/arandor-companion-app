// Editing what someone is affected by (lib/conditions.ts): toggle chips for the conditions and
// for spells and effects, Exhaustion with its level, and the DM's own tags. Used by the combatant
// panel (statblock-panel) and the NPCs in the DM screen spotlight; the caller saves.

import { CONDITIONS, EFFECTS, MAX_EXHAUSTION, TAG_LIMITS, exhaustionLevel, tagKind } from './conditions';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/**
 * The editor (redraws itself after each saved change). `current` gives the tags as they are now;
 * `save` stores a new list and resolves true when that worked.
 */
export function conditionEditor(current: () => string[], save: (next: string[]) => Promise<boolean>): HTMLElement {
  const conditions = el('div', 'cp-tags');
  const toggle = async (tag: string) => {
    const now = current();
    const next = now.includes(tag) ? now.filter((x) => x !== tag) : [...now, tag];
    if (await save(next)) render();
  };
  const chipGroup = (label: string, tags: readonly string[], kind: string) => {
    const group = el('div', 'cp-conditions');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    for (const tag of tags) {
      const b = el('button', `cp-chip is-${kind}`, tag);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(current().includes(tag)));
      b.addEventListener('click', () => toggle(tag));
      group.append(b);
    }
    return group;
  };
  const render = () => {
    const official = chipGroup('Conditions', CONDITIONS, 'condition');
    const exhaustion = el('label', 'cp-exhaustion');
    const select = el('select', 't-input');
    for (let i = 0; i <= MAX_EXHAUSTION; i++) {
      const o = el('option', '', i ? String(i) : '–');
      o.value = String(i);
      select.append(o);
    }
    select.value = String(exhaustionLevel(current()));
    select.addEventListener('change', async () => {
      const level = Number(select.value);
      const next = [...current().filter((c) => !/^Exhaustion /.test(c)), ...(level ? [`Exhaustion ${level}`] : [])];
      if (await save(next)) render();
    });
    exhaustion.append(document.createTextNode('Exhaustion '), select);
    official.append(exhaustion);

    // Own tags: shown with ×, plus a field to add one
    const own = el('div', 'cp-conditions');
    own.setAttribute('role', 'group');
    own.setAttribute('aria-label', 'Own tags');
    for (const tag of current().filter((t) => tagKind(t) === 'custom')) {
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
      if (!tag || current().some((t) => t.toLowerCase() === tag.toLowerCase())) return;
      if (await save([...current(), tag])) {
        render();
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
  render();
  return conditions;
}
