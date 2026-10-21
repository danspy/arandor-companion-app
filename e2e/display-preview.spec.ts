import { test, expect, type Page } from '@playwright/test';

// The DM screen's live preview of the player display: /display?preview in a scaled iframe.
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
});

test.describe('DM screen display preview', () => {
  test.skip(!DM || !DM_PASSWORD, 'Needs E2E_DM/E2E_DM_PASSWORD (test server only)');

  test.beforeEach(async ({ page }) => {
    const res = await page.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } });
    expect(res.ok(), 'login').toBe(true);
  });

  test('shows the spotlight a few seconds after it changes', async ({ page }) => {
    const npcs = (await (await page.request.get('/api/npcs')).json()) as { id: string; name: string }[];
    test.skip(npcs.length < 2, 'Needs two NPCs in the test data');
    const put = (data: object) => page.request.put('/api/dm-screen', { data });
    await put({ screenVisible: true, npcsHidden: false, spotlightNpcIds: [npcs[0].id], focusNpcIds: [] });

    await page.goto('/tools/dm-screen');
    // A fresh browser: open everywhere but on phones
    const isPhone = (page.viewportSize()?.width ?? 1000) < 640;
    if (isPhone) await page.locator('#displayPreviewToggle').click();
    const frame = page.frameLocator('#displayPreviewFrame');
    await expect(frame.locator('#cast .dsp-portrait-name')).toHaveText([npcs[0].name]);

    await put({ spotlightNpcIds: [npcs[0].id, npcs[1].id] });
    await expect(frame.locator('#cast > li:not(.is-leaving) .dsp-portrait-name')).toHaveText([npcs[0].name, npcs[1].name], { timeout: 6_000 });

    // Rendered like the TV (1920×1080), scaled down to fit the panel
    const fit = await page.evaluate(() => {
      const f = document.getElementById('displayPreviewFrame')!;
      const box = f.parentElement!; // the panel inside its border
      const r = f.getBoundingClientRect();
      return { w: f.clientWidth, h: f.clientHeight, dw: Math.abs(r.width - box.clientWidth), dh: Math.abs(r.height - box.clientHeight) };
    });
    expect(fit).toMatchObject({ w: 1920, h: 1080 });
    expect(fit.dw).toBeLessThan(2);
    expect(fit.dh).toBeLessThan(2);
    await expect(page.locator('#displayPreviewFrame')).toHaveCSS('pointer-events', 'none');

    await put({ spotlightNpcIds: [] });
  });

  test('collapsing stops the preview and is remembered', async ({ page }) => {
    await page.goto('/tools/dm-screen');
    const toggle = page.locator('#displayPreviewToggle');
    const frame = page.locator('#displayPreviewFrame');
    const isPhone = (page.viewportSize()?.width ?? 1000) < 640;
    // Default: open on tablets and desktops, closed on phones
    await expect(toggle).toHaveAttribute('aria-expanded', isPhone ? 'false' : 'true');
    if (isPhone) await toggle.click();
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', '/display?preview');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(frame).toBeHidden();
    // No page behind it, so nothing polls
    await expect(frame).toHaveAttribute('src', 'about:blank');

    await page.reload();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(frame).toBeHidden();
    await expect(frame).toHaveAttribute('src', 'about:blank');

    await toggle.click();
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(frame).toBeVisible();
    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch { /* blocked */ } }, STORAGE_KEY);
  });

  test('fits on a tablet without pushing the page sideways', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Sets its own screen size');
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/tools/dm-screen');
    const frame = page.locator('#displayPreviewFrame');
    await expect(frame).toBeVisible();
    const box = (await page.locator('#displayPreview').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(820);
    expect(box.y + box.height).toBeLessThan(1180);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(820);
  });
});
