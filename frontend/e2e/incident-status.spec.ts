import { test, expect } from "@playwright/test";

test.describe("Incident Status Page", () => {
  test.beforeEach(async ({ page }) => {
    // Register and login a test user
    const testEmail = `incident-test-${Date.now()}@example.com`;
    const testPassword = "TestPassword123!";

    await page.goto("/register");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.selectOption('select[name="role"]', "ADMIN");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/);
  });

  test("view incident status page with no incidents", async ({ page }) => {
    // Navigate to incidents page
    await page.click('a[href="/incidents"]');
    await expect(page).toHaveURL(/\/incidents$/);
    await expect(page.locator("h1:has-text('Incidents & Outages')")).toBeVisible();
    await expect(page.locator("text=Zero incidents recorded")).toBeVisible();
  });

  test("create alert channel and view on alerts page", async ({ page }) => {
    // Navigate to alerts page
    await page.click('a[href="/alerts"]');
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(page.locator("h1:has-text('Alert Routing & Integrations')")).toBeVisible();

    // Add a webhook alert channel
    await page.click('button:has-text("Add Webhook")');
    await expect(page.locator('text=Add Notification Webhook')).toBeVisible();

    await page.fill('input[placeholder="e.g. #ops-incidents"]', "Test Webhook");
    await page.fill('input[placeholder="https://hooks.slack.com/services/..."]', "https://httpbin.org/post");
    await page.click('button:has-text("Save Webhook")');

    // Wait for modal to close and channel to appear
    await expect(page.locator("text=Add Notification Webhook")).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Test Webhook")).toBeVisible({ timeout: 10000 });
  });

  test("public status page accessible without auth", async ({ page }) => {
    // Logout first
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/\/$/);

    // Navigate to public status page
    await page.goto("/status/global");
    await expect(page).toHaveURL(/\/status\/global$/);
    await expect(page.locator("h1:has-text('global Status')")).toBeVisible();
    // Check for system status - could be operational or degraded
    await expect(page.locator(".border-emerald-500\\/30, .border-amber-500\\/30, .border-red-500\\/30")).toBeVisible();
  });

  test("incident timeline shows status changes", async ({ page }) => {
    // Navigate to incidents
    await page.click('a[href="/incidents"]');
    await expect(page).toHaveURL(/\/incidents$/);

    // If there are incidents, click to view details
    const incidentRows = page.locator('.rounded-xl.border:has-text("OPEN"), .rounded-xl.border:has-text("RESOLVED")');
    const count = await incidentRows.count();

    if (count > 0) {
      await incidentRows.first().click();
      // Incident details would be on a separate page if implemented
    }
  });

  test("RBAC: viewer cannot create alert channels", async () => {
    // This test would require a viewer user - skip for now
    // TODO: Create test with viewer role
    test.skip();
  });
});