import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { formatRoll, parseRoll, validatePresets } from '../src/lib/dice-notation';

// Written rolls, presets ("My rolls") and the multi-part dice engine.
// The logged-in tests need two accounts on the server under test (never live data):
//   E2E_USER / E2E_PASSWORD and E2E_USER2 / E2E_PASSWORD2
// They are skipped when those are not set.

test.describe('Dice notation', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('reads written rolls', () => {
    const ok = (s: string) => {
      const r = parseRoll(s);
      if (!r.ok) throw new Error(`${s}: ${r.error}`);
      return formatRoll(r.roll);
    };
    expect(ok('1d20+5')).toBe('1d20+5');
    expect(ok(' 2d6 + 1d4 + 3 ')).toBe('2d6+1d4+3');
    expect(ok('d20')).toBe('1d20');
    expect(ok('1W20+5')).toBe('1d20+5'); // German "Würfel"
    expect(ok('1d20-1d4')).toBe('1d20-1d4');
    expect(ok('4d6-2')).toBe('4d6-2');
    expect(ok('2+1d8')).toBe('1d8+2');
    expect(ok('1d100')).toBe('1d100');
  });

  test('explains what is wrong', () => {
    const err = (s: string) => {
      const r = parseRoll(s);
      expect(r.ok, s).toBe(false);
      return r.ok ? '' : r.error;
    };
    expect(err('')).toContain('Enter a roll');
    expect(err('1d7')).toContain('no d7');
    expect(err('5')).toContain('at least one die');
    expect(err('1d20+')).toContain("Can't read");
    expect(err('1d20 5')).toContain('Put a + or −');
    expect(err('51d6')).toContain('At most 50');
    expect(err('0d6')).toContain('at least one die');
    expect(err('hello')).toContain("Can't read");
  });

  test('checks preset lists', () => {
    const good = [{ id: 'a1', name: ' Longsword ', parts: [{ label: 'To hit', expr: '1d20 + 5' }, { label: 'Slashing', expr: '1d8+3' }] }];
    const checked = validatePresets(good);
    expect(checked).toEqual({ ok: true, presets: [{ id: 'a1', name: 'Longsword', parts: [{ label: 'To hit', expr: '1d20+5' }, { label: 'Slashing', expr: '1d8+3' }] }] });
    expect(validatePresets({}).ok).toBe(false);
    expect(validatePresets([{ ...good[0], name: '' }]).ok).toBe(false);
    expect(validatePresets([{ ...good[0], parts: [] }]).ok).toBe(false);
    expect(validatePresets([{ ...good[0], parts: Array(5).fill({ label: '', expr: '1d6' }) }]).ok).toBe(false);
    expect(validatePresets([{ ...good[0], parts: [{ label: '', expr: '1d7' }] }]).ok).toBe(false);
    expect(validatePresets([good[0], good[0]]).ok).toBe(false); // same id twice
    expect(validatePresets([{ ...good[0], id: '<script>' }]).ok).toBe(false);
    expect(validatePresets(Array.from({ length: 31 }, (_, i) => ({ ...good[0], id: `p${i}` }))).ok).toBe(false);
  });
});

// Dice land on chosen values: with reduced motion the engine uses crypto.getRandomValues
// (value = n % sides + 1), so each queued number n gives the die n + 1.
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

async function bannerText(page: Page) {
  const card = page.locator('#dice-result-banner .dice-banner-card');
  await expect(card).toBeVisible();
  return (await card.innerText()).replace(/\s+/g, ' ').trim();
}

test.describe('Dice button', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a typed roll adds up its dice and bonus', async ({ page }) => {
    await page.goto('/login');
    await fixDice(page, [3, 5, 2]); // fallback rolls d4 first, then d6s: 1d4 → 3, 2d6 → 5, 2
    await page.locator('#dice-fab').click();
    await page.locator('#dice-fab-expr').fill('2d6 + 1d4 + 3');
    await page.locator('#dice-fab-typed button[type="submit"]').click();
    const text = await bannerText(page);
    expect(text).toContain('2d6+1d4+3');
    expect(text).toContain('13'); // 5 + 2 + 3 + 3
  });

  test('a typo is explained and nothing is rolled', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#dice-fab').click();
    await page.locator('#dice-fab-expr').fill('1d7');
    await page.locator('#dice-fab-typed button[type="submit"]').click();
    await expect(page.locator('#dice-fab-expr-error')).toContainText('no d7');
    await expect(page.locator('#dice-result-banner .dice-banner-card')).toBeHidden();
  });

  test('logged out, there is no My rolls section', async ({ page }) => {
    await page.goto('/login');
    const loaded = page.waitForResponse((r) => r.url().includes('/api/dice-presets'));
    await page.locator('#dice-fab').click();
    await expect(page.locator('#dice-fab-panel')).toBeVisible();
    expect((await loaded).status()).toBe(401);
    await expect(page.locator('#dice-fab-presets')).toBeHidden();
  });
});

const USER = process.env.E2E_USER, PASSWORD = process.env.E2E_PASSWORD;
const USER2 = process.env.E2E_USER2, PASSWORD2 = process.env.E2E_PASSWORD2;

async function login(context: BrowserContext, username: string, password: string) {
  const res = await context.request.post('/api/auth/login', { data: { username, password } });
  expect(res.ok(), `login as ${username}`).toBe(true);
}

test.describe('My rolls', () => {
  test.skip(!USER || !PASSWORD || !USER2 || !PASSWORD2, 'Needs E2E_USER/E2E_PASSWORD and E2E_USER2/E2E_PASSWORD2');
  test.describe.configure({ mode: 'serial' });
  test.use({ reducedMotion: 'reduce' });

  const LONGSWORD = { id: 'e2e-longsword', name: 'Longsword', parts: [{ label: 'To hit', expr: '1d20+5' }, { label: 'Slashing', expr: '1d8+3' }] };
  let saved: unknown = [];

  test.beforeAll(async ({ browser }) => {
    // Keep whatever the test account had, and put it back afterwards
    const context = await browser.newContext();
    await login(context, USER!, PASSWORD!);
    saved = await (await context.request.get('/api/dice-presets')).json();
    await context.close();
  });
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    await login(context, USER!, PASSWORD!);
    await context.request.put('/api/dice-presets', { data: saved });
    await context.close();
  });

  test('the API keeps each account to its own list and checks what it stores', async ({ browser, request }) => {
    expect((await request.get('/api/dice-presets')).status()).toBe(401);
    expect((await request.put('/api/dice-presets', { data: [] })).status()).toBe(401);

    const a = await browser.newContext();
    await login(a, USER!, PASSWORD!);
    const put = await a.request.put('/api/dice-presets', { data: [{ ...LONGSWORD, parts: [{ label: 'To hit', expr: '1W20 + 5' }, LONGSWORD.parts[1]] }] });
    expect(put.status()).toBe(200);
    expect(await put.json()).toEqual([LONGSWORD]); // stored in canonical form
    const bad = await a.request.put('/api/dice-presets', { data: [{ ...LONGSWORD, parts: [{ label: '', expr: '1d7' }] }] });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toContain('no d7');
    expect(await (await a.request.get('/api/dice-presets')).json()).toEqual([LONGSWORD]);

    const b = await browser.newContext();
    await login(b, USER2!, PASSWORD2!);
    const theirs = await (await b.request.get('/api/dice-presets')).json();
    expect(theirs).not.toContainEqual(LONGSWORD);
    await a.close();
    await b.close();
  });

  test('create, edit, roll with advantage, and a critical hit doubles the damage dice', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await login(context, USER!, PASSWORD!);
    await context.request.put('/api/dice-presets', { data: [] });
    const page = await context.newPage();
    await page.goto('/tools/dice-roller');

    // Create
    await page.getByRole('button', { name: 'New roll' }).click();
    await page.locator('#presetName').fill('Longsword');
    const parts = page.locator('#presetParts .preset-part');
    await parts.nth(0).locator('.part-expr').fill('1d20+5');
    await expect(parts.nth(0).locator('.preset-part-check')).toHaveText('= 1d20+5');
    await parts.nth(1).locator('.part-label').fill('Slashing');
    await parts.nth(1).locator('.part-expr').fill('1d7');
    await page.locator('#presetEditor button[type="submit"]').click();
    await expect(page.locator('#presetError')).toContainText('no d7');
    await parts.nth(1).locator('.part-expr').fill('1d8+3');
    await page.locator('#presetEditor button[type="submit"]').click();
    await expect(page.locator('#presetEditor')).toBeHidden();
    await expect(page.locator('#presetList')).toContainText('Longsword');
    await expect(page.locator('#presetList')).toContainText('To hit 1d20+5 · Slashing 1d8+3');

    // Edit: rename
    await page.getByRole('button', { name: 'Edit Longsword' }).click();
    await page.locator('#presetName').fill('Longsword +1');
    await page.locator('#presetEditor button[type="submit"]').click();
    await expect(page.locator('#presetList')).toContainText('Longsword +1');

    // Roll with advantage: d8 first (fallback order), then the two d20s → 7, 4 and 15 (keep 15)
    await fixDice(page, [7, 4, 15]);
    await page.locator('#my-rolls .roller-mode button[data-mode="advantage"]').click();
    await page.getByRole('button', { name: 'Roll', exact: true }).first().click();
    let text = await bannerText(page);
    expect(text).toContain('To hit 20'); // 15 + 5
    expect(text).toContain('Slashing 10'); // 7 + 3
    await expect(page.locator('#my-rolls .roller-mode button[data-mode="normal"]')).toHaveAttribute('aria-pressed', 'true');

    // Natural 20: the d8 is rolled again (6) and added
    await page.locator('#dice-result-banner .dice-banner-card').click();
    await fixDice(page, [5, 20, 6]);
    await page.getByRole('button', { name: 'Roll', exact: true }).first().click();
    text = await bannerText(page);
    expect(text).toContain('To hit 25');
    expect(text).toContain('Slashing 14'); // 5 + 6 + 3
    expect(text.toLowerCase()).toContain('critical hit! damage dice doubled');

    // The dice button on another page offers it too
    await page.goto('/characters');
    await page.locator('#dice-fab').click();
    await expect(page.locator('#dice-fab-preset-list .dice-preset')).toHaveCount(1);
    await expect(page.locator('#dice-fab-preset-list')).toContainText('Longsword +1');

    // Delete
    await page.goto('/tools/dice-roller');
    await page.getByRole('button', { name: 'Delete Longsword +1' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('#presetEmpty')).toBeVisible();
    await context.close();
  });
});
