import { test, expect } from "@playwright/test";

test.describe("Monitor Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Register and login a test user
    const testEmail = `monitor-test-${Date.now()}@example.com`;
    const testPassword = "TestPassword123!";

    await page.goto("/register");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.selectOption('select[name="role"]', "ADMIN");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/);
  });

  test("create HTTP monitor with valid URL", async ({ page }) => {
    // Verify we're on authenticated dashboard
    await expect(page.locator("text=Telemetry & Uptime Monitor")).toBeVisible({ timeout: 10000 });

    // Click create monitor button (opens modal)
    await page.click('button:has-text("Create Monitor")');

    // Wait for modal to appear
    await expect(page.locator('text=Register New Endpoint')).toBeVisible();

    // Fill monitor form in modal
    await page.fill('input[placeholder="Core API Gateway"]', "Test HTTP Monitor");
    await page.fill('input[placeholder="https://api.yourdomain.com/health"]', "https://httpbin.org/get");
    await page.selectOption('select[name="method"]', "GET");
    await page.fill('input[name="expected_status"]', "200");
    await page.fill('input[name="interval_seconds"]', "60");
    await page.fill('input[name="timeout_ms"]', "5000");

    // Submit and wait for response
    await page.click('button:has-text("Deploy Monitor")');

    // Wait for modal to close (form submission completes)
    await expect(page.locator("text=Register New Endpoint")).not.toBeVisible({ timeout: 15000 });

    // Monitor should appear in list
    await expect(page.locator("text=Test HTTP Monitor")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=https://httpbin.org/get")).toBeVisible();
  });

  test("validation error for invalid URL", async ({ page }) => {
    await page.click('button:has-text("Create Monitor")');
    await expect(page.locator('text=Register New Endpoint')).toBeVisible();

    await page.fill('input[placeholder="Core API Gateway"]', "Invalid Monitor");
    await page.fill('input[placeholder="https://api.yourdomain.com/health"]', "not-a-valid-url");
    await page.selectOption('select[name="method"]', "GET");
    await page.fill('input[name="expected_status"]', "200");
    await page.fill('input[name="interval_seconds"]', "60");
    await page.fill('input[name="timeout_ms"]', "5000");

    await page.click('button:has-text("Deploy Monitor")');

    // Should show validation error
    await expect(page.locator("text=Must be a valid HTTP or HTTPS URL")).toBeVisible({ timeout: 10000 });
  });

  test("validation error for empty name", async ({ page }) => {
    await page.click('button:has-text("Create Monitor")');
    await expect(page.locator('text=Register New Endpoint')).toBeVisible();

    await page.fill('input[placeholder="https://api.yourdomain.com/health"]', "https://example.com");
    await page.selectOption('select[name="method"]', "GET");
    await page.fill('input[name="expected_status"]', "200");
    await page.fill('input[name="interval_seconds"]', "60");
    await page.fill('input[name="timeout_ms"]', "5000");

    await page.click('button:has-text("Deploy Monitor")');

    // Should show validation error
    await expect(page.locator("text=Name is required")).toBeVisible({ timeout: 10000 });
  });

  test("pause and resume monitor", async ({ page }) => {
    // First create a monitor
    await page.click('button:has-text("Create Monitor")');
    await page.fill('input[placeholder="Core API Gateway"]', "Pause Test Monitor");
    await page.fill('input[placeholder="https://api.yourdomain.com/health"]', "https://httpbin.org/get");
    await page.selectOption('select[name="method"]', "GET");
    await page.fill('input[name="expected_status"]', "200");
    await page.fill('input[name="interval_seconds"]', "60");
    await page.fill('input[name="timeout_ms"]', "5000");
    await page.click('button:has-text("Deploy Monitor")');
    await expect(page.locator("text=Pause Test Monitor")).toBeVisible({ timeout: 10000 });

    // Pause the monitor
    await page.click('button[title="Pause Prober"]');
    await expect(page.locator('button[title="Resume Prober"]')).toBeVisible({ timeout: 10000 });

    // Resume the monitor
    await page.click('button[title="Resume Prober"]');
    await expect(page.locator('button[title="Pause Prober"]')).toBeVisible({ timeout: 10000 });
  });

  test("delete monitor", async ({ page }) => {
    // First create a monitor
    await page.click('button:has-text("Create Monitor")');
    await page.fill('input[placeholder="Core API Gateway"]', "To Delete Monitor");
    await page.fill('input[placeholder="https://api.yourdomain.com/health"]', "https://httpbin.org/get");
    await page.selectOption('select[name="method"]', "GET");
    await page.fill('input[name="expected_status"]', "200");
    await page.fill('input[name="interval_seconds"]', "60");
    await page.fill('input[name="timeout_ms"]', "5000");
    await page.click('button:has-text("Deploy Monitor")');
    await expect(page.locator("text=To Delete Monitor")).toBeVisible({ timeout: 10000 });

    // Set up dialog handler before clicking delete
    page.on('dialog', dialog => dialog.accept());

    // Delete the monitor using the delete button
    await page.click('button[title="Delete Monitor"]');

    // Should be removed from list
    await expect(page.locator("text=To Delete Monitor")).not.toBeVisible({ timeout: 10000 });
  });
});