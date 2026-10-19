// Generic NPC stat blocks: species (the SRD 5.2 species) × role × level 1–20, computed with the
// player rules (2024): proficiency bonus by level, HP from the role's hit die, the standard array
// arranged for the role and improved at levels 4/8/12/16/19, armour and weapons that fit the
// role, Extra Attack, Sneak Attack and cantrip damage by level, and the species' traits.
// The result is an ordinary bestiary creature the DM can save, edit and link to NPCs. Pure.

import { ABILITIES, abilityMod, type Ability, type CreatureData, type StatEntry, type StatSection } from './statblock';

export const SPECIES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Orc', 'Dragonborn', 'Tiefling', 'Goliath'] as const;
export type Species = (typeof SPECIES)[number];
export const ROLES = ['Commoner', 'Warrior', 'Archer', 'Rogue', 'Mage', 'Priest'] as const;
export type Role = (typeof ROLES)[number];
export const DRACONIC_DAMAGE = ['Fire', 'Cold', 'Lightning', 'Acid', 'Poison'] as const;
export type DraconicDamage = (typeof DRACONIC_DAMAGE)[number];

export interface NpcOptions {
  species: Species;
  role: Role;
  level: number; // 1–20
  ancestry?: DraconicDamage; // Dragonborn
}

export const proficiencyBonus = (level: number) => 2 + Math.floor((level - 1) / 4);
const sign = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
const dice = (count: number, die: number, mod: number) => {
  const avg = Math.floor(count * (die + 1) / 2) + mod;
  return `${Math.max(1, avg)} (${count}d${die}${mod ? ` ${mod < 0 ? '−' : '+'} ${Math.abs(mod)}` : ''})`;
};
const cantripDice = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);

interface RoleSpec {
  hitDie: number;
  /** Standard array (15, 14, 13, 12, 10, 8), best first */
  order: Ability[];
  saves: Ability[];
  skills: string[];
}

const ROLE: Record<Role, RoleSpec> = {
  Commoner: { hitDie: 8, order: ['con', 'str', 'wis', 'dex', 'cha', 'int'], saves: [], skills: ['Perception'] },
  Warrior: { hitDie: 10, order: ['str', 'con', 'dex', 'wis', 'cha', 'int'], saves: ['str', 'con'], skills: ['Athletics', 'Perception'] },
  Archer: { hitDie: 10, order: ['dex', 'con', 'wis', 'str', 'int', 'cha'], saves: ['str', 'dex'], skills: ['Perception', 'Stealth', 'Survival'] },
  Rogue: { hitDie: 8, order: ['dex', 'con', 'wis', 'int', 'cha', 'str'], saves: ['dex', 'int'], skills: ['Acrobatics', 'Deception', 'Perception', 'Stealth'] },
  Mage: { hitDie: 6, order: ['int', 'con', 'dex', 'wis', 'cha', 'str'], saves: ['int', 'wis'], skills: ['Arcana', 'History'] },
  Priest: { hitDie: 8, order: ['wis', 'con', 'str', 'cha', 'dex', 'int'], saves: ['wis', 'cha'], skills: ['Insight', 'Medicine', 'Religion'] },
};
const ARRAY = [15, 14, 13, 12, 10, 8];
const SKILL_ABILITY: Record<string, Ability> = {
  Acrobatics: 'dex', Arcana: 'int', Athletics: 'str', Deception: 'cha', History: 'int', Insight: 'wis',
  Medicine: 'wis', Perception: 'wis', Religion: 'int', Stealth: 'dex', Survival: 'wis',
};

const SIZE: Record<Species, string> = {
  Human: 'Medium or Small', Elf: 'Medium', Dwarf: 'Medium', Halfling: 'Small', Gnome: 'Small', Orc: 'Medium',
  Dragonborn: 'Medium', Tiefling: 'Medium or Small', Goliath: 'Medium',
};
const DARKVISION: Partial<Record<Species, number>> = { Elf: 60, Dwarf: 120, Gnome: 60, Orc: 120, Dragonborn: 60, Tiefling: 60 };

export function defaultNpcName({ species, role, level }: NpcOptions) {
  return `${species} ${role} (level ${level})`;
}

export function generateNpc(options: NpcOptions): CreatureData {
  const { species, role } = options;
  const level = Math.min(20, Math.max(1, Math.round(options.level)));
  const spec = ROLE[role];
  const pb = proficiencyBonus(level);
  const it = `the ${role.toLowerCase()}`;
  const It = `The ${role.toLowerCase()}`;

  // Abilities: standard array, then +2 to the best (up to 20, then the second) at 4/8/12/16/19
  const scores = {} as Record<Ability, number>;
  spec.order.forEach((a, i) => (scores[a] = ARRAY[i]));
  for (const asi of [4, 8, 12, 16, 19]) {
    if (level < asi) break;
    const target = spec.order.find((a) => scores[a] < 20) ?? spec.order[0];
    scores[target] = Math.min(20, scores[target] + 2);
  }
  const mod = (a: Ability) => abilityMod(scores[a]);
  const abilities: CreatureData['abilities'] = {};
  for (const a of ABILITIES) abilities[a] = { score: scores[a], mod: mod(a), save: mod(a) + (spec.saves.includes(a) ? pb : 0) };

  // HP: the hit die's maximum at level 1, its average (rounded up) after; Constitution each level
  const perLevel = spec.hitDie / 2 + 1 + mod('con') + (species === 'Dwarf' ? 1 : 0);
  const hp = Math.max(1, spec.hitDie + mod('con') + (species === 'Dwarf' ? 1 : 0) + perLevel * (level - 1));
  const hpBonus = mod('con') * level + (species === 'Dwarf' ? level : 0);
  const hpFormula = `${level}d${spec.hitDie}${hpBonus ? ` ${hpBonus < 0 ? '−' : '+'} ${Math.abs(hpBonus)}` : ''}`;

  // Skills (Elf: Keen Senses; Human: Skillful)
  const skills = new Set(spec.skills);
  if (species === 'Elf' || species === 'Human') skills.add('Perception');
  if (species === 'Human') skills.add('Insight');
  const skillText = [...skills].sort().map((s) => `${s} ${sign(mod(SKILL_ABILITY[s]) + pb)}`).join(', ');
  const passive = 10 + mod('wis') + (skills.has('Perception') ? pb : 0);

  // Armour
  const dex = mod('dex');
  let ac: number;
  let acNote: string;
  switch (role) {
    case 'Warrior': [ac, acNote] = level >= 9 ? [20, 'Plate Armor, Shield'] : level >= 5 ? [19, 'Splint Armor, Shield'] : [18, 'Chain Mail, Shield']; break;
    case 'Archer': [ac, acNote] = [12 + dex, 'Studded Leather Armor']; break;
    case 'Rogue': [ac, acNote] = [11 + dex, 'Leather Armor']; break;
    case 'Mage': [ac, acNote] = [13 + dex, 'with Mage Armor']; break;
    case 'Priest': [ac, acNote] = [13 + Math.min(dex, 2) + 2, 'Chain Shirt, Shield']; break;
    default: [ac, acNote] = [10 + dex, ''];
  }

  const traits: StatEntry[] = [];
  const actions: StatEntry[] = [];
  const bonus: StatEntry[] = [];
  const reactions: StatEntry[] = [];
  const resistances: string[] = [];
  const speed = species === 'Goliath' ? 35 : 30;

  // ── Role ──
  const attacks = role === 'Warrior' || role === 'Archer' ? (level >= 20 && role === 'Warrior' ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1) : 1;
  const melee = (name: string, ability: Ability, die: number, count: number, type: string, extra = '') =>
    ({ name, text: `Melee Attack Roll: ${sign(mod(ability) + pb)}, reach 5 ft.${extra} Hit: ${dice(count, die, mod(ability))} ${type} damage.` });
  const ranged = (name: string, die: number, type: string, range: string, bonus = 0) =>
    ({ name, text: `Ranged Attack Roll: ${sign(dex + pb + bonus)}, range ${range} ft. Hit: ${dice(1, die, dex)} ${type} damage.` });

  switch (role) {
    case 'Commoner':
      actions.push(melee('Club', 'str', 4, 1, 'Bludgeoning'));
      break;
    case 'Warrior':
      if (attacks > 1) actions.push({ name: 'Multiattack', text: `${It} makes ${['', '', 'two', 'three', 'four'][attacks]} Longsword attacks.` });
      actions.push(melee('Longsword', 'str', 8, 1, 'Slashing'));
      actions.push(ranged('Heavy Crossbow', 10, 'Piercing', '100/400'));
      bonus.push({ name: `Second Wind (${level >= 10 ? 4 : level >= 4 ? 3 : 2}/Day)`, text: `${It} regains ${dice(1, 10, level)} Hit Points.` });
      if (level >= 2) traits.push({ name: `Action Surge (${level >= 17 ? 2 : 1}/Day)`, text: `On its turn, ${it} can take one additional action.` });
      if (level >= 9) traits.push({ name: `Indomitable (${level >= 17 ? 3 : level >= 13 ? 2 : 1}/Day)`, text: `If ${it} fails a saving throw, it can reroll it with a bonus of ${sign(level)}, and it must use the new roll.` });
      break;
    case 'Archer':
      if (attacks > 1) actions.push({ name: 'Multiattack', text: `${It} makes ${['', '', 'two', 'three'][attacks]} attacks, using Longbow or Shortsword in any combination.` });
      actions.push(ranged('Longbow', 8, 'Piercing', '150/600', 2)); // Archery fighting style
      actions.push(melee('Shortsword', 'dex', 6, 1, 'Piercing'));
      traits.push({ name: 'Archery', text: `${It} has a +2 bonus to attack rolls with ranged weapons (included in Longbow).` });
      break;
    case 'Rogue': {
      const sneak = Math.ceil(level / 2);
      actions.push(melee('Shortsword', 'dex', 6, 1, 'Piercing'));
      actions.push(ranged('Shortbow', 6, 'Piercing', '80/320'));
      traits.push({ name: 'Sneak Attack (1/Turn)', text: `${It} deals an extra ${dice(sneak, 6, 0)} damage when it hits a target with a Finesse or Ranged weapon and has Advantage on the attack roll, or when an ally is within 5 feet of the target and it doesn't have Disadvantage.` });
      if (level >= 2) bonus.push({ name: 'Cunning Action', text: `${It} takes the Dash, Disengage, or Hide action.` });
      if (level >= 5) reactions.push({ name: 'Uncanny Dodge', text: `Trigger: An attacker ${it} can see hits it with an attack roll. Response: ${It} halves the attack's damage against it.` });
      if (level >= 7) traits.push({ name: 'Evasion', text: `When ${it} makes a Dexterity saving throw to take only half damage, it takes no damage on a success and half damage on a failure.` });
      break;
    }
    case 'Mage': {
      const dc = 8 + pb + mod('int');
      actions.push({ name: 'Fire Bolt', text: `Ranged Attack Roll: ${sign(pb + mod('int'))}, range 120 ft. Hit: ${dice(cantripDice(level), 10, 0)} Fire damage.` });
      actions.push(melee('Dagger', 'dex', 4, 1, 'Piercing'));
      const lists: string[] = ['At Will: Fire Bolt, Light, Mage Armor, Mage Hand, Prestidigitation'];
      const perDay: [number, string][] = [[1, 'Magic Missile, Shield'], [3, 'Misty Step, Hold Person'], [5, 'Fireball, Counterspell'], [7, 'Greater Invisibility'], [9, 'Cone of Cold'], [11, 'Chain Lightning'], [13, 'Teleport'], [15, 'Sunburst'], [17, 'Meteor Swarm']];
      const unlocked = perDay.filter(([l]) => level >= l).map(([, s]) => s);
      if (unlocked.length) lists.push(`2/Day Each: ${unlocked.slice(0, 2).join(', ')}`);
      if (unlocked.length > 2) lists.push(`1/Day Each: ${unlocked.slice(2).join(', ')}`);
      actions.push({ name: 'Spellcasting', text: `${It} casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC ${dc}, ${sign(pb + mod('int'))} to hit with spell attacks):\n${lists.join('\n')}` });
      break;
    }
    case 'Priest': {
      const dc = 8 + pb + mod('wis');
      actions.push(melee('Mace', 'str', 6, 1, 'Bludgeoning'));
      actions.push({ name: 'Sacred Flame', text: `Dexterity Saving Throw: DC ${dc}, one creature the priest can see within 60 feet. Failure: ${dice(cantripDice(level), 8, 0)} Radiant damage.` });
      actions.push({ name: 'Cure Wounds (3/Day)', text: `${It} touches a creature, which regains ${dice(2, 8, mod('wis'))} Hit Points.` });
      const lists: string[] = ['At Will: Guidance, Sacred Flame, Thaumaturgy'];
      const perDay: [number, string][] = [[1, 'Bless'], [3, 'Hold Person'], [5, 'Spirit Guardians'], [7, 'Guardian of Faith'], [9, 'Mass Cure Wounds'], [11, 'Heal'], [13, 'Fire Storm'], [17, 'Mass Heal']];
      const unlocked = perDay.filter(([l]) => level >= l).map(([, s]) => s);
      lists.push(`1/Day Each: ${unlocked.join(', ')}`);
      actions.push({ name: 'Spellcasting', text: `${It} casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC ${dc}):\n${lists.join('\n')}` });
      if (level >= 3) bonus.push({ name: 'Spiritual Weapon', text: `Melee Attack Roll: ${sign(pb + mod('wis'))}, reach 5 ft. Hit: ${dice(level >= 5 ? 2 : 1, 8, mod('wis'))} Force damage. The spectral weapon lasts for 1 minute (Concentration).` });
      break;
    }
  }

  // ── Species ──
  const conMod = mod('con');
  switch (species) {
    case 'Elf':
      traits.push({ name: 'Fey Ancestry', text: `${It} has Advantage on saving throws it makes to avoid or end the Charmed condition.` });
      traits.push({ name: 'Trance', text: `${It} doesn't need to sleep, and magic can't put it to sleep.` });
      break;
    case 'Dwarf':
      resistances.push('Poison');
      traits.push({ name: 'Dwarven Resilience', text: `${It} has Advantage on saving throws it makes to avoid or end the Poisoned condition.` });
      bonus.push({ name: `Stonecunning (${pb}/Day)`, text: `${It} gains Tremorsense with a range of 60 feet for 10 minutes while on or touching stone.` });
      break;
    case 'Halfling':
      traits.push({ name: 'Brave', text: `${It} has Advantage on saving throws it makes to avoid or end the Frightened condition.` });
      traits.push({ name: 'Luck', text: `When ${it} rolls a 1 on the d20 of a D20 Test, it can reroll the die and must use the new roll.` });
      traits.push({ name: 'Halfling Nimbleness', text: `${It} can move through the space of any creature that is a size larger than it.` });
      break;
    case 'Gnome':
      traits.push({ name: 'Gnomish Cunning', text: `${It} has Advantage on Intelligence, Wisdom, and Charisma saving throws.` });
      break;
    case 'Orc':
      traits.push({ name: 'Relentless Endurance (1/Day)', text: `When ${it} is reduced to 0 Hit Points but not killed outright, it can drop to 1 Hit Point instead.` });
      bonus.push({ name: `Adrenaline Rush (${pb}/Day)`, text: `${It} takes the Dash action and gains ${pb} Temporary Hit Points.` });
      break;
    case 'Dragonborn': {
      const type = options.ancestry ?? 'Fire';
      resistances.push(type);
      const dc = 8 + conMod + pb;
      actions.push({ name: `Breath Weapon (${pb}/Day)`, text: `Dexterity Saving Throw: DC ${dc}, each creature in a 15-foot Cone or a 30-foot Line that is 5 feet wide. Failure: ${dice(cantripDice(level), 10, 0)} ${type} damage. Success: Half damage. ${It} can use it in place of one of its attacks.` });
      if (level >= 5) bonus.push({ name: 'Draconic Flight (1/Day)', text: `Spectral wings appear on ${it}'s back for 10 minutes; it has a Fly Speed of ${speed} feet.` });
      break;
    }
    case 'Tiefling':
      resistances.push('Fire');
      traits.push({ name: 'Infernal Legacy', text: `${It} knows the Fire Bolt cantrip${level >= 3 ? ' and can cast Hellish Rebuke once per day' : ''}${level >= 5 ? ' and Darkness once per day' : ''}, using Charisma as the spellcasting ability.` });
      if (level >= 3) reactions.push({ name: 'Hellish Rebuke (1/Day)', text: `Trigger: A creature ${it} can see within 60 feet damages it. Response: Dexterity Saving Throw: DC ${8 + pb + mod('cha')}, the triggering creature. Failure: ${dice(2, 10, 0)} Fire damage. Success: Half damage.` });
      break;
    case 'Goliath':
      reactions.push({ name: `Stone's Endurance (${pb}/Day)`, text: `Trigger: ${It} takes damage. Response: It reduces the damage by ${dice(1, 12, conMod)}.` });
      traits.push({ name: 'Powerful Build', text: `${It} has Advantage on ability checks to end the Grappled condition and counts as one size larger when determining its carrying capacity.` });
      if (level >= 5) bonus.push({ name: 'Large Form (1/Day)', text: `${It} becomes Large for 10 minutes: Advantage on Strength checks, and its Speed increases by 10 feet.` });
      break;
    case 'Human':
      traits.push({ name: 'Resourceful', text: `${It} is skilled and adaptable (proficiency in an extra skill).` });
      break;
  }

  const details: CreatureData['details'] = [{ label: 'Skills', text: skillText }];
  if (resistances.length) details.push({ label: 'Resistances', text: resistances.join(', ') });
  details.push({ label: 'Senses', text: `${DARKVISION[species] ? `Darkvision ${DARKVISION[species]} ft.; ` : ''}Passive Perception ${passive}` });
  details.push({ label: 'Languages', text: `Common${species === 'Human' ? ' and one other language' : species === 'Dwarf' ? ', Dwarvish' : species === 'Elf' ? ', Elvish' : species === 'Gnome' ? ', Gnomish' : species === 'Halfling' ? ', Halfling' : species === 'Orc' ? ', Orc' : species === 'Dragonborn' ? ', Draconic' : species === 'Tiefling' ? ', Infernal' : ', Giant'}` });
  details.push({ label: 'Proficiency Bonus', text: sign(pb) });

  const sections: StatSection[] = [];
  if (traits.length) sections.push({ title: 'Traits', entries: traits });
  sections.push({ title: 'Actions', entries: actions });
  if (bonus.length) sections.push({ title: 'Bonus Actions', entries: bonus });
  if (reactions.length) sections.push({ title: 'Reactions', entries: reactions });

  return {
    name: defaultNpcName({ ...options, level }),
    typeLine: `${SIZE[species]} Humanoid (${species}), level ${level} ${role}`,
    ac,
    acNote: acNote || null,
    hp,
    hpFormula,
    initiative: dex,
    speed: `${speed} ft.`,
    abilities,
    details,
    sections,
    cr: null,
    xp: null,
    npcIds: [],
    notes: `Generated: ${species} ${role}, level ${level}${species === 'Dragonborn' ? ` (${options.ancestry ?? 'Fire'} ancestry)` : ''}.`,
    sourceText: null,
  };
}
