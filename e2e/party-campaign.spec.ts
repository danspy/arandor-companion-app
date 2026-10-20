import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildSheet } from '../src/lib/dndbeyond';
import { partyOverview } from '../src/lib/party';
import { characterCampaign } from '../src/lib/character-campaign';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/dndbeyond/${name}.json`, import.meta.url), 'utf8'));
const character = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, isActive: true, hp: 10, maxHp: 20, tempHp: 0, sheet: null, ...extra });

test.describe('Party panel', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('one row per active character, by name, with the sheet numbers', () => {
    const rows = partyOverview([
      character('s', 'Sinatah', { sheet: buildSheet(load('sinatah')) }),
      character('a', 'Alvar', { sheet: buildSheet(load('alvar')), tempHp: 5 }),
      character('x', 'Gone', { isActive: false }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Alvar', 'Sinatah']);
    const sinatah = buildSheet(load('sinatah'));
    expect(rows[1]).toMatchObject({
      id: 's', hp: 10, maxHp: 20, tempHp: 0, ac: sinatah.ac, initiative: sinatah.initiative, speed: sinatah.speed,
      passives: { perception: sinatah.passivePerception, investigation: sinatah.passiveInvestigation, insight: sinatah.passiveInsight },
    });
    expect(rows[1].saves).toEqual(Object.fromEntries(Object.entries(sinatah.saves).map(([k, v]) => [k, v.bonus])));
    expect(rows[0].tempHp).toBe(5);
    expect(rows[1].sheet).toEqual(sinatah); // for the sheet in the side panel
  });

  test('the best passive in each column is marked, ties included', () => {
    const sheet = (perception: number, investigation: number, insight: number) =>
      ({ ...buildSheet(load('barum')), passivePerception: perception, passiveInvestigation: investigation, passiveInsight: insight });
    const rows = partyOverview([
      character('a', 'A', { sheet: sheet(15, 12, 11) }),
      character('b', 'B', { sheet: sheet(15, 18, 10) }),
      character('c', 'C'),
    ]);
    expect(rows.map((r) => r.best)).toEqual([
      { perception: true, investigation: false, insight: true },
      { perception: true, investigation: true, insight: false },
      { perception: false, investigation: false, insight: false },
    ]);
  });

  test('a character without a D&D Beyond sheet has no numbers but still shows HP', () => {
    const [row] = partyOverview([character('c', 'Cleo')]);
    expect(row).toMatchObject({ hp: 10, maxHp: 20, ac: null, initiative: null, speed: null, passives: null, saves: null });
  });
});

test.describe('Campaign section', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  const diary = [
    { id: 'd1', session: 1, date: '2026-01-10', title: 'The road', characterIds: ['me'], questIds: ['q1'], npcIds: ['n2'] },
    { id: 'd2', session: 2, date: '2026-01-24', title: 'Without me', characterIds: ['other'], questIds: ['q2'], npcIds: ['n3'] },
    { id: 'd3', session: 3, date: '2026-02-07', title: 'The keep', characterIds: ['other', 'me'], questIds: ['q1', 'q3', 'gone'], npcIds: ['n1', 'n2'] },
  ];
  const quests = [
    { id: 'q1', title: 'Find the heir', status: 'completed' },
    { id: 'q2', title: 'Not mine', status: 'active' },
    { id: 'q3', title: 'Burn the keep', status: 'active' },
  ];
  const npcs = [
    { id: 'n1', name: 'Zara', relationship: 'enemy', avatarUrl: null },
    { id: 'n2', name: 'Bram', relationship: 'ally', avatarUrl: '/b.png' },
    { id: 'n3', name: 'Elsewhere', relationship: 'neutral', avatarUrl: null },
  ];
  const timeline = [
    { id: 't1', entryType: 'event', year: 1203, month: 5, sortOrder: 2, headline: 'Later', characterIds: ['me'] },
    { id: 't2', entryType: 'event', year: 1203, month: 2, sortOrder: 1, headline: 'Earlier', characterIds: ['me'] },
    { id: 't3', entryType: 'event', year: 1100, month: null, sortOrder: 0, headline: 'Not about me', characterIds: [] },
    { id: 't4', entryType: 'label', year: 1150, month: null, sortOrder: 0, headline: null, characterIds: ['me'] },
  ];

  test('sessions the character was in, newest first', () => {
    expect(characterCampaign('me', { diary, quests, npcs, timeline }).sessions)
      .toEqual([{ id: 'd3', session: 3, date: '2026-02-07', title: 'The keep' }, { id: 'd1', session: 1, date: '2026-01-10', title: 'The road' }]);
  });

  test('quests and NPCs from those sessions, once each; open quests first', () => {
    const c = characterCampaign('me', { diary, quests, npcs, timeline });
    expect(c.quests).toEqual([{ id: 'q3', title: 'Burn the keep', status: 'active' }, { id: 'q1', title: 'Find the heir', status: 'completed' }]);
    expect(c.npcs).toEqual([{ id: 'n2', name: 'Bram', relationship: 'ally', avatarUrl: '/b.png' }, { id: 'n1', name: 'Zara', relationship: 'enemy', avatarUrl: null }]);
  });

  test('timeline events linked to the character, in story order', () => {
    expect(characterCampaign('me', { diary, quests, npcs, timeline }).timeline)
      .toEqual([{ id: 't2', year: 1203, month: 2, headline: 'Earlier' }, { id: 't1', year: 1203, month: 5, headline: 'Later' }]);
  });

  test('a new character has empty lists', () => {
    expect(characterCampaign('new', { diary, quests, npcs, timeline })).toEqual({ sessions: [], quests: [], npcs: [], timeline: [] });
  });
});

const DM = process.env.E2E_DM_USER, DM_PASSWORD = process.env.E2E_DM_PASSWORD, CHARACTER = process.env.E2E_CHARACTER_ID;
if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Party panel and character notes on the server', () => {
  test.skip(!DM || !DM_PASSWORD || !CHARACTER, 'Needs E2E_DM_USER/E2E_DM_PASSWORD and E2E_CHARACTER_ID');
  test.skip(({ isMobile }) => isMobile, 'Once is enough');

  test('the DM screen shows the whole party', async ({ browser }) => {
    const context = await browser.newContext();
    expect((await context.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    const active = (await (await context.request.get('/api/characters')).json()).filter((c: { isActive: boolean }) => c.isActive);
    const page = await context.newPage();
    await page.goto('/tools/dm-screen');
    await expect(page.locator('#party-panel')).toBeVisible();
    await expect(page.locator('#party-panel tbody tr')).toHaveCount(active.length);
    await expect(page.locator(`#party-panel tr[data-character-id="${CHARACTER}"]`)).toBeVisible();
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('a party name opens the sheet in the side panel, and its rolls carry the name', async ({ browser }) => {
    const context = await browser.newContext();
    expect((await context.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    const page = await context.newPage();
    await page.goto('/tools/dm-screen');
    const link = page.locator('#party-panel [data-party-sheet]').first();
    const name = (await link.textContent())!.trim();
    await link.click();
    await expect(page).toHaveURL(/\/tools\/dm-screen/);
    const panel = page.locator('.sb-panel.is-open');
    await expect(panel.locator('.sb-panel-who')).toHaveText(name);
    await expect(panel.locator('#cs-strip')).toBeVisible();
    await expect(panel.locator('a', { hasText: 'Open' })).toHaveAttribute('href', `/characters/${await link.getAttribute('data-party-sheet')}`);

    const roll = panel.locator('.cs-roll').first();
    const what = await roll.getAttribute('data-roll-name');
    await roll.click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('arandor-dice-history') || '[]')[0]?.name), { timeout: 15000 })
      .toBe(`${name} · ${what}`);

    await link.click(); // the same name again closes it
    await expect(page.locator('.sb-panel.is-open')).toHaveCount(0);
  });

  test('only the player, the DM and admins read and write a character\'s notes', async ({ browser, page }) => {
    const visitor = await browser.newContext();
    expect((await visitor.request.put(`/api/characters/${CHARACTER}/notes`, { data: { content: 'hacked' } })).status()).toBe(401);

    const dm = await browser.newContext();
    expect((await dm.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    const before = await dm.request.put(`/api/characters/${CHARACTER}/notes`, { data: { content: '' } });
    expect(before.ok()).toBe(true);
    const text = `Owes Bram 20 gold <b>not bold</b> ${Date.now()}`;
    try {
      const dmPage = await dm.newPage();
      // No background sync refresh in the middle (other test files make the character due for one)
      await dmPage.route('**/api/characters/auto-sync', (route) => route.fulfill({ json: { success: false } }));
      await dmPage.goto(`/characters/${CHARACTER}`);
      await expect(dmPage.locator('#cs-campaign')).toBeVisible();
      // Long lists show the first few, "Show all" opens the rest
      const index = await dmPage.locator('#cs-campaign [data-cc-list]').evaluateAll((lists) => lists.findIndex((l) => l.querySelector('[data-cc-more]')));
      if (index >= 0) {
        const list = dmPage.locator('#cs-campaign [data-cc-list]').nth(index);
        await expect(list.locator('.cc-extra').first()).toBeHidden();
        await list.locator('[data-cc-more]').click();
        await expect(list.locator('.cc-extra').first()).toBeVisible();
      }
      await dmPage.locator('#cs-notes textarea').fill(text);
      await dmPage.locator('#cs-notes button[type="submit"]').click();
      await expect(dmPage.locator('#cs-notes [data-notes-status]')).toHaveText('Saved');
      await dmPage.reload();
      await expect(dmPage.locator('#cs-notes textarea')).toHaveValue(text);

      // Not on the page, the API or the timeline for a visitor
      await page.goto(`/characters/${CHARACTER}`);
      await expect(page.locator('#cs-campaign')).toBeVisible();
      await expect(page.locator('#cs-notes')).toHaveCount(0);
      expect(await page.content()).not.toContain('Owes Bram');
      expect(JSON.stringify(await (await visitor.request.get(`/api/characters/${CHARACTER}`)).json())).not.toContain('Owes Bram');
      expect(await (await visitor.request.get('/library/timeline')).text()).not.toContain('Owes Bram');
    } finally {
      await dm.request.put(`/api/characters/${CHARACTER}/notes`, { data: { content: '' } });
    }
  });

  test('a background sync does not refresh the page over unsaved notes', async ({ browser }) => {
    const dm = await browser.newContext();
    expect((await dm.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    const page = await dm.newPage();
    // The test's own sync reports a change, which normally refreshes the page (the one when the
    // page loads reports none, so it cannot refresh in between)
    let changed = false;
    await page.route('**/api/characters/auto-sync', (route) => route.fulfill({ json: { success: true, updated: changed } }));
    const loadSync = page.waitForResponse('**/api/characters/auto-sync');
    await page.goto(`/characters/${CHARACTER}`);
    await loadSync;
    changed = true;
    await page.locator('#cs-notes textarea').fill('typing, not saved yet');
    await page.evaluate(() => document.getElementById('cs-notes')!.setAttribute('data-e2e-old', ''));
    await page.evaluate((id) => window.arandorAutoSyncCharacters([id]), CHARACTER!);
    await page.waitForTimeout(1500);
    await expect(page.locator('#cs-notes[data-e2e-old]')).toHaveCount(1);
    await expect(page.locator('#cs-notes textarea')).toHaveValue('typing, not saved yet');

    // A refresh already on its way when typing starts: the new page keeps the text
    await page.route(`**/characters/${CHARACTER}`, async (route) => {
      const response = await route.fetch();
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({ response });
    });
    const refresh = page.evaluate(() => window.arandorSoftReload());
    await page.waitForTimeout(300);
    await page.locator('#cs-notes textarea').pressSequentially(' and more');
    await refresh;
    await expect(page.locator('#cs-notes[data-e2e-old]')).toHaveCount(0); // the page was swapped
    await expect(page.locator('#cs-notes textarea')).toHaveValue('typing, not saved yet and more');
    await expect(page.locator('#cs-notes [data-notes-status]')).toHaveText('Not saved yet');
  });

  test('notes have a size limit', async ({ browser }) => {
    const dm = await browser.newContext();
    expect((await dm.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
    expect((await dm.request.put(`/api/characters/${CHARACTER}/notes`, { data: { content: 'x'.repeat(20_001) } })).status()).toBe(400);
    expect((await dm.request.put(`/api/characters/${CHARACTER}/notes`, { data: { content: 42 } })).status()).toBe(400);
    expect((await dm.request.put('/api/characters/no-such-character/notes', { data: { content: 'x' } })).status()).toBe(404);
  });
});
