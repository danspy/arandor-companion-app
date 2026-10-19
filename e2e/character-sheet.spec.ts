import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildSheet } from '../src/lib/dndbeyond';
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
    const list = await (await visitor.request.get('/api/characters')).json();
    expect(list.every((c: Record<string, unknown>) => !('sheet' in c))).toBe(true);
    const dmView = await (await dm.request.get(`/api/characters/${CHARACTER}`)).json();
    expect(dmView.sheet.inventory.length).toBeGreaterThan(0);
  });
});

test.describe('Character sheet page', () => {
  test.skip(!DM || !DM_PASSWORD || !CHARACTER, 'Needs E2E_DM_USER/E2E_DM_PASSWORD and E2E_CHARACTER_ID');

  test('the DM rolls from the sheet and sees the private sections', async ({ browser }) => {
    const context = await browser.newContext();
    expect((await context.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    const page = await context.newPage();
    await page.goto(`/characters/${CHARACTER}`);
    for (const id of ['#cs-strip', '#cs-abilities', '#cs-skills', '#cs-attacks', '#cs-features', '#cs-inventory']) await expect(page.locator(id)).toBeVisible();

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
  });

  test('a visitor sees stats and core rolls but not the private sections', async ({ page }) => {
    await page.goto(`/characters/${CHARACTER}`);
    await expect(page.locator('#cs-strip')).toBeVisible();
    await expect(page.locator('#cs-abilities .cs-roll[data-roll-name="Dexterity save"]')).toBeVisible();
    const html = await page.content();
    for (const id of ['cs-skills', 'cs-attacks', 'cs-features', 'cs-inventory']) expect(html).not.toContain(`id="${id}"`);
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
