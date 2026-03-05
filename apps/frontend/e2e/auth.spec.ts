import { test, expect } from "@playwright/test";

const TEST_PASSWORD = "password123";
const TEST_NAME = "E2E Test User";

function uniqueEmail() {
  return `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

test.describe("Auth flow", () => {
  test("signup → dashboard → logout → signin → dashboard", async ({
    page,
  }) => {
    const email = uniqueEmail();

    // 1. Go to signup page
    await page.goto("/signup");
    await expect(page.locator("h1")).toHaveText("Sign Up");

    // 2. Fill and submit signup form
    await page.fill('input[name="name"]', TEST_NAME);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // 3. Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.locator("h1")).toHaveText("Dashboard");
    await expect(page.locator("text=" + email)).toBeVisible();

    // 4. Logout
    await page.click("text=Log out");
    await expect(page).toHaveURL(/\/signin/, { timeout: 10_000 });

    // 5. Sign in with same credentials
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // 6. Should redirect to dashboard again
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.locator("text=" + email)).toBeVisible();
  });

  test("signup with duplicate email shows error", async ({ page }) => {
    const email = uniqueEmail();

    // First signup
    await page.goto("/signup");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Clear cookies to go back to signup
    await page.context().clearCookies();
    await page.goto("/signup");

    // Try duplicate signup
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should show error, stay on signup page
    await expect(page.locator("text=Email already registered")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/signup/);
  });

  test("signin with wrong password shows error", async ({ page }) => {
    const email = uniqueEmail();

    // Register first so user exists
    await page.goto("/signup");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Clear cookies and try wrong password
    await page.context().clearCookies();
    await page.goto("/signin");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=Invalid credentials")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/signin/);
  });
});
