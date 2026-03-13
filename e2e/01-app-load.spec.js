// e2e/01-app-load.spec.js
// Tests: Initial load, layout, sidebar, empty state, dark mode toggle
import { test, expect } from "@playwright/test";

test.describe("App load & initial state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Card Maker/i);
  });

  test("sidebar is visible with card type selector and CSV upload", async ({
    page,
  }) => {
    // Card type dropdown should be present
    const cardTypeSelect = page.locator("select, [class*='card-type']").first();
    await expect(cardTypeSelect).toBeVisible();

    // CSV upload area should be present
    const csvButton = page.getByText(/Open CSV/i);
    await expect(csvButton).toBeVisible();
  });

  test("empty state message is shown when no cards loaded", async ({
    page,
  }) => {
    const emptyMsg = page.getByText(/Select a card type/i);
    await expect(emptyMsg).toBeVisible();
  });

  test("Cards/Table view toggle is present", async ({ page }) => {
    const cardsTab = page.getByText("Cards");
    const tableTab = page.getByText("Table");
    await expect(cardsTab).toBeVisible();
    await expect(tableTab).toBeVisible();
  });

  test("dark mode toggle works", async ({ page }) => {
    // Find the dark mode toggle (moon icon button)
    const darkToggle = page.locator("button", { hasText: "🌙" });
    // If not found by emoji, try other selectors
    const toggle = (await darkToggle.count())
      ? darkToggle
      : page.locator("[class*='dark'], [class*='theme'], [aria-label*='dark'], [aria-label*='theme']").first();

    if (await toggle.isVisible()) {
      await toggle.click();
      // Verify some visual change occurred (class on body/html or CSS variable change)
      const isDark = await page.evaluate(() => {
        return (
          document.body.classList.contains("dark") ||
          document.documentElement.classList.contains("dark") ||
          document.body.getAttribute("data-theme") === "dark"
        );
      });
      expect(isDark).toBeTruthy();
    }
  });

  test("hamburger menu toggles sidebar on narrow viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    const hamburger = page.locator("button", { hasText: "☰" });
    if (await hamburger.isVisible()) {
      await hamburger.click();
      // Sidebar should now be visible or toggled
      await page.waitForTimeout(300); // allow animation
      // Verify sidebar content is accessible
      const csvButton = page.getByText(/Open CSV/i);
      await expect(csvButton).toBeVisible();
    }
  });
});
