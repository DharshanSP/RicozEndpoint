import { test, expect } from '@playwright/test';

async function login(page, email, password) {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|devices)/, { timeout: 30000 });
}

test.describe('Operator/Viewer enrollment workflow', () => {
  test('operator sees request entry points and can download the agent', async ({ page }) => {
    await login(page, 'operator@ricoz.local', 'operator123');

    // Devices page: must offer the request path, not the admin generator.
    await page.goto('/devices');
    await expect(page.getByRole('button', { name: /request enrollment token/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /^start enrollment$/i })).toHaveCount(0);

    // Enrollment tokens page: request button + agent download must exist.
    await page.goto('/enrollment-tokens');
    await expect(page.getByRole('button', { name: /request token/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /download agent/i })).toBeVisible();
  });

  test('operator can submit an enrollment token request', async ({ page }) => {
    await login(page, 'operator@ricoz.local', 'operator123');
    await page.goto('/enrollment-tokens');

    await page.getByRole('button', { name: /request token/i }).click();
    await page.getByPlaceholder(/field laptops/i).fill('E2E Operator Rollout');
    await page.getByPlaceholder(/replacement laptops/i).fill('E2E: two machines need enrollment.');
    await page.getByRole('button', { name: /submit request/i }).click();

    // The request should land in "My Token Requests" as Pending.
    await expect(page.getByText('E2E Operator Rollout')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Pending')).toBeVisible();
  });

  test('IT admin can approve and the requester reveals the token once', async ({ page, context }) => {
    await login(page, 'itadmin@ricoz.local', 'itadmin123');
    await page.goto('/enrollment-tokens');
    await expect(page.getByText('E2E Operator Rollout')).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /^approve$/i }).first().click();
    await page.locator('textarea').first().fill('Approved for the E2E rollout.');
    await page.getByRole('button', { name: /approve request/i }).click();
    await expect(page.getByText('Approved', { exact: false }).first()).toBeVisible({ timeout: 20000 });

    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, 'operator@ricoz.local', 'operator123');
    await page.goto('/enrollment-tokens');

    await page.getByRole('button', { name: /view token/i }).first().click();
    await expect(page.getByText(/rich_/).first()).toBeVisible({ timeout: 20000 });
    // One-time reveal: the affordance must disappear afterwards.
    await expect(page.getByRole('button', { name: /view token/i })).toHaveCount(0);
  });

  test('viewer is read-only but can still request a token', async ({ page }) => {
    await login(page, 'viewer@ricoz.local', 'viewer123');
    await page.goto('/enrollment-tokens');
    await expect(page.getByRole('button', { name: /request token/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /generate token/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /download agent/i })).toBeVisible();
  });
});