import { test, expect, type Page } from '@playwright/test';

// Pages refresh through the ClientRouter (src/lib/soft-reload.ts) instead of reloading, so music
// keeps playing. These check that pages still behave after such a refresh.
// Needs a server under test with a DM account (never live data): E2E_DM_USER / E2E_DM_PASSWORD;
// E2E_BASE_URL points at it. The tests create and delete their own timeline entries.

const DM = process.env.E2E_DM_USER, DM_PASSWORD = process.env.E2E_DM_PASSWORD;
if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

async function loginAsDm(page: Page) {
  expect((await page.context().request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } })).ok()).toBe(true);
}

test.describe('Soft refresh', () => {
  test.skip(!DM || !DM_PASSWORD, 'Needs E2E_DM_USER/E2E_DM_PASSWORD');
  test.skip(({ isMobile }) => isMobile, 'Once is enough');

  test('timeline: each save posts once, also after earlier saves', async ({ page }) => {
    await loginAsDm(page);
    await page.goto('/library/timeline');
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/timeline') posts.push(r.url()); });
    const created: string[] = [];
    page.on('response', async (r) => {
      if (r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/timeline' && r.ok()) created.push((await r.json()).id);
    });
    try {
      for (const headline of ['E2E soft refresh 1', 'E2E soft refresh 2', 'E2E soft refresh 3']) {
        const before = posts.length;
        await page.locator('#addTimelineEntry').click();
        await page.locator('#timelineEntryForm [name="year"]').fill('1');
        await page.locator('#timelineEntryForm [name="headline"]').fill(headline);
        await page.locator('#timelineEntryForm [type="submit"]').click();
        await expect(page.getByText(headline).first()).toBeVisible();
        await page.waitForTimeout(500);
        expect(posts.length - before, headline).toBe(1);
      }
    } finally {
      for (const id of created.filter(Boolean)) await page.context().request.delete(`/api/timeline/${id}`);
    }
  });

  test('initiative: the open combatant panel comes back after a refresh', async ({ page }) => {
    await loginAsDm(page);
    await page.goto('/tools/initiative');
    const card = page.locator('.initiative-card.is-clickable').first();
    test.skip(!(await card.count()), 'No combatants in the tracker');
    const id = await card.getAttribute('data-entry-id');
    await card.locator('.initiative-name, h3, .font-semibold').first().click();
    await expect(page.locator('.sb-panel.is-open')).toBeVisible();
    await page.evaluate(() => window.arandorSoftReload());
    await expect(page.locator('.sb-panel.is-open')).toBeVisible();
    await expect(page.locator(`.initiative-card.is-selected[data-entry-id="${id}"]`)).toBeVisible();
  });
});
