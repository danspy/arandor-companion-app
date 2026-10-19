import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abilityScores, buildSheet, calculateHitPoints } from '../src/lib/dndbeyond';

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

test.describe('D&D Beyond features and inventory', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('features are short plain text', () => {
    const { features } = buildSheet(load('moronur'));
    const names = features.map((f) => f.name);
    expect(names).toContain('Stunning Strike');
    expect(names).toContain('Tough');
    expect(names).not.toContain('Ability Score Improvement');
    for (const f of features) {
      expect(f.description, f.name).not.toMatch(/[<>]|&amp;|\{\{/);
      expect(f.description.length, f.name).toBeLessThanOrEqual(300);
    }
  });

  test('inventory lists equipped items first, with attunement', () => {
    const { inventory } = buildSheet(load('alvar'));
    expect(inventory.find((i) => i.name === 'Ring of the Ram')).toMatchObject({ equipped: true, attuned: true });
    expect(inventory.find((i) => i.name === 'Potion of Healing')).toMatchObject({ equipped: false });
    const firstUnequipped = inventory.findIndex((i) => !i.equipped);
    expect(inventory.slice(firstUnequipped).every((i) => !i.equipped)).toBe(true);
  });
});
