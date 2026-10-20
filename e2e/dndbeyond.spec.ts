import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abilityScores, addSubclassSpells, buildSheet, calculateHitPoints } from '../src/lib/dndbeyond';

// D&D Beyond character JSON (trimmed to the fields we read) for the seven linked characters.
// The expected numbers are what the D&D Beyond character sheet itself shows (checked 2026-10-19).
const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/dndbeyond/${name}.json`, import.meta.url), 'utf8'));

test.describe('D&D Beyond import', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('hit points match the D&D Beyond sheet', () => {
    // Moronur: CON 15 + 1 (feat) = 16, Tough (+2/level) comes from a feat modifier
    expect(calculateHitPoints(load('moronur'))).toMatchObject({ maxHp: 138, hp: 138, tempHp: 0 });
    // Volrak: CON 14 + 1 (species) + 1 (ASI) = 16
    expect(calculateHitPoints(load('volrak'))).toMatchObject({ maxHp: 138, hp: 138 });
    // Sinatah: multiclass, CON 12 + 1 = 13
    expect(calculateHitPoints(load('sinatah'))).toMatchObject({ maxHp: 78, hp: 78 });
    // Alvar: a Potion of Healing in the pack must not add to max HP
    expect(calculateHitPoints(load('alvar'))).toMatchObject({ maxHp: 81, hp: 81 });
    // Roval: max HP override 127, 15 damage taken
    expect(calculateHitPoints(load('roval'))).toMatchObject({ maxHp: 127, hp: 112 });
    expect(calculateHitPoints(load('barum'))).toMatchObject({ maxHp: 62, hp: 62 });
    // Morrigan: hurt, 56 damage taken
    expect(calculateHitPoints(load('morrigan'))).toMatchObject({ maxHp: 72, hp: 16 });
  });

  test('ability scores include species, feat and other bonuses', () => {
    // "Other" bonus (STR +1) on top of species/feat bonuses
    expect(abilityScores(load('moronur'))).toEqual({ strength: 19, dexterity: 16, constitution: 16, intelligence: 12, wisdom: 10, charisma: 8 });
    // STR 15 + 5 is capped at 20
    expect(abilityScores(load('volrak'))).toEqual({ strength: 20, dexterity: 15, constitution: 16, intelligence: 8, wisdom: 10, charisma: 12 });
    // INT override 12 wins over the +1 feat bonus
    expect(abilityScores(load('sinatah'))).toEqual({ strength: 9, dexterity: 13, constitution: 13, intelligence: 12, wisdom: 19, charisma: 20 });
    // WIS 15 + 6 is capped at 20, then the "Other" +1 goes past the cap
    expect(abilityScores(load('alvar'))).toEqual({ strength: 8, dexterity: 13, constitution: 13, intelligence: 10, wisdom: 21, charisma: 14 });
    // CON override 16
    expect(abilityScores(load('roval'))).toEqual({ strength: 18, dexterity: 10, constitution: 16, intelligence: 8, wisdom: 12, charisma: 16 });
    expect(abilityScores(load('barum'))).toEqual({ strength: 9, dexterity: 14, constitution: 15, intelligence: 20, wisdom: 11, charisma: 13 });
    expect(abilityScores(load('morrigan'))).toEqual({ strength: 8, dexterity: 12, constitution: 16, intelligence: 20, wisdom: 14, charisma: 13 });
  });
});

// Numbers read off the rendered D&D Beyond sheets (saves, skills, passives, initiative, AC, speed)
const expected: Record<string, any> = JSON.parse(readFileSync(new URL('./fixtures/dndbeyond/expected-sheets.json', import.meta.url), 'utf8'));
const expectedAttacks: Record<string, any> = JSON.parse(readFileSync(new URL('./fixtures/dndbeyond/expected-attacks.json', import.meta.url), 'utf8'));
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

test.describe('D&D Beyond sheet', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  for (const [name, e] of Object.entries(expected)) {
    test(`${name}: saves, skills, passives and initiative match`, () => {
      const sheet = buildSheet(load(name));
      expect(sheet.proficiencyBonus).toBe(e.prof);
      expect(Object.fromEntries(ABILITIES.map((a) => [a, sheet.saves[a].bonus]))).toEqual(e.saves);
      expect([sheet.passivePerception, sheet.passiveInvestigation, sheet.passiveInsight]).toEqual([e.perception, e.investigation, e.insight]);
      expect(sheet.initiative).toBe(e.initiative);
      expect(Object.fromEntries(sheet.skills.map((s) => [s.name, s.bonus]))).toEqual(e.skills);
    });

    test(`${name}: attacks and spellcasting match`, () => {
      const sheet = buildSheet(load(name));
      // Every row the sheet shows is the one D&D Beyond shows, and all of them are there
      // (except the few the JSON cannot tell us about, listed in _omitted)
      const omitted = (expectedAttacks._omitted[name] || []).map((r: unknown[]) => r[0]);
      const shown = sheet.attacks.map((a) => [a.name, a.toHit, a.damage]);
      expect(shown.sort()).toEqual(expectedAttacks[name].filter((r: unknown[]) => !omitted.includes(r[0])).sort());
      expect(sheet.spellcasting.map((s) => [s.className, s.saveDc, s.attack])).toEqual(expectedAttacks._spellcasting[name]);
    });

    test(`${name}: armor class and speed match`, () => {
      const sheet = buildSheet(load(name));
      expect({ ac: sheet.ac, speed: sheet.speed }).toEqual({ ac: e.ac, speed: e.speed });
    });
  }
});

// Spell slots and spell rows read off the D&D Beyond Spells tab (checked 2026-10-20)
const expectedSpells: Record<string, any> = JSON.parse(readFileSync(new URL('./fixtures/dndbeyond/expected-spells.json', import.meta.url), 'utf8'));
const ABBR: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

test.describe('D&D Beyond spellbook', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  for (const [name, e] of Object.entries(expectedSpells).filter(([k]) => !k.startsWith('_'))) {
    test(`${name}: spell slots and pact slots match`, () => {
      const { spellbook } = buildSheet(load(name));
      expect(spellbook!.slots.map((s) => [s.level, s.total, s.used])).toEqual(e.slots);
      expect(spellbook!.pact && [spellbook!.pact.level, spellbook!.pact.total, spellbook!.pact.used]).toEqual(e.pact);
    });

    test(`${name}: the prepared spells are the ones D&D Beyond shows, with their numbers`, () => {
      const prepared = buildSheet(load(name)).spellbook!.spells.filter((s) => s.prepared);
      expect(prepared.map((s) => s.name).sort()).toEqual(e.names);
      // Spells D&D Beyond only shows upcast (a Warlock's at the pact level): hit/DC only
      const upcastOnly = new Set(e.rows.filter((r: unknown[]) => r[3] === 'upcast only').map((r: unknown[]) => r[0]));
      const rows = prepared.map((s) => [
        s.name, upcastOnly.has(s.name) ? null : s.level,
        s.toHit != null ? `+${s.toHit}` : s.saveDc != null ? `${ABBR[s.saveAbility!]} ${s.saveDc}` : null,
        upcastOnly.has(s.name) ? 'upcast only' : s.damage ?? s.healing,
      ]);
      expect(rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual(e.rows);
    });
  }

  test('characters without spells have no spellbook', () => {
    expect(buildSheet(load('moronur')).spellbook).toBeNull();
    expect(buildSheet(load('volrak')).spellbook).toBeNull();
  });

  test('a wizard keeps unprepared spells in the spellbook, after the prepared ones', () => {
    const { spells } = buildSheet(load('morrigan')).spellbook!;
    expect(spells.find((s) => s.name === 'Cone of Cold')).toMatchObject({ prepared: false, level: 5 });
    const fifth = spells.filter((s) => s.level === 5);
    expect(fifth.findIndex((s) => !s.prepared)).toBeGreaterThan(fifth.findLastIndex((s) => s.prepared));
  });

  test('spell rows carry what the table needs', () => {
    const { spells } = buildSheet(load('sinatah')).spellbook!;
    const byName = (n: string) => spells.find((s) => s.name === n)!;
    expect(byName('Hex')).toMatchObject({
      level: 1, school: 'Enchantment', source: 'Warlock', castingTime: '1 bonus action', range: '90 ft.',
      components: 'V, S, M (the petrified eye of a newt)', duration: '1 hour', concentration: true, ritual: false,
    });
    expect(byName('Burning Hands')).toMatchObject({ range: 'Self (15 ft. cone)', duration: 'Instantaneous', alwaysPrepared: true, source: 'Fiend Spells' });
    expect(byName('Fog Cloud')).toMatchObject({ source: 'Staff of Frost', uses: '1 charge' });
    expect(byName('Misty Step')).toMatchObject({ source: 'Fey Touched', uses: '1/LR' });
    expect(byName('Jump')).toMatchObject({ uses: 'At will' });
    expect(byName('Eldritch Blast').uses).toBe('');
    for (const s of spells) expect(s.description, s.name).not.toMatch(/<[a-z/]|&amp;|\{\{/);
    // Renamed on D&D Beyond: the sheet's name, and the spell it is
    expect(buildSheet(load('alvar')).spellbook!.spells.find((s) => s.name === 'Avada Kedavra')).toMatchObject({ baseName: 'Guiding Bolt' });
  });

  test('the sync adds subclass spells D&D Beyond keeps outside the character data', async () => {
    const data = load('alvar');
    const domain = data.data.alwaysPreparedSpells;
    delete data.data.alwaysPreparedSpells;
    const asked: string[] = [];
    await addSubclassSpells(data, async (url) => { asked.push(url); return { data: domain[0].spells }; });
    expect(asked).toEqual([expect.stringContaining('always-prepared-spells?classId=2190893&classLevel=12')]);
    expect(buildSheet(data).spellbook!.spells.map((s) => s.name)).toContain('Daylight');

    // D&D Beyond down: the sheet still builds, without those spells
    const offline = load('alvar');
    delete offline.data.alwaysPreparedSpells;
    await addSubclassSpells(offline, async () => { throw new Error('503'); });
    expect(buildSheet(offline).spellbook!.spells.map((s) => s.name)).not.toContain('Daylight');
  });
});
