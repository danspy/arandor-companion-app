import { test, expect, type Page } from '@playwright/test';

// The DM screen's floating live preview of the player display: /display?preview in a scaled
// iframe, draggable to any corner and minimisable.
// The DM-screen tests need a dungeonmaster account on the server under test (never live data):
//   E2E_DM / E2E_DM_PASSWORD
// They are skipped when those are not set. They change the DM screen state (spotlight).

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

const DM = process.env.E2E_DM, DM_PASSWORD = process.env.E2E_DM_PASSWORD;
const STORAGE_KEY = 'arandor:dm-display-preview';

const STATE = {
  screenVisible: true, wallpaperUrl: null, backdropUrl: null, location: null,
  npcs: [{ id: 'npc-1', name: 'Runara', subtitle: 'Äbtässin', avatarUrl: null }],
  initiative: null, timer: null,
};

// Counts wake lock requests and full-screen attempts made by the page
async function watchTvCalls(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__wakeLocks = 0;
    w.__fullscreens = 0;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: async () => { w.__wakeLocks++; return { release: async () => {}, addEventListener() {} }; } },
    });
    Element.prototype.requestFullscreen = async function () { w.__fullscreens++; };
  });
  await page.route('**/api/display', (route) => route.fulfill({ json: STATE }));
}

test.describe('Player display in preview mode', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop conveniences only');

  test('the TV display keeps the screen awake and goes full screen on F', async ({ page }) => {
    await watchTvCalls(page);
    await page.goto('/display');
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage');
    await expect.poll(() => page.evaluate(() => (window as any).__wakeLocks)).toBeGreaterThan(0);
    await page.keyboard.press('f');
    await expect.poll(() => page.evaluate(() => (window as any).__fullscreens)).toBe(1);
  });

  test('the preview never asks for a wake lock, full screen or the F hint', async ({ page }) => {
    await watchTvCalls(page);
    await page.goto('/display?preview');
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage');
    await expect(page.locator('#cast .dsp-portrait-name')).toHaveText('Runara');
    await page.keyboard.press('f');
    await page.mouse.dblclick(400, 300);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.mouse.move(200, 200);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => [(window as any).__wakeLocks, (window as any).__fullscreens])).toEqual([0, 0]);
    await expect(page.locator('#hint')).not.toHaveClass(/is-shown/);
  });

  test('the preview draws no idle sparks', async ({ page }) => {
    const idle = { ...STATE, npcs: [] };
    await page.route('**/api/display', (route) => route.fulfill({ json: idle }));
    // The sparks canvas is sized to the screen once they run (an unused canvas stays 300 wide)
    await page.goto('/display');
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'idle');
    await expect.poll(() => page.evaluate(() => (document.getElementById('idleSparks') as HTMLCanvasElement).width)).not.toBe(300);
    await page.goto('/display?preview');
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'idle');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (document.getElementById('idleSparks') as HTMLCanvasElement).width)).toBe(300);
  });
});

test.describe('DM screen display preview', () => {
  test.skip(!DM || !DM_PASSWORD, 'Needs E2E_DM/E2E_DM_PASSWORD (test server only)');

  test.beforeEach(async ({ page }) => {
    const res = await page.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } });
    expect(res.ok(), 'login').toBe(true);
  });

  const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 640;
  const pip = (page: Page) => page.locator('#displayPreview');
  const frame = (page: Page) => page.locator('#displayPreviewFrame');

  // Drags with touch-like pointer events (mouse on desktop; Playwright's mouse also drives
  // pointer events on the mobile project)
  async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
  }

  test('floats above the dice button and shows the spotlight a few seconds after it changes', async ({ page }) => {
    const npcs = (await (await page.request.get('/api/npcs')).json()) as { id: string; name: string }[];
    test.skip(npcs.length < 2, 'Needs two NPCs in the test data');
    const put = (data: object) => page.request.put('/api/dm-screen', { data });
    await put({ screenVisible: true, npcsHidden: false, spotlightNpcIds: [npcs[0].id], focusNpcIds: [] });

    await page.goto('/tools/dm-screen');
    // A fresh browser: open everywhere but on phones, bottom right
    await expect(pip(page)).toHaveAttribute('data-corner', 'br');
    if (isPhone(page)) {
      await expect(pip(page)).toHaveAttribute('data-state', 'min');
      await page.locator('#displayPreviewPill').click();
    }
    await expect(pip(page)).toHaveAttribute('data-state', 'open');
    await expect(pip(page)).toHaveCSS('position', 'fixed');
    const inside = page.frameLocator('#displayPreviewFrame');
    await expect(inside.locator('#cast .dsp-portrait-name')).toHaveText([npcs[0].name]);

    await put({ spotlightNpcIds: [npcs[0].id, npcs[1].id] });
    await expect(inside.locator('#cast > li:not(.is-leaving) .dsp-portrait-name')).toHaveText([npcs[0].name, npcs[1].name], { timeout: 6_000 });

    // Rendered like the TV (1920×1080), scaled down to fit the window
    const fit = await page.evaluate(() => {
      const f = document.getElementById('displayPreviewFrame')!;
      const box = f.parentElement!;
      const r = f.getBoundingClientRect();
      return { w: f.clientWidth, h: f.clientHeight, dw: Math.abs(r.width - box.clientWidth), dh: Math.abs(r.height - box.clientHeight) };
    });
    expect(fit).toMatchObject({ w: 1920, h: 1080 });
    expect(fit.dw).toBeLessThan(2);
    expect(fit.dh).toBeLessThan(2);
    await expect(frame(page)).toHaveCSS('pointer-events', 'none');

    // Clear of the dice button, inside the screen, and still on screen after scrolling
    const vp = page.viewportSize()!;
    const box = (await pip(page).boundingBox())!;
    const dice = (await page.locator('#dice-fab').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(dice.y);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(300);
    expect((await pip(page).boundingBox())!.y).toBeCloseTo(box.y, 0);

    // The dice panel opens over that corner: the preview steps aside
    await page.locator('#dice-fab').click();
    await expect(pip(page)).toBeHidden();
    await page.locator('#dice-fab').click();
    await expect(pip(page)).toBeVisible();

    await put({ spotlightNpcIds: [] });
  });

  test('drags to the nearest corner and remembers it', async ({ page }) => {
    await page.goto('/tools/dm-screen');
    if (isPhone(page)) await page.locator('#displayPreviewPill').click();
    await expect(pip(page)).toHaveAttribute('data-state', 'open');
    const vp = page.viewportSize()!;
    const box = (await pip(page).boundingBox())!;
    const grab = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    // Let go a bit left of and above the middle: snaps to the top left, below the nav
    await drag(page, grab, { x: vp.width * 0.4, y: vp.height * 0.4 });
    await expect(pip(page)).toHaveAttribute('data-corner', 'tl');
    // It glides there
    await expect.poll(async () => (await pip(page).boundingBox())!.x).toBeLessThan(20);
    const tl = (await pip(page).boundingBox())!;
    const nav = await page.locator('.app-nav').boundingBox();
    expect(tl.y).toBeGreaterThanOrEqual((nav?.height ?? 0));

    await page.reload();
    await expect(pip(page)).toHaveAttribute('data-corner', 'tl');
    await expect(pip(page)).toHaveAttribute('data-state', 'open');

    // A drag never counts as a tap on the minimised pill either
    await page.locator('#displayPreviewMin').click();
    await expect(pip(page)).toHaveAttribute('data-state', 'min');
    const pill = (await page.locator('#displayPreviewPill').boundingBox())!;
    await drag(page, { x: pill.x + pill.width / 2, y: pill.y + pill.height / 2 }, { x: vp.width * 0.8, y: vp.height * 0.2 });
    await expect(pip(page)).toHaveAttribute('data-corner', 'tr');
    await expect(pip(page)).toHaveAttribute('data-state', 'min');

    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch { /* blocked */ } }, STORAGE_KEY);
  });

  test('minimising stops the preview and is remembered', async ({ page }) => {
    await page.goto('/tools/dm-screen');
    const pill = page.locator('#displayPreviewPill');
    // Default: open on tablets and desktops, minimised on phones
    await expect(pip(page)).toHaveAttribute('data-state', isPhone(page) ? 'min' : 'open');
    await expect(frame(page)).toHaveAttribute('src', isPhone(page) ? 'about:blank' : '/display?preview');
    if (isPhone(page)) {
      await expect(pill).toBeVisible();
      await expect(pill).toHaveText(/Live display/);
      await pill.click();
    }
    await expect(frame(page)).toBeVisible();
    await expect(frame(page)).toHaveAttribute('src', '/display?preview');

    await page.locator('#displayPreviewMin').click();
    await expect(pip(page)).toHaveAttribute('data-state', 'min');
    await expect(frame(page)).toBeHidden();
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAttribute('aria-expanded', 'false');
    // No page behind it, so nothing polls
    await expect(frame(page)).toHaveAttribute('src', 'about:blank');

    await page.reload();
    await expect(pip(page)).toHaveAttribute('data-state', 'min');
    await expect(frame(page)).toHaveAttribute('src', 'about:blank');

    await pill.click();
    await page.reload();
    await expect(pip(page)).toHaveAttribute('data-state', 'open');
    await expect(frame(page)).toBeVisible();
    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch { /* blocked */ } }, STORAGE_KEY);
  });

  test('is 240px wide on a tablet, 320px on a desktop', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Sets its own screen size');
    for (const [width, height, expected] of [[820, 1180, 240], [1440, 900, 320]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/tools/dm-screen');
      await expect(pip(page)).toHaveAttribute('data-state', 'open');
      const box = (await page.locator('#displayPreviewWindow').boundingBox())!;
      expect(Math.round(box.width)).toBe(expected);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
});
