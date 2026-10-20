import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoA11yViolations(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  const details = violations.map(({ id, impact, help, nodes }) => ({
    id,
    impact,
    help,
    examples: nodes.slice(0, 3).map((node) => node.target)
  }));
  expect(details, `${label} WCAG accessibility violations`).toEqual([]);
}

async function expectNoViewportOverflow(page, width) {
  await page.setViewportSize({ width, height: 900 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow, `page should fit a ${width}px viewport without horizontal page scrolling`).toBe(false);
}

test('landing and generated trip guide meet WCAG AA checks across phone and desktop widths', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Skip to trip planner' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to trip planner' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mainContent')).toBeFocused();
  await expect(page.getByLabel('WHERE TO?')).toBeVisible();
  await expect(page.getByLabel('ARRIVAL')).toBeVisible();
  await expect(page.getByLabel('TRIP LENGTH')).toBeVisible();

  for (const width of [320, 375, 768, 1440]) {
    await expectNoViewportOverflow(page, width);
  }
  await expectNoA11yViolations(page, 'Landing page');

  await page.getByLabel('WHERE TO?').fill('Munich');
  await page.getByLabel('WHAT DO YOU LIKE? OPTIONAL').fill('museums and local food');
  await page.getByRole('button', { name: 'Build my guide' }).click();
  await expect(page.locator('.result-head h2')).toContainText(/days in/i, { timeout: 90_000 });
  await expect(page.getByRole('table', { name: 'Trip overview' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Daily weather forecast' })).toBeVisible();
  await expectNoA11yViolations(page, 'Generated guide at desktop width');

  for (const width of [320, 375, 768, 1440]) {
    await expectNoViewportOverflow(page, width);
    if (width === 320 || width === 375) await expectNoA11yViolations(page, `Generated guide at ${width}px`);
  }
});
