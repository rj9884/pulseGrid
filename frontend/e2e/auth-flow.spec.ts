import { test, expect } from "@playwright/test";

test.describe("Auth Flow", () => {
  test("register new user and access dashboard", async ({ page }) => {
    // Capture console errors
    page.on("console", msg => console.log(`BROWSER ${msg.type()}: ${msg.text()}`));
    page.on("pageerror", err => console.log(`PAGE ERROR: ${err.message}`));

    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = "TestPassword123!";

    // Navigate to register page
    await page.goto("/register");
    await expect(page).toHaveURL(/\/register$/);

    // Fill registration form (email, password, role only - no name field)
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.selectOption('select[name="role"]', "ADMIN");

    // Submit registration
    await page.click('button[type="submit"]');

    // Wait for redirect - should redirect to dashboard (home page) after successful registration
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Check if "Telemetry & Uptime Monitor" is visible (in authenticated dashboard)
    await expect(page.locator("text=Telemetry & Uptime Monitor")).toBeVisible({ timeout: 10000 });

    // Verify navbar shows authenticated state
    await expect(page.locator("text=Dashboard")).toBeVisible();
    await expect(page.locator("text=Incidents")).toBeVisible();
    await expect(page.locator("text=Alerts")).toBeVisible();
    await expect(page.locator("text=Status Page")).toBeVisible();
  });

  test("login with existing credentials", async ({ page }) => {
    // First register a user
    const testEmail = `login-test-${Date.now()}@example.com`;
    const testPassword = "TestPassword123!";

    await page.goto("/register");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.selectOption('select[name="role"]', "ADMIN");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/);

    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/\/$/);

    // Login
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);

    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("text=Telemetry & Uptime Monitor")).toBeVisible();
  });

  test("logout clears session and returns to public home", async ({ page }) => {
    const testEmail = `logout-test-${Date.now()}@example.com`;
    const testPassword = "TestPassword123!";

    await page.goto("/register");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.selectOption('select[name="role"]', "ADMIN");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/);

    // Verify authenticated
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // Logout
    await page.click('button:has-text("Logout")');

    // Should show public home with sign in link - use more specific locator
    await expect(page.locator('header a:has-text("Sign In")')).toBeVisible();
    await expect(page.locator('header a:has-text("Get Started")')).toBeVisible();
  });
});