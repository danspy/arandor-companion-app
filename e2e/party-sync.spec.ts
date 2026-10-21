import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// DM screen: "Sync all" in the party panel (/api/characters/sync-all) and the automatic sync
// when the DM screen opens. Runs only against a test server with a copy of the data
// (E2E_BASE_URL) and two accounts: E2E_DM / E2E_DM_PASSWORD (dungeonmaster) and
// E2E_PLAYER / E2E_PLAYER_PASSWORD (player). The endpoint test asks the real D&D Beyond once;
// the browser tests answer the sync requests themselves.

const DM = process.env.E2E_DM, DM_PASSWORD = process.env.E2E_DM_PASSWORD;
const PLAYER = process.env.E2E_PLAYER, PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD;
const SHOTS = process.env.E2E_SHOTS; // folder for screenshots of the panel, if set
if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

async function login(context: BrowserContext, username: string, password: string) {
  const res = await context.request.post('/api/auth/login', { data: { username, password } });
  expect(res.ok(), `login as ${username}`).toBe(true);
}

// The party rows that sync (have a D&D Beyond link), as the page lists them
const syncIds = (page: Page) => page.locator('#party-panel [data-sync-id]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.syncId!));

test.describe('Party sync on a test server', () => {
  test.skip(!DM || !DM_PASSWORD || !PLAYER || !PLAYER_PASSWORD, 'Needs E2E_DM/E2E_DM_PASSWORD and E2E_PLAYER/E2E_PLAYER_PASSWORD (test server only)');

  test('only the DM and admins may sync the whole party', async ({ browser, request, isMobile }) => {
    test.skip(isMobile, 'Once is enough');
    expect((await request.post('/api/characters/sync-all')).status()).toBe(401);
    const player = await browser.newContext();
    await login(player, PLAYER!, PLAYER_PASSWORD!);
    expect((await player.request.post('/api/characters/sync-all')).status()).toBe(403);
    await player.close();
  });

  test('syncs every linked party character from D&D Beyond, ignoring the 15 minutes', async ({ browser, isMobile }) => {
    test.skip(isMobile, 'Once is enough');
    test.setTimeout(60_000);
    const dm = await browser.newContext();
    await login(dm, DM!, DM_PASSWORD!);
    const page = await dm.newPage();
    await page.route('**/api/characters/auto-sync', (route) => route.fulfill({ json: { success: false } }));
    await page.goto('/tools/dm-screen');
    const ids = await syncIds(page);
    expect(ids.length).toBeGreaterThan(0);

    const started = Date.now();
    const res = await dm.request.post('/api/characters/sync-all');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: { id: string }) => r.id).sort()).toEqual([...ids].sort());
    expect(body.failed, JSON.stringify(body.results)).toEqual([]);
    expect(body.synced).toBe(ids.length);
    expect(new Date(body.syncedAt).getTime()).toBeGreaterThanOrEqual(started - 1000);
    // Right away again: no 15-minute throttle
    const again = await (await dm.request.post('/api/characters/sync-all')).json();
    expect(again.synced).toBe(ids.length);
    await dm.close();
  });

  test('Sync all: progress, result, refreshed panel, DM screen state kept', async ({ browser }, testInfo) => {
    const dm = await browser.newContext({ ...(testInfo.project.name === 'mobile' ? {} : { viewport: { width: 1280, height: 900 } }) });
    await login(dm, DM!, DM_PASSWORD!);
    const page = await dm.newPage();
    await page.route('**/api/characters/auto-sync', (route) => route.fulfill({ json: { success: false } }));
    await page.goto('/tools/dm-screen');
    const panel = page.locator('#party-panel');
    const button = panel.getByRole('button', { name: 'Sync all' });
    await expect(button).toBeVisible();
    await expect(panel.locator('[data-party-synced]')).toContainText(/synced/i);

    const ids = await syncIds(page);
    const names = await Promise.all(ids.map((id) => panel.locator(`tr[data-character-id="${id}"] .party-name a`).innerText()));
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    let calls = 0;
    await page.route('**/api/characters/sync-all', async (route) => {
      calls++;
      await held;
      await route.fulfill({ json: {
        synced: ids.length - 1,
        failed: [{ id: ids[0], name: names[0], error: 'Character not found or not public' }],
        results: ids.map((id, i) => ({ id, name: names[i], ok: i > 0 })),
        syncedAt: new Date().toISOString(),
      } });
    });

    // State on the DM screen that a page refresh would lose
    await page.locator('#timerMinutes').fill('17');
    await page.evaluate(() => { (window as any).__notReloaded = true; });
    await panel.evaluate((el) => el.setAttribute('data-before-sync', ''));

    await button.click();
    await expect(button).toBeDisabled();
    await expect(panel.locator('[data-party-sync-status]')).toContainText(/Syncing/);
    await button.click({ force: true }).catch(() => {}); // a second tap while running does nothing
    release();
    const status = page.locator('#party-panel [data-party-sync-status]');
    await expect(status).toHaveText(`Synced ${ids.length - 1} · 1 failed: ${names[0]}`);
    await expect(page.locator('#party-panel').getByRole('button', { name: 'Sync all' })).toBeEnabled();
    expect(calls).toBe(1);
    await expect(page.locator('#party-panel[data-before-sync]')).toHaveCount(0); // a fresh panel from the server
    expect(await page.evaluate(() => (window as any).__notReloaded)).toBe(true);
    await expect(page.locator('#timerMinutes')).toHaveValue('17');

    if (SHOTS) {
      await page.locator('#party-panel').scrollIntoViewIfNeeded();
      await page.locator('#party-panel').screenshot({ path: `${SHOTS}/sync-${testInfo.project.name === 'mobile' ? 'phone' : 'desktop'}.png` });
      if (testInfo.project.name !== 'mobile') {
        await page.setViewportSize({ width: 820, height: 1180 });
        await page.locator('#party-panel').screenshot({ path: `${SHOTS}/sync-tablet.png` });
      }
    }
    await dm.close();
  });

  test('opening the DM screen asks for the automatic sync of the party', async ({ browser, isMobile }) => {
    test.skip(isMobile, 'Once is enough');
    const dm = await browser.newContext();
    await login(dm, DM!, DM_PASSWORD!);
    const page = await dm.newPage();
    const asked: string[] = [];
    await page.route('**/api/characters/auto-sync', async (route) => {
      asked.push(route.request().postDataJSON().characterId);
      await route.fulfill({ json: { success: true, updated: false } });
    });
    await page.goto('/tools/dm-screen');
    const ids = await syncIds(page);
    await expect.poll(() => [...asked].sort()).toEqual([...ids].sort());
    await dm.close();
  });
});
