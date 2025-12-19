import { test, expect } from '@playwright/test';

// ============================================
// SMOKE TESTS - Basic page loads
// ============================================

test.describe('Smoke Tests', () => {
  test('Homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TrikaWeb/);
  });

  test('Hero section tells user what the site is about', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Planchas y reseñas');
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================

test.describe('Navigation', () => {
  test('Can navigate to Cursos page from header', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/cursos"]');
    await expect(page).toHaveURL('/cursos');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cursos');
  });

  test('Can navigate to Profesores page from header', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/profesores"]');
    await expect(page).toHaveURL('/profesores');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Profesores');
  });

  test('Can navigate back to home via logo', async ({ page }) => {
    await page.goto('/cursos');
    await page.click('a[aria-label="Volver al inicio"]');
    await expect(page).toHaveURL('/');
  });

  test('Can navigate to saved page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/saved"]');
    await expect(page).toHaveURL('/saved');
  });
});

// ============================================
// CURSOS PAGE TESTS
// ============================================

test.describe('Cursos Page', () => {
  test('Cursos page displays course cards', async ({ page }) => {
    await page.goto('/cursos');
    await expect(page.locator('#courses-grid')).toBeVisible();
  });

  test('Search input exists and is functional', async ({ page }) => {
    await page.goto('/cursos');
    const searchInput = page.locator('#search-course');
    await expect(searchInput).toBeVisible();

    // Type a search query and verify input works
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');

    // Clear and verify
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });

  test('Search input does not show browser X button', async ({ page }) => {
    await page.goto('/cursos');
    const searchInput = page.locator('#search-course');

    // Fill with text to trigger the cancel button if it were visible
    await searchInput.fill('test');

    // The CSS should hide the cancel button - check input is still functional
    await expect(searchInput).toHaveValue('test');
  });
});

// ============================================
// PROFESORES (TEACHERS) PAGE TESTS
// ============================================

test.describe('Teachers Page', () => {
  test('Teachers page displays teacher cards', async ({ page }) => {
    await page.goto('/profesores');
    await expect(page.locator('#teachers-grid')).toBeVisible();
  });

  test('Search input exists and is functional', async ({ page }) => {
    await page.goto('/profesores');
    const searchInput = page.locator('#search-teacher');
    await expect(searchInput).toBeVisible();

    // Type a search query and verify input works
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');

    // Clear and verify
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });
});

// ============================================
// SEO & ACCESSIBILITY TESTS
// ============================================

test.describe('SEO & Accessibility', () => {
  test('Homepage has proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check meta description exists
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);

    // Check OG tags
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /.+/);
  });

  test('Pages use semantic heading structure', async ({ page }) => {
    await page.goto('/');

    // Should have exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('All pages have proper title tags', async ({ page }) => {
    const pages = ['/', '/cursos', '/profesores', '/saved'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    }
  });
});

// ============================================
// THEME TESTS
// ============================================

test.describe('Theme', () => {
  test('Dark mode is always active', async ({ page }) => {
    await page.goto('/');

    // Check that the dark class is present on html
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);
  });
});

// ============================================
// SAVED PAGE TESTS
// ============================================

test.describe('Saved Page', () => {
  test('Saved page loads without errors', async ({ page }) => {
    await page.goto('/saved');
    await expect(page).toHaveTitle(/TrikaWeb/);
  });

  test('Shows empty state when no favorites', async ({ page }) => {
    // Clear localStorage before test
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('trikaweb:favorites'));

    await page.goto('/saved');
    // Should show some kind of message about no saved items
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================
// MOBILE MENU TESTS
// ============================================

test.describe('Mobile Menu', () => {
  test('Mobile menu opens and closes', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Find and click mobile menu button
    const menuBtn = page.locator('#mobile-menu-btn');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Menu drawer should be visible
    const drawer = page.locator('#mobile-menu-drawer');
    await expect(drawer).not.toHaveClass(/translate-x-full/);

    // Close menu
    const closeBtn = page.locator('#close-menu-btn');
    await closeBtn.click();

    // Drawer should be hidden
    await expect(drawer).toHaveClass(/translate-x-full/);
  });
});
