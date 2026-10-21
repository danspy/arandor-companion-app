import { test, expect, type Page } from '@playwright/test';

// Player display (/display): switching views (live, pause, start screen, no session) and
// scenes is a soft dissolve. The outgoing view stays drawn until the incoming one covers it,
// pictures are loaded before a switch, a place's name changes with its picture, and the
// stage never shows what it showed before it was hidden. /api/display and the pictures are
// mocked, so these tests need no database content.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const loc = (name: string, imageUrl: string) => ({ name, type: 'city', region: 'Rulik', imageUrl });
const npc = (id: string) => ({ id, name: `NPC ${id}`, subtitle: '', avatarUrl: null });
const base = {
  screenVisible: true, wallpaperUrl: null, backdropUrl: '/e2e-backdrop.png', nextSession: null,
  startScreen: null, location: null, npcs: [] as ReturnType<typeof npc>[], initiative: null, timer: null,
};
const scene1 = { ...base, mode: 'live', location: loc('Frostheim', '/e2e-loc1.png'), npcs: [npc('a'), npc('b')] };
const scene2 = { ...base, mode: 'live', location: loc('Gol Bolar', '/e2e-loc2.png'), npcs: [npc('b'), npc('c')] };
const castOnly = { ...base, mode: 'live', npcs: [npc('a')] };
const pauseCard = { ...base, mode: 'pause' };
const wallpaper = { ...base, mode: 'pause', wallpaperUrl: '/e2e-wall.png' };

// Pictures answer after `delays[path]` ms (default at once)
async function open(page: Page, first: unknown, delays: Record<string, number> = {}) {
  let current = first;
  await page.route('**/api/display', (route) => route.fulfill({ json: current }));
  await page.route(/\/e2e-[\w-]+\.png$/, async (route) => {
    const wait = delays[new URL(route.request().url()).pathname] ?? 0;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    await route.fulfill({ contentType: 'image/png', body: PNG }).catch(() => {});
  });
  await page.goto('/display');
  return async (next: unknown) => {
    current = next;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  };
}

const style = (page: Page, selector: string) => page.locator(selector).evaluate((el) => {
  const s = getComputedStyle(el);
  return { opacity: Number(s.opacity), z: Number(s.zIndex), visibility: s.visibility };
});

// Wait for a switch to be over (no layer marked as coming or going any more)
const switched = (page: Page) => page.waitForFunction(() => !document.querySelector('.is-view-leaving, .is-view-entering'));

test.describe('Display transitions', () => {
  test.skip(({ isMobile }) => isMobile, 'Display logic, once is enough');

  test('live to pause card: the stage fades out above the backdrop, the card comes in on top', async ({ page }) => {
    const next = await open(page, scene1);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage');
    await switched(page);
    await next(pauseCard);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'idle');
    const [stage, backdrop, idle] = await Promise.all([style(page, '#stage'), style(page, '.dsp-backdrop'), style(page, '#idle')]);
    // Before: the shared backdrop jumped above the stage and cut it off at once
    expect(stage.visibility).toBe('visible');
    expect(stage.z).toBeGreaterThan(backdrop.z);
    expect(idle.z).toBeGreaterThan(stage.z);
    await expect(page.locator('#stage')).toHaveClass(/is-view-leaving/);
    await switched(page);
    expect((await style(page, '#stage')).visibility).toBe('hidden');
    await expect(page.locator('#idleTitle')).toHaveText('Short break');
  });

  test('wallpaper to live: the wallpaper stays until the stage covers it', async ({ page }) => {
    const next = await open(page, wallpaper);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'wallpaper');
    await switched(page);
    await next(scene1);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage');
    const [wall, stage] = await Promise.all([style(page, '#wallpaper'), style(page, '#stage')]);
    expect(wall.opacity).toBeGreaterThan(0.9); // fades only in the second half
    expect(stage.z).toBeGreaterThan(wall.z);
    await switched(page);
    expect((await style(page, '#wallpaper')).visibility).toBe('hidden');
  });

  test('back on the stage: no stale picture, name or portraits', async ({ page }) => {
    const next = await open(page, scene1);
    await expect(page.locator('#locName')).toHaveText('Frostheim');
    await next(pauseCard);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'idle');
    await switched(page);
    await next(scene2);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage');
    // From the first frame the stage shows: the new place only, and the new spotlight
    await expect(page.locator('#locName')).toHaveText('Gol Bolar', { timeout: 100 });
    await expect(page.locator('#locLayers .dsp-loc-layer')).toHaveCount(1);
    await expect(page.locator('#locLayers img.dsp-loc-img')).toHaveAttribute('src', '/e2e-loc2.png');
    await expect(page.locator('#cast li')).toHaveCount(2);
    await expect(page.locator('#cast')).not.toContainText('NPC a');
  });

  test('a new place: name and picture change together, once the picture is loaded', async ({ page }) => {
    const next = await open(page, scene1, { '/e2e-loc2.png': 900 });
    await expect(page.locator('#locName')).toHaveText('Frostheim');
    await switched(page);
    await next(scene2);
    await page.waitForTimeout(400);
    // Still loading: the old place stays as it is, name and picture
    await expect(page.locator('#locName')).toHaveText('Frostheim');
    await expect(page.locator('#locLayers img.dsp-loc-img').last()).toHaveAttribute('src', '/e2e-loc1.png');
    await expect(page.locator('#cast')).toContainText('NPC a');
    // Loaded: the name changes while the new picture fades in
    await expect(page.locator('#locName')).toHaveText('Gol Bolar', { timeout: 3000 });
    await expect(page.locator('#locLayers img.dsp-loc-img').last()).toHaveAttribute('src', '/e2e-loc2.png');
    await expect(page.locator('#locLayers .dsp-loc-layer')).toHaveCount(1, { timeout: 3000 }); // old one dropped after the crossfade
  });

  test('a slow picture holds a switch back for 1.5 s at most', async ({ page }) => {
    const next = await open(page, scene1, { '/e2e-wall.png': 10_000 });
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage');
    const t0 = Date.now();
    await next(wallpaper);
    await page.waitForTimeout(600);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage'); // waiting for the picture
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'wallpaper', { timeout: 3000 });
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  test('no place any more: the location dissolves into the backdrop', async ({ page }) => {
    const next = await open(page, scene1);
    await expect(page.locator('#locName')).toHaveText('Frostheim');
    await switched(page);
    await next(castOnly);
    await expect(page.locator('body')).toHaveAttribute('data-location', '0');
    const [location, backdrop] = await Promise.all([style(page, '#location'), style(page, '.dsp-backdrop')]);
    expect(location.visibility).toBe('visible'); // fading, not cut
    expect(location.opacity).toBeGreaterThan(0);
    expect(backdrop.opacity).toBe(1); // already there underneath
    await expect.poll(async () => (await style(page, '#location')).visibility).toBe('hidden');
  });

  test('side panel fades rather than vanishes', async ({ page }) => {
    const timer = { status: 'paused', duration: 300, startedAt: 0, pausedAt: 60000 };
    const next = await open(page, { ...scene1, timer });
    await expect(page.locator('body')).toHaveAttribute('data-side', '1');
    await next(scene1);
    await expect(page.locator('body')).toHaveAttribute('data-side', '0');
    const side = await style(page, '#side');
    expect(side.visibility).toBe('visible');
    expect(side.opacity).toBeGreaterThan(0);
    await expect.poll(async () => (await style(page, '#side')).visibility).toBe('hidden');
  });

  test('reduced motion: views still switch, quicker and without zoom', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const next = await open(page, scene1);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage');
    await next(pauseCard);
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'idle');
    expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--view-fade').trim())).toBe('.5s');
    expect(await page.locator('#idle').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    await switched(page);
    await expect(page.locator('#idleTitle')).toHaveText('Short break');
  });
});
