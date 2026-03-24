import { test, expect } from '@playwright/test';

// ── Navigation structure ─────────────────────────────────────────

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('brand name "Arandor" is visible in nav', async ({ page }) => {
    const brand = page.getByTestId('nav-brand');
    await expect(brand).toBeVisible();
    await expect(brand).toHaveText('Arandor');
  });

  test('desktop nav contains all expected links', async ({ page }) => {
    const nav = page.getByTestId('desktop-nav');
    for (const label of ['Diary', 'Library', 'Characters', 'NPCs', 'Locations', 'Map', 'Quests']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('theme toggle button is present', async ({ page }) => {
    await expect(page.getByTestId('theme-toggle')).toBeVisible();
  });

  test('user menu button is present', async ({ page }) => {
    await expect(page.getByTestId('user-menu-btn')).toBeVisible();
  });

  test('user dropdown opens and closes', async ({ page }) => {
    const btn = page.getByTestId('user-menu-btn');
    const dropdown = page.locator('#userDropdown');
    await expect(dropdown).toBeHidden();
    await btn.click();
    await expect(dropdown).toBeVisible();
    // Click outside to close
    await page.mouse.click(100, 400);
    await expect(dropdown).toBeHidden();
  });
});

// ── Mobile navigation ────────────────────────────────────────────

test.describe('Mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('mobile menu button is visible', async ({ page }) => {
    await expect(page.getByTestId('mobile-menu-btn')).toBeVisible();
  });

  test('mobile menu opens when hamburger clicked', async ({ page }) => {
    const btn = page.getByTestId('mobile-menu-btn');
    const menu = page.locator('#mobileMenu');
    await expect(menu).toBeHidden();
    await btn.click();
    await expect(menu).toBeVisible();
  });

  test('mobile menu closes when link clicked', async ({ page }) => {
    const btn = page.getByTestId('mobile-menu-btn');
    await btn.click();
    const menu = page.locator('#mobileMenu');
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'Diary' }).click();
    // After navigation, menu should close
    await expect(menu).toBeHidden();
  });

  test('desktop nav is hidden on mobile', async ({ page }) => {
    await expect(page.getByTestId('desktop-nav')).toBeHidden();
  });
});

// ── Dark mode toggle ─────────────────────────────────────────────

test.describe('Theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Force light mode start
    await page.addInitScript(() => localStorage.setItem('theme', 'light'));
    await page.goto('/login');
  });

  test('dark mode class applied when toggled', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);
    await page.getByTestId('theme-toggle').click();
    await expect(html).toHaveClass(/dark/);
  });

  test('theme preference persisted in localStorage', async ({ page }) => {
    await page.getByTestId('theme-toggle').click();
    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    expect(stored).toBe('dark');
  });

  test('toggling twice returns to light mode', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle');
    const html = page.locator('html');
    await toggle.click();
    await expect(html).toHaveClass(/dark/);
    await toggle.click();
    await expect(html).not.toHaveClass(/dark/);
  });
});

// ── Design: CSS variables & visual tokens ───────────────────────

test.describe('Design tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.goto('/login');
  });

  test('body uses Outfit font (design token)', async ({ page }) => {
    const fontFamily = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily
    );
    expect(fontFamily.toLowerCase()).toContain('outfit');
  });

  test('brand link uses Cormorant Garamond (display font)', async ({ page }) => {
    const fontFamily = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="nav-brand"]');
      return el ? getComputedStyle(el).fontFamily : '';
    });
    expect(fontFamily.toLowerCase()).toContain('cormorant');
  });

  test('nav has dark background in dark mode', async ({ page }) => {
    const bg = await page.evaluate(() => {
      const nav = document.querySelector('nav.app-nav');
      return nav ? getComputedStyle(nav).backgroundColor : '';
    });
    // Should be very dark (rgb values all low)
    expect(bg).toMatch(/rgba?\((\d+), (\d+), (\d+)/);
    const [, r, g, b] = bg.match(/rgba?\((\d+), (\d+), (\d+)/) || [];
    expect(Number(r) + Number(g) + Number(b)).toBeLessThan(100);
  });
});

// ── Page navigation & active states ─────────────────────────────

test.describe('Page routing', () => {
  test('login page loads without error', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Arandor/);
  });

  test('diary page loads (redirects if not authed)', async ({ page }) => {
    const response = await page.goto('/diary');
    // Either 200 (public) or redirect — not a 500
    expect(response?.status()).not.toBe(500);
  });

  test('characters page loads', async ({ page }) => {
    const response = await page.goto('/characters');
    expect(response?.status()).not.toBe(500);
  });
});
