import { expect, test } from '@playwright/test';

test.describe('critical path', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in and can navigate fleet views', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('itadmin@ricoz.local');
    await page.locator('input[type="password"]').fill('itadmin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();

    await page.goto('/devices');
    await expect(page).toHaveURL(/\/devices/);
    await expect(page.getByRole('heading', { level: 1, name: /^Devices$/ })).toBeVisible();

    await page.goto('/alerts');
    await expect(page).toHaveURL(/\/alerts/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1, name: /Alerts/i })).toBeVisible();
  });
});
