import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("root redirects to /signin", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("signin page renders correctly", async ({ page }) => {
    await page.goto("/signin");

    await expect(page.locator("h1")).toHaveText("Sign In");
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText("Sign In");
    await expect(page.locator('a[href="/signup"]')).toBeVisible();
  });

  test("signup page renders correctly", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.locator("h1")).toHaveText("Sign Up");
    await expect(page.locator('label[for="name"]')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText("Sign Up");
    await expect(page.locator('a[href="/signin"]')).toBeVisible();
  });

  test("dashboard redirects to /signin when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("signin page has link to signup", async ({ page }) => {
    await page.goto("/signin");
    await page.click('a[href="/signup"]');
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.locator("h1")).toHaveText("Sign Up");
  });
});
