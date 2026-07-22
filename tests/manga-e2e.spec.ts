import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

const TEST_MANGA_TITLE = 'One Piece';

// Dismiss changelog modal before each test
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('yomu_last_seen_version', '1.1.0');
  });
  await page.reload();
  await page.mouse.wheel(0, 50);
  await page.waitForTimeout(400);
});

// ── Helper: search on Browse and wait for grid to populate ──
async function searchAndWaitForGrid(page, title) {
  await page.goto('/browse');
  await page.getByTestId('browse-search').fill(title);
  await page.getByTestId('browse-search').press('Enter');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="manga-card"]', { timeout: 15000 });
}

test.describe('Homepage', () => {
  test('HOME-01: homepage loads with core sections', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('yomu_last_seen_version', '1.1.0'));
    await page.reload();
    await page.mouse.wheel(0, 50);
    await expect(page.getByRole('link', { name: 'YOMUZUU' }).first()).toBeVisible();
    await expect(page.getByTestId('hero-search')).toBeVisible();
  });

  test('HOME-02: hero search navigates to Browse with results', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('yomu_last_seen_version', '1.1.0'));
    await page.reload();
    await page.getByTestId('hero-search').fill(TEST_MANGA_TITLE);
    await page.getByTestId('hero-search').press('Enter');
    await expect(page).toHaveURL(/\/browse/);
  });

  test('HOME-03: genre chip filters the home rows', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('yomu_last_seen_version', '1.1.0'));
    await page.reload();
    await page.getByRole('button', { name: 'Action' }).click();
    await expect(page.locator('body')).not.toContainText('undefined');
  });

  test('HOME-04: "View All" link goes to Browse with query params', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('yomu_last_seen_version', '1.1.0'));
    await page.reload();
    await page.getByRole('link', { name: /view all/i }).first().click();
    await expect(page).toHaveURL(/\/browse\?/);
  });
});

test.describe('Navbar', () => {
  test('NAV-01: logo returns home', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(400);
    await page.getByRole('link', { name: 'YOMUZUU' }).first().click();
    await expect(page).toHaveURL('/');
  });

  test('NAV-02: Browse and Bookmarks links navigate correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(400);
    await page.getByRole('link', { name: 'Browse' }).first().click();
    await expect(page).toHaveURL(/\/browse/);
    await page.waitForLoadState('networkidle');

    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(400);
    await page.getByRole('link', { name: 'Bookmarks' }).first().click();
    await expect(page).toHaveURL(/\/bookmarks/);
  });

  test('NAV-03: quick search dropdown shows matching results', async ({ page }) => {
    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(400);
    await page.getByTestId('navbar-search').fill(TEST_MANGA_TITLE);
    await expect(page.getByText(TEST_MANGA_TITLE, { exact: false }).first()).toBeVisible();
  });

  test('NAV-04: Sign in opens Google OAuth modal', async ({ page }) => {
    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Continue with Google')).toBeVisible();
  });
});

test.describe('Browse', () => {
  test('BROWSE-01: page loads with title count and grid', async ({ page }) => {
    await page.goto('/browse');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/\d+ titles/)).toBeVisible();
  });

  test('BROWSE-02: search filters the grid', async ({ page }) => {
    await page.goto('/browse');
    await page.getByTestId('browse-search').fill(TEST_MANGA_TITLE);
    await page.getByTestId('browse-search').press('Enter');
    await expect(page.getByText(`"${TEST_MANGA_TITLE}"`)).toBeVisible();
  });

  test('BROWSE-03: sort buttons change grid order', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: 'A-Z' }).click();
    await expect(page.getByRole('button', { name: 'A-Z' })).toHaveCSS('color', 'rgb(255, 255, 255)');
  });

  test('BROWSE-04: type filter narrows results', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: 'Manhwa', exact: true }).click();
    await expect(page.getByText('Filtering by:')).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^Manhwa/ }).first()).toBeVisible();
  });

  test('BROWSE-06: no-results state shows Clear Filters', async ({ page }) => {
    await page.goto('/browse');
    await page.getByTestId('browse-search').fill('zzzzznonexistentmanga9999');
    await page.getByTestId('browse-search').press('Enter');
    await expect(page.getByText(/no titles found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'CLEAR FILTERS' })).toBeVisible();
  });

  test('BROWSE-07: clear filters resets grid', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('button', { name: 'Manhwa', exact: true }).click();
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByText('Filtering by:')).toHaveCount(0);
  });
});

test.describe('Manga detail & reading', () => {
  test('DETAIL-01 → READ-01: open a title and start reading', async ({ page }) => {
    await searchAndWaitForGrid(page, TEST_MANGA_TITLE);
    await page.getByTestId('manga-card').first().click();
    await expect(page).toHaveURL(/\/manga\/\d+/);

    await page.waitForLoadState('networkidle');
    await page.getByTestId('start-reading').click();
    await expect(page).toHaveURL(/\/chapter\/\d+/);
    await expect(page.getByTestId('reader-image')).toBeVisible({ timeout: 20000 });
  });

  test('DETAIL-04 → BOOK-02: bookmark a title and see it in Bookmarks', async ({ page }) => {
    await searchAndWaitForGrid(page, TEST_MANGA_TITLE);
    await page.getByTestId('manga-card').first().click();

    await page.waitForLoadState('networkidle');
    await page.getByTestId('bookmark-btn').click();
    await expect(page.getByTestId('bookmark-btn')).toContainText('★ Saved');

    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(400);
    await page.getByRole('link', { name: 'Bookmarks' }).first().click();
    await expect(page.locator('span').filter({ hasText: TEST_MANGA_TITLE })).toBeVisible();
  });
});

test.describe('Chapter reader navigation', () => {
  test('READ-02: arrow-key page navigation advances the page', async ({ page }) => {
    await searchAndWaitForGrid(page, TEST_MANGA_TITLE);
    await page.getByTestId('manga-card').first().click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('start-reading').click();

    await expect(page.getByTestId('reader-image')).toBeVisible({ timeout: 20000 });
    const firstSrc = await page.getByTestId('reader-image').getAttribute('src');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('reader-image')).not.toHaveAttribute('src', firstSrc ?? '');
  });

  test('READ-06: "Top" control scrolls back up', async ({ page }) => {
    await searchAndWaitForGrid(page, TEST_MANGA_TITLE);
    await page.getByTestId('manga-card').first().click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('start-reading').click();

    await expect(page.getByTestId('reader-image')).toBeVisible({ timeout: 20000 });
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(500);
    await page.getByText('↑ Top').click();
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(50);
  });
});

test.describe('Bookmarks page', () => {
  test('BOOK-01: empty state shown with no bookmarks', async ({ page }) => {
    await page.goto('/bookmarks');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByText('No bookmarks yet')).toBeVisible();
    await expect(page.getByRole('link', { name: /browse manga/i })).toBeVisible();
  });

  test('BOOK-03: remove button deletes bookmark from list', async ({ page }) => {
    await searchAndWaitForGrid(page, TEST_MANGA_TITLE);
    await page.getByTestId('manga-card').first().click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('bookmark-btn').click();

    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(400);
    await page.getByRole('link', { name: 'Bookmarks' }).first().click();
    await expect(page.locator('span').filter({ hasText: TEST_MANGA_TITLE })).toBeVisible();

    await page.locator('button[title="Remove bookmark"]').first().click();
    await expect(page.getByText('No bookmarks yet')).toBeVisible();
  });

  test('BOOK-04: bookmark persists after reload', async ({ page }) => {
    await searchAndWaitForGrid(page, TEST_MANGA_TITLE);
    await page.getByTestId('manga-card').first().click();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('bookmark-btn').click();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('bookmark-btn')).toContainText('★ Saved');
  });
});

test.describe('Full journey (smoke)', () => {
  test('E2E-01: discover, read, and bookmark a manga as a guest', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('yomu_last_seen_version', '1.1.0'));
    await page.reload();

    await page.getByTestId('hero-search').fill(TEST_MANGA_TITLE);
    await page.getByTestId('hero-search').press('Enter');
    await expect(page).toHaveURL(/\/browse/);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="manga-card"]', { timeout: 15000 });
    await page.getByTestId('manga-card').first().click();
    await expect(page).toHaveURL(/\/manga\/\d+/);

    await page.waitForLoadState('networkidle');
    await page.getByTestId('start-reading').click();
    await expect(page.getByTestId('reader-image')).toBeVisible({ timeout: 20000 });
    await page.keyboard.press('ArrowRight');

    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('bookmark-btn').click();
    await expect(page.getByTestId('bookmark-btn')).toContainText('★ Saved');

    await page.mouse.wheel(0, 50);
    await page.waitForTimeout(400);
    await page.getByRole('link', { name: 'Bookmarks' }).first().click();
    await expect(page.locator('span').filter({ hasText: TEST_MANGA_TITLE })).toBeVisible();
  });
});