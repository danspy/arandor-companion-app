// The stat block in a panel at the right edge, over the page (initiative tracker, DM screen),
// so the fight stays in view while you read and roll.

import { renderStatBlock } from './statblock-view';
import { formatHp, hpControlHtml, wireHpControls, type HpEntry } from './hp-control';
import type { CreatureData } from './statblock';

let panel: HTMLElement | null = null;
let current: string | null = null;

// A page change (ClientRouter) replaces the body and with it the panel
document.addEventListener('astro:before-swap', () => document.documentElement.classList.remove('sb-panel-open'));

function ensurePanel(): HTMLElement {
  if (panel && document.body.contains(panel)) return panel;
  panel = document.createElement('aside');
  panel.className = 'sb-panel';
  panel.setAttribute('aria-label', 'Stat block');
  panel.setAttribute('aria-hidden', 'true');
  document.body.append(panel);
  return panel;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeStatBlock();
});

export function closeStatBlock() {
  if (!panel) return;
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('sb-panel-open');
  current = null;
}

/**
 * Opens (or, called again for the same combatant, closes) the stat block of a creature. With
 * the combatant's initiative entry, its HP and a damage/heal field sit at the top.
 */
export async function toggleStatBlock(creatureId: string, combatantName: string, entryId?: string) {
  const p = ensurePanel();
  const key = `${creatureId}|${combatantName}`;
  if (current === key && p.classList.contains('is-open')) return closeStatBlock();
  current = key;
  p.replaceChildren(document.createTextNode('Loading…'));
  p.classList.add('is-open');
  p.setAttribute('aria-hidden', 'false');
  // Wide screens make room for it (see statblock.css), so the fight stays in view
  document.documentElement.classList.add('sb-panel-open');
  try {
    const [res, entryRes] = await Promise.all([
      fetch(`/api/creatures/${encodeURIComponent(creatureId)}`, { cache: 'no-store' }),
      entryId ? fetch(`/api/initiative/${encodeURIComponent(entryId)}`, { cache: 'no-store' }) : Promise.resolve(null),
    ]);
    if (current !== key) return;
    if (!res.ok) throw new Error(res.status === 404 ? 'This stat block was deleted.' : 'Could not load the stat block.');
    const creature = (await res.json()) as CreatureData & { id: string };
    const bar = document.createElement('div');
    bar.className = 'sb-panel-bar';
    const who = document.createElement('span');
    who.className = 'sb-panel-who';
    who.textContent = combatantName !== creature.name ? `${combatantName} · stat block` : 'Stat block';
    const links = document.createElement('div');
    links.className = 'flex items-center gap-3';
    const open = document.createElement('a');
    open.href = `/tools/bestiary/${encodeURIComponent(creatureId)}`;
    open.className = 't-link text-sm';
    open.textContent = 'Open';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 't-icon-btn';
    close.setAttribute('aria-label', 'Close the stat block');
    close.textContent = '✕';
    close.addEventListener('click', closeStatBlock);
    links.append(open, close);
    bar.append(who, links);
    const parts: Node[] = [bar];
    const entry = entryRes?.ok ? ((await entryRes.json()) as HpEntry) : null;
    if (entry && entry.hp !== null) {
      // This combatant's HP, with damage and healing right here
      wireHpControls();
      const hp = document.createElement('div');
      hp.className = 'sb-panel-hp';
      hp.innerHTML = `<span class="t-label">HP</span> <b></b> ${hpControlHtml(entry.id, combatantName)}`;
      const value = hp.querySelector('b')!;
      value.dataset.hpOf = entry.id;
      value.textContent = formatHp(entry);
      parts.push(hp);
    }
    parts.push(renderStatBlock(creature, { rollerName: combatantName, showNotes: true }));
    p.replaceChildren(...parts);
  } catch (err) {
    p.replaceChildren(document.createTextNode(err instanceof Error ? err.message : 'Could not load the stat block.'));
  }
}
