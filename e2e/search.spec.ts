import { test, expect, type APIRequestContext } from '@playwright/test';
import { canSee, normalize, plainText, search, snippet, type SearchRecord } from '../src/lib/search';
import { COMMANDS, diceAction } from '../src/lib/search/commands';

// Global search (⌘K / Ctrl+K): ranking, role filtering, the API and the palette.
// The logged-in tests need an account on the server under test (never live data):
//   E2E_DM / E2E_DM_PASSWORD (dungeonmaster)   E2E_PLAYER / E2E_PLAYER_PASSWORD (player)
// They are skipped when those are not set.

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

const npc = (id: string, title: string, body = ''): SearchRecord => ({
  group: 'npcs', id, title, body, href: `/npcs/${id}`, access: 'public',
});
const titles = (query: string, records: SearchRecord[], viewer: Parameters<typeof search>[2] = null) =>
  search(query, records, viewer).flatMap((g) => g.results.map((r) => r.title));

test.describe('Search core', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('ignores case and accents', () => {
    expect(normalize('Úlfgar')).toBe('ulfgar');
    expect(titles('ulfgar', [npc('1', 'Úlfgar Ironfist')])).toEqual(['Úlfgar Ironfist']);
  });

  test('every word must match', () => {
    const records = [npc('1', 'Young Red Dragon'), npc('2', 'Red Wizard')];
    expect(titles('red dragon', records)).toEqual(['Young Red Dragon']);
  });

  test('ranks title matches above body matches', () => {
    const records = [
      npc('4', 'Mara', 'She hates goblins.'),
      npc('3', 'Hobgoblin'),
      npc('2', 'Goblin Boss'),
      npc('1', 'Goblin'),
    ];
    expect(titles('goblin', records)).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin', 'Mara']);
  });

  test('snippets are escaped and marked', () => {
    const s = snippet('<script>x</script> the goblin', ['goblin']);
    expect(s).toContain('&lt;script&gt;');
    expect(s).toContain('<mark>goblin</mark>');
    expect(snippet('Ein Zwerg namens Úlfgar', ['ulfgar'])).toContain('<mark>Úlfgar</mark>');
  });

  test('snippets are short plain text', () => {
    const body = `![map](/uploads/map.png) ${'Lorem ipsum dolor sit amet. '.repeat(100)} the [dragon](/npcs/1) sleeps ${'x '.repeat(500)}`;
    const s = snippet(plainText(body), ['dragon'])!;
    expect(s).toContain('<mark>dragon</mark>');
    expect(s).not.toContain('![');
    expect(s).not.toContain('](');
    expect(s.replace(/<\/?mark>/g, '').length).toBeLessThanOrEqual(140);
  });

  test('odd characters are searched literally', () => {
    const records = [npc('1', 'The (Old) Tower *'), npc('2', '<b>Bold</b>')];
    expect(() => search('a(', records, null)).not.toThrow();
    expect(titles('(old)', records)).toEqual(['The (Old) Tower *']);
    expect(titles('<b>', records)).toEqual(['<b>Bold</b>']);
    expect(titles('x', records)).toEqual([]); // too short
  });

  test('access by role', () => {
    expect(canSee('public', null)).toBe(true);
    expect(canSee('user', null)).toBe(false);
    expect(canSee('user', 'player')).toBe(true);
    expect(canSee('dm', 'player')).toBe(false);
    expect(canSee('dm', 'dungeonmaster')).toBe(true);
    expect(canSee('admin', 'dungeonmaster')).toBe(false);
    expect(canSee('admin', 'admin')).toBe(true);
    expect(titles('dm screen', COMMANDS, 'player')).toEqual([]);
    expect(search('dm screen', COMMANDS, 'dungeonmaster')[0].results[0].href).toBe('/tools/dm-screen');
    expect(titles('users', COMMANDS, 'dungeonmaster')).toEqual([]);
  });

  test('limits results per group', () => {
    const records = Array.from({ length: 9 }, (_, i) => npc(String(i), `Guard ${i}`));
    expect(search('guard', records, null)[0].results).toHaveLength(8);
  });

  test('dice notation becomes a roll action', () => {
    expect(diceAction('2d6+3')).toEqual({ label: 'Roll 2d6+3', notation: '2d6+3' });
    expect(diceAction('d20')?.notation).toBe('1d20');
    expect(diceAction('goblin')).toBeNull();
    expect(diceAction('12')).toBeNull(); // a plain number is not a roll
  });
});

const DM = process.env.E2E_DM, DM_PASSWORD = process.env.E2E_DM_PASSWORD;
const PLAYER = process.env.E2E_PLAYER, PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD;

async function login(request: APIRequestContext, username: string, password: string) {
  const res = await request.post('/api/auth/login', { data: { username, password } });
  expect(res.ok(), `login as ${username}`).toBe(true);
}

const RESULT_KEYS = ['group', 'id', 'title', 'subtitle', 'snippet', 'href', 'score'];
async function groupsFor(request: APIRequestContext, q: string) {
  const res = await request.get(`/api/search?q=${encodeURIComponent(q)}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-store');
  const body = (await res.json()) as { groups: { group: string; label: string; results: Record<string, unknown>[] }[] };
  for (const g of body.groups) {
    expect(Object.keys(g).sort()).toEqual(['group', 'label', 'results']);
    for (const r of g.results) for (const k of Object.keys(r)) expect(RESULT_KEYS).toContain(k);
  }
  return body.groups;
}

test.describe('Search API', () => {
  test.skip(({ isMobile }) => isMobile, 'API, once is enough');

  test('logged out: public content only', async ({ request }) => {
    const groups = await groupsFor(request, 'goblin');
    const names = groups.map((g) => g.group);
    expect(names).not.toContain('bestiary');
    expect(names).not.toContain('calendar');
    expect(await groupsFor(request, 'x')).toEqual([]);
    const pages = (await groupsFor(request, 'dm screen')).find((g) => g.group === 'pages');
    expect(pages).toBeUndefined();
  });

  test('a player never finds stat blocks', async ({ playwright, baseURL }) => {
    test.skip(!PLAYER || !PLAYER_PASSWORD, 'Needs E2E_PLAYER/E2E_PLAYER_PASSWORD (test server only)');
    const request = await playwright.request.newContext({ baseURL });
    await login(request, PLAYER!, PLAYER_PASSWORD!);
    const groups = await groupsFor(request, 'goblin');
    expect(groups.map((g) => g.group)).not.toContain('bestiary');
    expect((await groupsFor(request, 'calendar')).find((g) => g.group === 'pages')?.results[0].href).toBe('/calendar');
    await request.dispose();
  });

  test('the DM finds SRD creatures', async ({ playwright, baseURL }) => {
    test.skip(!DM || !DM_PASSWORD, 'Needs E2E_DM/E2E_DM_PASSWORD (test server only)');
    const request = await playwright.request.newContext({ baseURL });
    await login(request, DM!, DM_PASSWORD!);
    const bestiary = (await groupsFor(request, 'goblin')).find((g) => g.group === 'bestiary');
    expect(bestiary?.results.some((r) => r.href === '/tools/bestiary/srd/goblin-warrior')).toBe(true);
    await request.dispose();
  });
});

test.describe('Search palette', () => {
  const openKey = process.platform === 'darwin' ? 'Meta+k' : 'Control+k';

  test('Ctrl+K finds an NPC and opens its page', async ({ page, request, isMobile }) => {
    test.skip(isMobile, 'No keyboard on phones; see the button test');
    const someNpc = (await (await request.get('/api/search?q=goblin')).json()).groups.find((g: { group: string }) => g.group === 'npcs')?.results[0];
    test.skip(!someNpc, 'Needs an NPC matching "goblin" in the test data');

    await page.goto('/npcs');
    await page.keyboard.press(openKey);
    const dialog = page.getByTestId('search-dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('search-input').fill(someNpc.title);
    const first = dialog.getByTestId('search-result').filter({ hasText: someNpc.title }).first();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute('href', someNpc.href);
    // Keyboard to it and open
    while ((await first.getAttribute('aria-selected')) !== 'true') await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${someNpc.href}$`));
    await expect(dialog).toBeHidden();
  });

  test('"/" opens it, but not while typing', async ({ page, isMobile }) => {
    test.skip(isMobile, 'No keyboard on phones');
    await page.goto('/npcs');
    const search = page.locator('#searchInput');
    await search.click();
    await page.keyboard.type('/');
    await expect(search).toHaveValue('/');
    await expect(page.getByTestId('search-dialog')).toBeHidden();

    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('/');
    await expect(page.getByTestId('search-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('search-dialog')).toBeHidden();
  });

  test('dice notation offers a roll', async ({ page, isMobile }) => {
    test.skip(isMobile, 'No keyboard on phones');
    await page.goto('/');
    await page.keyboard.press(openKey);
    await page.getByTestId('search-input').fill('2d6');
    await expect(page.getByTestId('search-result').first()).toHaveText(/Roll 2d6/);
  });

  test('the nav button opens it on a phone', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Phone layout');
    await page.goto('/');
    await page.getByTestId('search-btn-mobile').click();
    await expect(page.getByTestId('search-dialog')).toBeVisible();
    await expect(page.getByTestId('search-result').first()).toBeVisible(); // page list
    const box = await page.getByTestId('search-dialog').boundingBox();
    const width = page.viewportSize()!.width;
    expect(box!.x).toBeGreaterThanOrEqual(15);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width - 15);
  });

  test('not on the display screen', async ({ page }) => {
    await page.goto('/display');
    await page.keyboard.press(openKey);
    await expect(page.getByTestId('search-dialog')).toHaveCount(0);
  });
});

test.describe('Search palette, typing fast', () => {
  test.skip(({ isMobile }) => isMobile, 'Keyboard');
  test.use({ reducedMotion: 'reduce' }); // the 3D dice do not settle in a headless browser
  test('Enter right after typing uses the new query, not the old results', async ({ page }) => {
    const openKey = process.platform === 'darwin' ? 'Meta+k' : 'Control+k';
    await page.goto('/');
    await page.keyboard.press(openKey);
    const input = page.getByTestId('search-input');
    await input.fill('goblin');
    await expect(page.getByTestId('search-result').first()).toBeVisible();
    await input.fill('2d6+3');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('search-dialog')).toBeHidden();
    await expect(page).toHaveURL(/\/$/); // rolled, did not navigate
    await expect(page.locator('#dice-result-banner .dice-banner-card')).toBeVisible({ timeout: 10_000 });
  });
});
