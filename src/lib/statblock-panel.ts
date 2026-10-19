// The stat block in a panel at the right edge, over the page (initiative tracker, DM screen),
// so the fight stays in view while you read and roll.

import { renderStatBlock } from './statblock-view';
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

/** Opens (or, called again for the same combatant, closes) the stat block of a creature. */
export async function toggleStatBlock(creatureId: string, combatantName: string) {
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
    const res = await fetch(`/api/creatures/${encodeURIComponent(creatureId)}`, { cache: 'no-store' });
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
    p.replaceChildren(bar, renderStatBlock(creature, { rollerName: combatantName, showNotes: true }));
  } catch (err) {
    p.replaceChildren(document.createTextNode(err instanceof Error ? err.message : 'Could not load the stat block.'));
  }
}
