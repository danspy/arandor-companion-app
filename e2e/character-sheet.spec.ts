import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildSheet, parseDnDBeyondCharacter } from '../src/lib/dndbeyond';
import { canSeePrivateSheet, publicSheet, withoutSheet } from '../src/lib/character-sheet';

// Who sees which part of the character sheet. The logged-in browser tests need a server under
// test with a known DM account (never live data): E2E_DM_USER / E2E_DM_PASSWORD and a character
// id E2E_CHARACTER_ID that has a D&D Beyond URL. They are skipped when those are not set.

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/dndbeyond/${name}.json`, import.meta.url), 'utf8'));

test.describe('Character sheet visibility', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('the public part holds only the public numbers', () => {
    const sheet = buildSheet(load('moronur'));
    expect(Object.keys(publicSheet(sheet)!).sort()).toEqual(['ac', 'initiative', 'passivePerception', 'proficiencyBonus', 'saves', 'speed', 'version']);
    expect(publicSheet(null)).toBeNull();
    expect(withoutSheet({ id: 'c1', name: 'X', sheet })).toEqual({ id: 'c1', name: 'X' });
  });

  test('an odd piece of sheet data does not stop HP and stats from syncing', () => {
    const data = load('barum');
    data.data.classSpells[0].spells.push(null);
    const parsed = parseDnDBeyondCharacter(data);
    expect(parsed.maxHp).toBe(62);
    expect(parsed.stats?.intelligence).toBe(20);
  });

  test('the player, the DM and admins see the private part', () => {
    const character = { id: 'c1', userId: 'u1' };
    expect(canSeePrivateSheet(character, { id: 'u1' }, 'player')).toBe(true);
    expect(canSeePrivateSheet({ id: 'c1', userId: null }, { id: 'u2', characterIds: ['c1'] }, 'player')).toBe(true); // legacy owner
    expect(canSeePrivateSheet(character, { id: 'u9' }, 'dungeonmaster')).toBe(true);
    expect(canSeePrivateSheet(character, { id: 'u9' }, 'admin')).toBe(true);
    expect(canSeePrivateSheet(character, { id: 'u2' }, 'player')).toBe(false);
    expect(canSeePrivateSheet(character, null, null)).toBe(false);
    expect(canSeePrivateSheet({ id: 'c1', userId: null }, { id: 'u2' }, 'player')).toBe(false); // unowned: nobody's private sheet
  });
});

const DM = process.env.E2E_DM_USER, DM_PASSWORD = process.env.E2E_DM_PASSWORD, CHARACTER = process.env.E2E_CHARACTER_ID;
if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Character sheet on the server', () => {
  test.skip(!DM || !DM_PASSWORD || !CHARACTER, 'Needs E2E_DM_USER/E2E_DM_PASSWORD and E2E_CHARACTER_ID');
  test.skip(({ isMobile }) => isMobile, 'Once is enough');

  test('a visitor gets no private sheet from the API', async ({ browser }) => {
    const dm = await browser.newContext();
    expect((await dm.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    const synced = await dm.request.post('/api/characters/sync', { data: { characterId: CHARACTER } });
    expect(synced.ok()).toBe(true);
    expect((await synced.json()).sheet.skills).toHaveLength(18);

    const visitor = await browser.newContext();
    const one = await (await visitor.request.get(`/api/characters/${CHARACTER}`)).json();
    expect(one.sheet.saves.str).toBeDefined();
    expect(one.sheet.skills).toBeUndefined();
    expect(one.sheet.attacks).toBeUndefined();
    expect(one.sheet.spellbook).toBeUndefined();
    const list = await (await visitor.request.get('/api/characters')).json();
    expect(list.every((c: Record<string, unknown>) => !('sheet' in c))).toBe(true);
    const dmView = await (await dm.request.get(`/api/characters/${CHARACTER}`)).json();
    expect(dmView.sheet.attacks.length).toBeGreaterThan(0);
    expect(dmView.sheet).not.toHaveProperty('inventory');
    // Public pages that hand character data to the browser
    const timeline = await (await visitor.request.get('/library/timeline')).text();
    expect(timeline).not.toContain('"skills"');
    expect(timeline).not.toContain('"spellbook"');
  });

  test('the automatic sync runs once per character, even when asked many times at once', async ({ browser }) => {
    const dm = await browser.newContext();
    expect((await dm.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    const character = await (await dm.request.get(`/api/characters/${CHARACTER}`)).json();
    const url = character.dndbeyondUrl as string;
    try {
      // A new D&D Beyond link makes the character due for a sync right away
      await dm.request.put(`/api/characters/${CHARACTER}`, { data: { ...character, dndbeyondUrl: `${url}?e2e` } });
      const visitor = await browser.newContext();
      const answers = await Promise.all(Array.from({ length: 8 }, () =>
        visitor.request.post('/api/characters/auto-sync', { data: { characterId: CHARACTER } }).then((r) => r.json())));
      expect(answers.filter((a) => a.success)).toHaveLength(1);
    } finally {
      await dm.request.put(`/api/characters/${CHARACTER}`, { data: { ...character, dndbeyondUrl: url } });
      await dm.request.post('/api/characters/sync', { data: { characterId: CHARACTER } });
    }
  });

  test('D&D Beyond wins over ability scores edited by hand', async ({ browser }) => {
    const dm = await browser.newContext();
    expect((await dm.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    const synced = await (await dm.request.post('/api/characters/sync', { data: { characterId: CHARACTER } })).json();
    const edited = await dm.request.put(`/api/characters/${CHARACTER}`, { data: { ...synced, stats: { ...synced.stats, dexterity: 3 } } });
    expect((await edited.json()).statsManuallyEdited).toBe(true);
    const again = await (await dm.request.post('/api/characters/sync', { data: { characterId: CHARACTER } })).json();
    expect(again.stats).toEqual(synced.stats);
    expect(again.statsManuallyEdited).toBe(false);
  });
});

test.describe('Character sheet page', () => {
  test.skip(!DM || !DM_PASSWORD || !CHARACTER, 'Needs E2E_DM_USER/E2E_DM_PASSWORD and E2E_CHARACTER_ID');

  test('the DM rolls from the sheet and sees the private sections', async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext();
    expect((await context.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    expect((await context.request.post('/api/characters/sync', { data: { characterId: CHARACTER } })).ok()).toBe(true);
    const page = await context.newPage();
    await page.goto(`/characters/${CHARACTER}`);
    for (const id of ['#cs-strip', '#cs-abilities', '#cs-skills', '#cs-attacks']) await expect(page.locator(id)).toBeVisible();
    await expect(page.locator('#cs-features, #cs-inventory')).toHaveCount(0);

    const name = await page.locator('#character-page').getAttribute('data-character-name');
    const stealth = page.locator('#cs-skills .cs-roll[data-roll-name="Stealth"]');
    const expr = await stealth.getAttribute('data-roll');
    expect(expr).toMatch(/^1d20[+-]\d+$/);
    await stealth.click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('arandor-dice-history') || '[]')[0]?.name), { timeout: 15000 })
      .toBe(`${name} · Stealth`);

    // Advantage applies to the next d20 roll only
    await page.locator('#cs-abilities [data-roll-mode="advantage"]').click();
    await expect(page.locator('#cs-skills [data-roll-mode="advantage"]')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForFunction(() => !document.querySelector('#dice-overlay.is-rolling'));
    await page.locator('#cs-abilities .cs-roll[data-roll-name="Strength check"]').click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('arandor-dice-history') || '[]')[0]), { timeout: 15000 })
      .toMatchObject({ name: `${name} · Strength check`, mode: 'advantage' });
    await expect(page.locator('#cs-abilities [data-roll-mode="normal"]')).toHaveAttribute('aria-pressed', 'true');

    await page.waitForFunction(() => !document.querySelector('#dice-overlay.is-rolling'));
    const sheet = (await (await context.request.get(`/api/characters/${CHARACTER}`)).json()).sheet;
    if (sheet.spellbook) {
      await expect(page.locator('#cs-spellbook')).toBeVisible();
      await expect(page.locator('#cs-spellbook .cs-spell')).toHaveCount(sheet.spellbook.spells.length);
      // A roll button in the row rolls without opening it; the row itself opens the description
      const row = page.locator('#cs-spellbook .cs-spell').filter({ has: page.locator('.cs-roll') }).first();
      const spell = (await row.locator('.cs-roll').first().getAttribute('data-roll-name'))!;
      await row.locator('.cs-roll').first().click();
      await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('arandor-dice-history') || '[]')[0]?.name), { timeout: 15000 })
        .toBe(`${name} · ${spell}`);
      await expect(row).not.toHaveAttribute('open', '');
      await page.waitForFunction(() => !document.querySelector('#dice-overlay.is-rolling'));
      await row.locator('.cs-spell-name').click();
      await expect(row.locator('.cs-spell-body')).toBeVisible();
    }
  });

  test('a visitor sees stats and core rolls but not the private sections', async ({ page }) => {
    await page.goto(`/characters/${CHARACTER}`);
    await expect(page.locator('#cs-strip')).toBeVisible();
    await expect(page.locator('#cs-abilities .cs-roll[data-roll-name="Dexterity save"]')).toBeVisible();
    const html = await page.content();
    for (const id of ['cs-skills', 'cs-attacks', 'cs-spellbook']) expect(html).not.toContain(`id="${id}"`);
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
