// Renders a bestiary stat block (2024 layout) with working roll buttons. Used by the stat
// block page, the initiative tracker's side panel and the DM screen. Styles: styles/statblock.css.

import { rollParts, type RollMode } from './dice';
import type { RollPart } from './dice-notation';
import { ABILITIES, ABILITY_NAMES, attackParts, findRolls, signed, type CreatureData, type StatEntry } from './statblock';

export interface StatBlockOptions {
  /** Who is rolling, shown on the result card ("Goblin Warrior 2 · Scimitar"); default: the creature. */
  rollerName?: string;
  /** Show the DM notes at the end. */
  showNotes?: boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

// The book's italic run-ins: "Melee Attack Roll:", "Hit:", "Dexterity Saving Throw:", …
const RUN_IN = /\b((?:Melee or Ranged|Melee|Ranged) Attack Roll:|Hit or Miss:|Hit:|Miss:|(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:|Failure or Success:|First Failure:|Second Failure:|Failure:|Success:|Trigger:|Response:|At Will:|\d+\/Day(?: Each)?:)/g;

function textWithRunIns(text: string): Node[] {
  const out: Node[] = [];
  let last = 0;
  for (const m of text.matchAll(RUN_IN)) {
    if (m.index! > last) out.push(document.createTextNode(text.slice(last, m.index)));
    out.push(el('em', 'sb-runin', m[0]));
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}

export function renderStatBlock(c: CreatureData, options: StatBlockOptions = {}): HTMLElement {
  const who = options.rollerName || c.name;
  const root = el('article', 'statblock');
  let mode: RollMode = 'normal';

  // Advantage applies to the next d20 roll, then falls back to Normal
  const modeSwitch = el('div', 'sb-mode');
  modeSwitch.setAttribute('role', 'group');
  modeSwitch.setAttribute('aria-label', 'Advantage for the next roll');
  const setMode = (m: RollMode) => {
    mode = m;
    modeSwitch.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  };
  for (const [m, label, title] of [['normal', 'Normal', ''], ['advantage', 'Adv', 'Advantage on the next d20'], ['disadvantage', 'Dis', 'Disadvantage on the next d20']] as const) {
    const b = el('button', '', label);
    b.type = 'button';
    b.dataset.mode = m;
    if (title) b.title = title;
    b.addEventListener('click', () => setMode(m));
    modeSwitch.append(b);
  }
  setMode('normal');

  const roll = (parts: RollPart[], what: string) => {
    const m = mode;
    setMode('normal');
    void rollParts(parts, { mode: m, name: `${who} · ${what}` });
  };
  const rollButton = (content: string | Node[], parts: RollPart[], what: string, title: string, extraClass = '') => {
    const b = el('button', `sb-roll ${extraClass}`.trim());
    b.type = 'button';
    b.title = title;
    if (typeof content === 'string') b.textContent = content;
    else b.append(...content);
    b.addEventListener('click', () => roll(parts, what));
    return b;
  };
  const d20 = (bonus: number) => `1d20${bonus < 0 ? bonus : `+${bonus}`}`;

  // ── Header ──
  const head = el('header', 'sb-head');
  const titles = el('div');
  titles.append(el('h2', 'sb-name', c.name));
  if (c.typeLine) titles.append(el('p', 'sb-type', c.typeLine));
  head.append(titles, modeSwitch);
  root.append(head);

  // ── AC, Initiative, HP, Speed ──
  const core = el('div', 'sb-core');
  const line = (label: string, ...content: (Node | string)[]) => {
    const p = el('p', 'sb-line');
    p.append(el('b', '', label), ' ', ...content);
    return p;
  };
  const acHp = el('div', 'sb-pair');
  if (c.ac !== null) acHp.append(line('AC', `${c.ac}${c.acNote ? ` (${c.acNote})` : ''}`));
  if (c.initiative !== null) {
    acHp.append(line('Initiative', rollButton(signed(c.initiative), [{ label: 'Initiative', expr: d20(c.initiative) }], 'Initiative', `Roll initiative (${d20(c.initiative)})`), ` (${10 + c.initiative})`));
  }
  core.append(acHp);
  if (c.hp !== null) {
    const hp: (Node | string)[] = [String(c.hp)];
    if (c.hpFormula) hp.push(' (', rollButton(c.hpFormula, [{ label: 'Hit points', expr: c.hpFormula.replace(/\s+/g, '').replace(/[−–]/g, '-') }], 'Hit points', 'Roll hit points'), ')');
    core.append(line('HP', ...hp));
  }
  if (c.speed) core.append(line('Speed', c.speed));
  root.append(core);

  // ── Abilities: 2024 table, Mod and Save roll ──
  const present = ABILITIES.filter((a) => c.abilities[a]);
  if (present.length) {
    const grid = el('div', 'sb-abilities');
    for (const group of [ABILITIES.slice(0, 3), ABILITIES.slice(3)]) {
      const table = el('table', 'sb-ability-table');
      const headRow = el('tr');
      headRow.append(el('th'), el('th'), el('th', '', 'Mod'), el('th', '', 'Save'));
      table.append(headRow);
      for (const a of group) {
        const s = c.abilities[a];
        if (!s) continue;
        const tr = el('tr');
        const name = ABILITY_NAMES[a];
        const mod = el('td');
        mod.append(rollButton(signed(s.mod), [{ label: `${name} check`, expr: d20(s.mod) }], `${name} check`, `${name} check (${d20(s.mod)})`));
        const save = el('td');
        save.append(rollButton(signed(s.save), [{ label: `${name} save`, expr: d20(s.save) }], `${name} save`, `${name} saving throw (${d20(s.save)})`, s.save !== s.mod ? 'is-proficient' : ''));
        tr.append(el('th', '', name), el('td', 'sb-score', String(s.score)), mod, save);
        table.append(tr);
      }
      grid.append(table);
    }
    root.append(grid);
  }

  // ── Detail lines; skills and saving throws roll ──
  if (c.details.length || c.cr) {
    const details = el('div', 'sb-details');
    for (const d of c.details) {
      if (/^(Skills|Saving Throws)$/i.test(d.label)) {
        const parts: (Node | string)[] = [];
        let last = 0;
        for (const m of d.text.matchAll(/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*) ([+\-−–]\s?\d+)/g)) {
          parts.push(d.text.slice(last, m.index), `${m[1]} `);
          const bonus = parseInt(m[2].replace(/[−–]/, '-').replace(/\s/g, ''), 10);
          parts.push(rollButton(m[2], [{ label: m[1], expr: d20(bonus) }], m[1], `${m[1]} (${d20(bonus)})`));
          last = m.index! + m[0].length;
        }
        parts.push(d.text.slice(last));
        details.append(line(d.label, ...parts));
      } else {
        details.append(line(d.label, d.text));
      }
    }
    if (c.cr) details.append(line('CR', `${c.cr}${c.xp !== null ? ` (XP ${c.xp.toLocaleString('en')})` : ''}`));
    root.append(details);
  }

  // ── Traits, actions, … ──
  for (const section of c.sections) {
    const sec = el('section', 'sb-section');
    sec.append(el('h3', 'sb-section-title', section.title));
    if (section.intro) for (const para of section.intro.split('\n')) sec.append(entryParagraph(para));
    for (const entry of section.entries) sec.append(renderEntry(entry));
    root.append(sec);
  }

  if (options.showNotes && c.notes) {
    const notes = el('section', 'sb-notes');
    notes.append(el('h3', 'sb-section-title', 'DM notes'), el('p', 'sb-notes-text', c.notes));
    root.append(notes);
  }

  function entryParagraph(text: string): HTMLElement {
    const p = el('p', 'sb-text');
    let last = 0;
    for (const r of findRolls(text)) {
      if (r.start < last) continue;
      p.append(...textWithRunIns(text.slice(last, r.start)));
      const shown = text.slice(r.start, r.end);
      if (r.kind === 'attack') p.append(rollButton(shown, [{ label: r.label, expr: r.expr }], r.label, `${r.label} (${r.expr})`));
      else if (r.kind === 'recharge') p.append(rollButton(shown, [{ label: 'Recharge', expr: '1d6' }], 'Recharge', 'Roll for recharge (d6)'));
      else p.append(rollButton(shown, [{ label: r.label || 'Roll', expr: r.expr }], r.label ? `${r.label} damage` : 'Roll', `${r.label ? `${r.label} damage` : 'Roll'} (${r.expr})${r.conditional ? ' — only when it applies' : ''}`, r.conditional ? 'is-conditional' : ''));
      last = r.end;
    }
    p.append(...textWithRunIns(text.slice(last)));
    return p;
  }

  function renderEntry(entry: StatEntry): HTMLElement {
    const wrap = el('div', 'sb-entry');
    const [first, ...rest] = entry.text.split('\n');
    const p = entryParagraph(first ?? '');
    const attack = attackParts(entry.text);
    const name: Node = attack
      ? rollButton([el('span', 'sb-dice-icon', '⚄'), document.createTextNode(`${entry.name}.`)], attack, entry.name, `Attack: ${attack.map((a) => `${a.label} ${a.expr}`).join(', ')}`, 'sb-entry-name sb-attack')
      : el('strong', 'sb-entry-name', `${entry.name}.`);
    p.prepend(name, ' ');
    // "Fire Breath (Recharge 5–6)": the recharge is in the name
    const recharge = entry.name.match(/Recharge\s+\d(?:\s*[–\-−]\s*\d)?/);
    if (recharge) p.insertBefore(rollButton('d6', [{ label: 'Recharge', expr: '1d6' }], `${entry.name.replace(/\s*\(.*$/, '')} recharge`, `Roll for recharge: ${recharge[0]}`, 'sb-recharge'), name.nextSibling);
    wrap.append(p);
    for (const para of rest) wrap.append(entryParagraph(para));
    return wrap;
  }

  return root;
}
