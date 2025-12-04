/**
 * Accessibility E2E tests using Playwright and axe-playwright.
 * 
 * Requirements:
 *   - @playwright/test
 *   - axe-playwright
 * 
 * Run: npx playwright test e2e/a11y.spec.ts
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('homepage should have no critical accessibility violations', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('deck builder page should be accessible', async ({ page }) => {
    await page.goto('/deck-builder');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    // Filter to only critical violations
    const critical = accessibilityScanResults.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  test('login form should be keyboard accessible', async ({ page }) => {
    await page.goto('/');
    
    // Open login modal
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForSelector('[role="dialog"]');
    
    // Tab to email input
    await page.keyboard.press('Tab');
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeFocused();
    
    // Tab to password input
    await page.keyboard.press('Tab');
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeFocused();
    
    // Tab to submit button
    await page.keyboard.press('Tab');
    const submitButton = page.getByRole('button', { name: /log in/i });
    await expect(submitButton).toBeFocused();
    
    // Test Esc key closes modal
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('skip link should work', async ({ page }) => {
    await page.goto('/');
    
    // Find skip link
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeVisible({ state: 'hidden' }); // Hidden until focused
    
    // Focus skip link
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
    
    // Activate skip link
    await skipLink.click();
    
    // Main content should be focused
    const main = page.locator('main[id="main-content"]').or(page.locator('main').first());
    await expect(main).toBeFocused();
  });

  test('focus should be trapped in modal', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForSelector('[role="dialog"]');
    
    // Get all focusable elements in modal
    const focusable = page.locator('[role="dialog"] button, [role="dialog"] input, [role="dialog"] [tabindex="0"]');
    const firstFocusable = focusable.first();
    const lastFocusable = focusable.last();
    
    // Focus last element
    await lastFocusable.focus();
    
    // Tab should wrap to first element
    await page.keyboard.press('Tab');
    await expect(firstFocusable).toBeFocused();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/deck-builder');
    
    // Check for h1
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    
    // Verify no skipped heading levels (h1 → h2, not h1 → h3)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    let lastLevel = 0;
    
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const level = parseInt(tagName.charAt(1), 10);
      
      if (lastLevel > 0 && level > lastLevel + 1) {
        throw new Error(`Skipped heading level: ${tagName} after h${lastLevel}`);
      }
      
      lastLevel = level;
    }
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/');
    
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaHidden = await img.getAttribute('aria-hidden');
      
      // Either alt text or aria-hidden="true" for decorative images
      expect(alt !== null || ariaHidden === 'true').toBeTruthy();
    }
  });
});

