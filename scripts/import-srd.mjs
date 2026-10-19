// Builds src/data/srd-2024-creatures.json: every creature of the System Reference Document 5.2
// (CC-BY-4.0, by Wizards of the Coast) in the bestiary's stat block shape (src/lib/statblock.ts).
// Source: the Open5e API (document "srd-2024"). Run by hand when the SRD data should be renewed:
//   node scripts/import-srd.mjs
// The conversion also repairs a few transcription gaps of the source: attack texts get their
// "Hit:" back, recharge and per-day limits go into the action names as in the book, generic
// Humanoid NPCs are "Medium or Small", and legendary actions get the book's intro.

import { writeFileSync, mkdirSync } from 'node:fs';

const API = 'https://api.open5e.com/v2/creatures/?document__key=srd-2024&limit=100&format=json';
const OUT = new URL('../src/data/srd-2024-creatures.json', import.meta.url);

const title = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const SKILL_NAMES = { animal_handling: 'Animal Handling', sleight_of_hand: 'Sleight of Hand' };
const ABILITY = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const SECTION = { ACTION: 'Actions', BONUS_ACTION: 'Bonus Actions', REACTION: 'Reactions', LEGENDARY_ACTION: 'Legendary Actions' };

function cr(value) {
  return { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' }[value] ?? String(value);
}

function speed(s) {
  const parts = [`${s.walk ?? 0} ft.`];
  for (const k of ['burrow', 'climb', 'fly', 'swim']) if (s[k]) parts.push(`${title(k)} ${s[k]} ft.${k === 'fly' && s.hover ? ' (hover)' : ''}`);
  return parts.join(', ');
}

// "- **At Will:** Detect Magic" → "At Will: Detect Magic"
const plain = (text) => text.replace(/^\s*-\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\n{2,}/g, '\n').trim();

function actionText(desc) {
  let text = plain(desc);
  // "Melee Attack Roll: +4, reach 5 ft. 5 (1d6 + 2) Slashing damage" → "… 5 ft. Hit: 5 (1d6 + 2) …"
  // (before the first damage after the attack roll: "5 (1d6 + 2) …" or "1 Piercing damage")
  if (/Attack Roll:/.test(text) && !/\bHit:/.test(text)) text = text.replace(/(Attack Roll:.*?)\s(?=\d+ \(\d+d\d+|\d+ [A-Z][a-z]+ damage)/, '$1 Hit: ');
  return text;
}

function actionName(a) {
  const u = a.usage_limits;
  if (!u || /\(.*(Recharge|\/Day).*\)/.test(a.name)) return a.name;
  if (u.type === 'RECHARGE_ON_ROLL' || u.type === 'RECHARGE') return `${a.name} (Recharge ${u.param < 6 ? `${u.param}–6` : '6'})`;
  if (u.type === 'PER_DAY') return `${a.name} (${u.param}/Day)`;
  return a.name;
}

function convert(c) {
  const size = c.type.name === 'Humanoid' && c.size.name === 'Small' ? 'Medium or Small' : c.size.name;
  const abilities = {};
  const broken = [];
  for (const [long, short] of Object.entries(ABILITY)) {
    const score = c.ability_scores[long];
    // A few scores are garbled in the source (e.g. Con 0); leave them out rather than guess
    if (!(score >= 1 && score <= 30)) {
      broken.push(title(short));
      continue;
    }
    abilities[short] = { score, mod: c.modifiers[long], save: c.saving_throws?.[long] ?? c.modifiers[long] };
  }
  const details = [];
  const skills = Object.entries(c.skill_bonuses ?? {});
  if (skills.length) details.push({ label: 'Skills', text: skills.map(([k, v]) => `${SKILL_NAMES[k] ?? title(k)} ${v < 0 ? `−${-v}` : `+${v}`}`).join(', ') });
  const ri = c.resistances_and_immunities ?? {};
  if (ri.damage_vulnerabilities_display) details.push({ label: 'Vulnerabilities', text: title(ri.damage_vulnerabilities_display) });
  if (ri.damage_resistances_display) details.push({ label: 'Resistances', text: title(ri.damage_resistances_display) });
  const immune = [ri.damage_immunities_display, ri.condition_immunities_display].filter(Boolean).map(title).join('; ');
  if (immune) details.push({ label: 'Immunities', text: immune });
  const senses = [['blindsight_range', 'Blindsight'], ['darkvision_range', 'Darkvision'], ['tremorsense_range', 'Tremorsense'], ['truesight_range', 'Truesight']]
    .filter(([k]) => c[k]).map(([k, label]) => `${label} ${c[k]} ft.`);
  details.push({ label: 'Senses', text: [senses.join(', '), `Passive Perception ${c.passive_perception}`].filter(Boolean).join('; ') });
  details.push({ label: 'Languages', text: c.languages?.as_string || 'None' });

  const sections = [];
  if (c.traits?.length) sections.push({ title: 'Traits', entries: c.traits.map((t) => ({ name: t.name, text: plain(t.desc) })) });
  const actions = [...(c.actions ?? [])].sort((a, b) => (a.order_in_statblock ?? 0) - (b.order_in_statblock ?? 0));
  for (const [type, sectionTitle] of Object.entries(SECTION)) {
    const entries = actions.filter((a) => a.action_type === type).map((a) => ({ name: actionName(a), text: actionText(a.desc) }));
    if (!entries.length) continue;
    const section = { title: sectionTitle, entries };
    if (type === 'LEGENDARY_ACTION') {
      // The source has no intro; the book's wording (3 uses is the usual number, check the book)
      const it = `the ${c.name.toLowerCase()}`;
      section.intro = `Legendary Action Uses: 3. Immediately after another creature's turn, ${it} can expend a use to take one of the following actions. It regains all expended uses at the start of each of its turns.`;
    }
    sections.push(section);
  }

  return {
    key: c.key.replace(/^srd-2024_/, ''),
    name: c.name,
    typeLine: `${size} ${c.type.name}, ${title(c.alignment)}`,
    ac: c.armor_class,
    acNote: c.armor_detail || null,
    hp: c.hit_points,
    hpFormula: c.hit_dice || null,
    initiative: c.initiative_bonus ?? c.modifiers.dexterity,
    speed: speed(c.speed ?? {}),
    abilities,
    details,
    sections,
    cr: cr(c.challenge_rating),
    xp: c.experience_points ?? null,
    notes: broken.length ? `The source data has no valid ${broken.join(', ')}; please check against the book.` : null,
  };
}

let url = API;
const all = [];
while (url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const page = await res.json();
  all.push(...page.results);
  url = page.next;
}
const creatures = all.map(convert).sort((a, b) => a.name.localeCompare(b.name));
mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  source: 'System Reference Document 5.2 (SRD 5.2) by Wizards of the Coast LLC, via the Open5e API',
  license: 'Creative Commons Attribution 4.0 International (CC-BY-4.0)',
  creatures,
}));
console.log(`${creatures.length} creatures → ${OUT.pathname}`);
