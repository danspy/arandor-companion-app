import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { attackParts, findRolls, importStatBlock, nextCopyNumbers, validateCreature } from '../src/lib/statblock';
import { applyHpChange } from '../src/lib/hp';

// Bestiary (phase A): paste import, stat blocks, rolls, quick add, damage/heal.
// The logged-in tests change the initiative tracker and the bestiary, so they only run against
// a test server with a copy of the data and two accounts (never dev, preview or live data):
//   E2E_DM / E2E_DM_PASSWORD (dungeonmaster)   E2E_PLAYER / E2E_PLAYER_PASSWORD (player)

const fixture = (name: string) => readFileSync(new URL(`./fixtures/statblocks/${name}.txt`, import.meta.url), 'utf8');

test.describe('Stat block import', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('reads a 2024 goblin with its ability table cell by cell', () => {
    const { creature: c, unread } = importStatBlock(fixture('goblin-warrior'));
    expect(unread).toEqual([]);
    expect(c).toMatchObject({ name: 'Goblin Warrior', typeLine: 'Small Fey (Goblinoid), Chaotic Neutral', ac: 15, initiative: 2, hp: 10, hpFormula: '3d6', speed: '30 ft.', cr: '1/4', xp: 50 });
    expect(c.abilities).toEqual({
      str: { score: 8, mod: -1, save: -1 }, dex: { score: 15, mod: 2, save: 2 }, con: { score: 10, mod: 0, save: 0 },
      int: { score: 10, mod: 0, save: 0 }, wis: { score: 8, mod: -1, save: -1 }, cha: { score: 8, mod: -1, save: -1 },
    });
    expect(c.details.map((d) => d.label)).toEqual(['Skills', 'Gear', 'Senses', 'Languages']);
    expect(c.sections.map((s) => [s.title, s.entries.map((e) => e.name)])).toEqual([['Actions', ['Scimitar', 'Shortbow']], ['Bonus Actions', ['Nimble Escape']]]);
  });

  test('reads a dragon: saves, legendary actions with intro, recharge, spell lists', () => {
    const { creature: c, unread } = importStatBlock(fixture('adult-red-dragon'));
    expect(unread).toEqual([]);
    expect(c).toMatchObject({ ac: 19, initiative: 12, hp: 256, hpFormula: '19d12 + 133', cr: '17', xp: 18000 });
    expect(c.abilities.dex).toEqual({ score: 10, mod: 0, save: 6 });
    const legendary = c.sections.find((s) => s.title === 'Legendary Actions')!;
    expect(legendary.intro).toMatch(/^Legendary Action Uses: 3/);
    expect(legendary.entries.map((e) => e.name)).toEqual(['Commanding Presence', 'Fiery Rays', 'Pounce']);
    const actions = c.sections.find((s) => s.title === 'Actions')!.entries;
    expect(actions.map((e) => e.name)).toEqual(['Multiattack', 'Rend', 'Fire Breath (Recharge 5–6)', 'Spellcasting']);
    expect(actions[3].text.split('\n')).toHaveLength(3); // spell lists stay with Spellcasting
  });

  test('reads a mage pasted with Windows line ends; reactions and per-day names', () => {
    const { creature: c, unread } = importStatBlock(fixture('mage'));
    expect(unread).toEqual([]);
    expect(c.typeLine).toBe('Medium or Small Humanoid (Wizard), Neutral');
    expect(c.abilities.int).toEqual({ score: 17, mod: 3, save: 6 });
    expect(c.sections.map((s) => s.title)).toEqual(['Actions', 'Bonus Actions', 'Reactions']);
    expect(c.sections[2].entries[0].name).toBe('Protective Magic (3/Day)');
  });

  test('lines it cannot place are reported and kept in the notes', () => {
    const { creature, unread } = importStatBlock(`${fixture('goblin-warrior').replace('Speed 30 ft.', 'Speed 30 ft.\nHabitat Forest, Grassland')}`);
    expect(unread).toEqual(['Habitat Forest, Grassland']);
    expect(creature.notes).toContain('Habitat Forest, Grassland');
  });

  test('finds the rolls in action text', () => {
    const scimitar = 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.';
    expect(findRolls(scimitar).map((r) => [r.kind, r.label, r.expr, !!r.conditional])).toEqual([
      ['attack', 'To hit', '1d20+4', false], ['damage', 'Slashing', '1d6+2', false], ['damage', 'Slashing', '1d4', true],
    ]);
    expect(attackParts(scimitar)).toEqual([{ label: 'To hit', expr: '1d20+4' }, { label: 'Slashing', expr: '1d6+2' }]);
    expect(attackParts('Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.')).toEqual([
      { label: 'To hit', expr: '1d20+14' }, { label: 'Slashing', expr: '1d10+8' }, { label: 'Fire', expr: '2d4' },
    ]);
    expect(attackParts('Melee Attack Roll: −1, reach 5 ft. Hit: 1 (1d4 − 1) Bludgeoning damage.')).toEqual([{ label: 'To hit', expr: '1d20-1' }, { label: 'Bludgeoning', expr: '1d4-1' }]);
    expect(attackParts('The dragon makes three Rend attacks.')).toBeNull();
    expect(findRolls('(spell save DC 21, +13 to hit with spell attacks)')[0]).toMatchObject({ kind: 'attack', label: 'Spell attack', expr: '1d20+13' });
    expect(findRolls('Failure: 59 (17d6) Fire damage. Success: Half damage.')[0]).toMatchObject({ kind: 'damage', label: 'Fire', expr: '17d6' });
    expect(findRolls('The troll regains 15 (3d10) Hit Points.')[0]).toMatchObject({ kind: 'dice', expr: '3d10' });
  });

  test('damage takes temp HP first and stops at 0; healing stops at max', () => {
    expect(applyHpChange({ hp: 10, maxHp: 10, tempHp: 5 }, 'damage', 7)).toEqual({ hp: 8, tempHp: 0, resetDeathSaves: false });
    expect(applyHpChange({ hp: 4, maxHp: 10, tempHp: 0 }, 'damage', 9)).toEqual({ hp: 0, tempHp: 0, resetDeathSaves: false });
    expect(applyHpChange({ hp: 4, maxHp: 10, tempHp: 3 }, 'heal', 20)).toEqual({ hp: 10, tempHp: 3, resetDeathSaves: true });
    expect(applyHpChange({ hp: 0, maxHp: null, tempHp: null }, 'heal', 6)).toEqual({ hp: 6, tempHp: 0, resetDeathSaves: true });
  });

  test('numbers copies after the ones already in the fight', () => {
    expect(nextCopyNumbers('Goblin', [], 3)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3']);
    expect(nextCopyNumbers('Goblin', ['Goblin 1', 'Goblin 4', 'Thalia'], 2)).toEqual(['Goblin 5', 'Goblin 6']);
    expect(nextCopyNumbers('Ogre', [], 1)).toEqual(['Ogre']);
  });

  test('validation cleans what it stores and explains what it refuses', () => {
    const ok = validateCreature({ ...importStatBlock(fixture('goblin-warrior')).creature, extra: 'ignored' });
    expect(ok.ok && ok.creature.name).toBe('Goblin Warrior');
    expect(validateCreature({ name: '' })).toEqual({ ok: false, error: 'The creature needs a name' });
    expect(validateCreature({ name: 'X', ac: 99 })).toMatchObject({ ok: false, error: expect.stringContaining('AC') });
    expect(validateCreature({ name: 'X', sections: [{ title: 'Actions', entries: [{ name: '', text: 'nameless' }] }] })).toMatchObject({ ok: false });
    expect(validateCreature({ name: 'X', sections: [{ title: 'Actions', entries: [{ name: 'Bite', text: 'x'.repeat(5001) }] }] })).toMatchObject({ ok: false, error: expect.stringContaining('too long') });
  });
});

// ── Against a test server ────────────────────────────────────────────────────

const DM = process.env.E2E_DM, DM_PASSWORD = process.env.E2E_DM_PASSWORD;
const PLAYER = process.env.E2E_PLAYER, PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD;

async function login(context: BrowserContext, username: string, password: string) {
  const res = await context.request.post('/api/auth/login', { data: { username, password } });
  expect(res.ok(), `login as ${username}`).toBe(true);
}

// Dice land on chosen values (reduced motion uses crypto.getRandomValues: n gives n)
async function fixDice(page: Page, values: number[]) {
  await page.evaluate((vals) => {
    (window as any).__dice = [...vals];
    const real = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = ((arr: Uint32Array) => {
      const q = (window as any).__dice as number[];
      if (arr instanceof Uint32Array && arr.length === 1 && q.length) {
        arr[0] = q.shift()! - 1;
        return arr;
      }
      return real(arr);
    }) as typeof crypto.getRandomValues;
  }, values);
}

test.describe('Bestiary on a test server', () => {
  test.skip(!DM || !DM_PASSWORD || !PLAYER || !PLAYER_PASSWORD, 'Needs E2E_DM/E2E_DM_PASSWORD and E2E_PLAYER/E2E_PLAYER_PASSWORD (test server only)');
  test.skip(({ isMobile }) => isMobile, 'Desktop flow');
  test.describe.configure({ mode: 'serial' });

  test('access: stat blocks are for the DM only and never reach players', async ({ browser, request }) => {
    expect((await request.get('/api/creatures')).status()).toBe(401);
    const player = await browser.newContext();
    await login(player, PLAYER!, PLAYER_PASSWORD!);
    expect((await player.request.get('/api/creatures')).status()).toBe(403);
    expect((await player.request.post('/api/creatures', { data: { name: 'Sneaky' } })).status()).toBe(403);
    const page = await player.newPage();
    await page.goto('/tools/bestiary');
    expect(new URL(page.url()).pathname).not.toContain('/tools/bestiary'); // sent away (login → home)

    const dm = await browser.newContext();
    await login(dm, DM!, DM_PASSWORD!);
    const created = await dm.request.post('/api/creatures', { data: importStatBlock(fixture('goblin-warrior')).creature });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const bad = await dm.request.put(`/api/creatures/${id}`, { data: { name: 'Goblin', ac: 99 } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toContain('AC');

    // A combatant from it: the player view has no creatureId, and players can't damage it
    const entry = await (await dm.request.post('/api/initiative', { data: { name: 'Test Goblin', initiative: 12, type: 'monster', hp: 10, maxHp: 10, creatureId: id } })).json();
    expect(entry.creatureId).toBe(id);
    const seen = await (await player.request.get('/api/initiative')).json();
    const mine = seen.find((e: any) => e.id === entry.id);
    expect(mine).toBeTruthy();
    expect(mine).not.toHaveProperty('creatureId');
    expect((await player.request.post(`/api/initiative/${entry.id}/hp`, { data: { kind: 'damage', amount: 3 } })).status()).toBe(403);
    // Editing the entry in the tracker form (which doesn't send creatureId) keeps the link
    const edited = await (await dm.request.put(`/api/initiative/${entry.id}`, { data: { name: 'Test Goblin', initiative: 13, type: 'monster', hp: 10, maxHp: 10 } })).json();
    expect(edited.creatureId).toBe(id);
    // Deleting the stat block keeps the combatant, without the link
    expect((await dm.request.delete(`/api/creatures/${id}`)).ok()).toBe(true);
    const after = await (await dm.request.get(`/api/initiative/${entry.id}`)).json();
    expect(after.creatureId).toBeNull();
    await dm.request.delete(`/api/initiative/${entry.id}`);
    await player.close();
    await dm.close();
  });

  test('paste, save, roll, quick add, stat block in the fight, damage and heal', async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await login(context, DM!, DM_PASSWORD!);
    const page = await context.newPage();
    const before = new Set(((await (await context.request.get('/api/initiative')).json()) as any[]).map((e) => e.id));

    // Paste and save
    await page.goto('/tools/bestiary/new');
    await page.locator('#pasteText').fill(fixture('goblin-warrior'));
    await page.getByRole('button', { name: 'Read' }).click();
    await expect(page.locator('#pasteResult')).toContainText('Read Goblin Warrior: 6/6 abilities, 4 details, 3 traits and actions');
    await expect(page.locator('#creaturePreview .sb-name')).toHaveText('Goblin Warrior');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL(/\/tools\/bestiary\/[0-9a-f-]{36}$/);
    const creatureId = page.url().split('/').pop()!;

    // Attack with fixed dice: d6 first, then the d20 (the fallback rolls by die size) → 17+4, 3+2
    await fixDice(page, [3, 17]);
    await page.locator('.statblock .sb-attack', { hasText: 'Scimitar' }).click();
    const banner = page.locator('#dice-result-banner .dice-banner-card');
    await expect(banner).toContainText('Goblin Warrior · Scimitar');
    await expect(banner).toContainText('To hit');
    await expect(banner).toContainText('21');
    await expect(banner).toContainText('Slashing');
    await banner.click();

    // Quick add 3 with overridden HP
    await page.getByRole('button', { name: 'Add to fight' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Add Goblin Warrior to initiative/ });
    await dialog.getByLabel('How many').fill('3');
    await expect(dialog.locator('.qa-roll')).toHaveCount(3);
    await dialog.getByLabel('HP each').fill('12');
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('#addedStatus')).toContainText('3 × Goblin Warrior added to the fight');
    const added = ((await (await context.request.get('/api/initiative')).json()) as any[]).filter((e) => !before.has(e.id));
    expect(added.map((e) => e.name).sort()).toEqual(expect.arrayContaining([expect.stringMatching(/^Goblin Warrior \d+$/)]));
    expect(added).toHaveLength(3);
    for (const e of added) {
      expect(e).toMatchObject({ type: 'monster', hp: 12, maxHp: 12, ac: 15, creatureId });
      expect(e.initiative).toBeGreaterThanOrEqual(3);
      expect(e.initiative).toBeLessThanOrEqual(22);
    }

    // In the tracker: stat block panel with rolls, then damage and heal
    await page.goto('/tools/initiative');
    const card = page.locator(`.initiative-card[data-entry-id="${added[0].id}"]`);
    await card.getByRole('button', { name: `Stat block of ${added[0].name}` }).click();
    const panel = page.locator('.sb-panel.is-open');
    await expect(panel.locator('.sb-name')).toHaveText('Goblin Warrior');
    await expect(panel).toContainText(`${added[0].name} · stat block`);
    await panel.getByRole('button', { name: 'Close the stat block' }).click();
    await expect(page.locator('.sb-panel.is-open')).toHaveCount(0);

    await card.getByLabel(`Damage or healing for ${added[0].name}`).fill('5');
    await card.getByRole('button', { name: `Damage ${added[0].name}` }).click();
    await expect(card.locator('[data-hp-display]')).toHaveText('7/12');
    await card.getByLabel(`Damage or healing for ${added[0].name}`).fill('20');
    await card.getByRole('button', { name: `Heal ${added[0].name}` }).click();
    await expect(card.locator('[data-hp-display]')).toHaveText('12/12');

    // DM screen: the combatant whose turn it is has its stat block one click away
    for (const e of added) await context.request.put(`/api/initiative/${e.id}`, { data: { ...e, initiative: 99 } });
    await context.request.post('/api/combat-state', { data: { action: 'new-fight' } }); // round 1, first in order
    await page.goto('/tools/dm-screen');
    const current = page.locator('#currentTurnContent');
    await expect(current.locator('.statblock-btn')).toBeVisible(); // loaded
    const who = (await current.locator('.font-semibold').first().innerText()).trim();
    // Damage from the turn preview…
    await current.getByLabel(`Damage or healing for ${who}`).fill('4');
    await current.getByRole('button', { name: `Damage ${who}` }).click();
    const afterDamage = '8/12'; // every goblin is at 12 here
    await expect(current.locator('[data-hp-of]')).toHaveText(afterDamage);
    // …and healing from the stat block panel, which shows the same combatant's HP
    await current.locator('.statblock-btn').click();
    const dmPanel = page.locator('.sb-panel.is-open');
    await expect(dmPanel.locator('.sb-name')).toHaveText('Goblin Warrior');
    await expect(dmPanel.locator('[data-hp-of]')).toHaveText(afterDamage);
    await dmPanel.getByLabel(`Damage or healing for ${who}`).fill('2');
    await dmPanel.getByRole('button', { name: `Heal ${who}` }).click();
    const healed = '10/12';
    await expect(dmPanel.locator('[data-hp-of]')).toHaveText(healed);
    await expect(current.locator('[data-hp-of]')).toHaveText(healed);

    // Clean up
    await context.request.put('/api/combat-state', { data: { status: 'stopped' } });
    for (const e of added) await context.request.delete(`/api/initiative/${e.id}`);
    await context.request.delete(`/api/creatures/${creatureId}`);
    await context.close();
  });
});
