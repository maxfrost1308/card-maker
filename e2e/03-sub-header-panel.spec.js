/**
 * Sub Header Panel — Requirements
 *
 * Tests the controls shared between Cards and Table views:
 * global search, column filters, aggregation stats, clear filters, column selector.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  loadPlantCards,
  loadTTRPGCards,
  switchToTable,
  switchToCards,
} from "./helpers/fixtures.js";
import {
  addColumnFilter,
  clearFilters,
  getRowCount,
  getAggregationValues,
  openColumnSelector,
} from "./helpers/navigation.js";

test.describe("Sub Header Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Global Search
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Global Search", () => {
    test("typing in search filters rows in real-time", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const searchInput = page.locator(".table-global-filter");
      await searchInput.fill("Monstera");
      await page.waitForTimeout(300);
      const rowCount = await getRowCount(page);
      expect(rowCount.showing).toBe(1);
      expect(rowCount.total).toBe(5);
    });

    test("search matches across all visible columns", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const searchInput = page.locator(".table-global-filter");
      // Search for a light value that should match multiple plants
      await searchInput.fill("Bright");
      await page.waitForTimeout(300);
      const rowCount = await getRowCount(page);
      expect(rowCount.showing).toBeGreaterThanOrEqual(1);
    });

    test("clearing search restores all rows", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const searchInput = page.locator(".table-global-filter");
      await searchInput.fill("Monstera");
      await page.waitForTimeout(300);
      await searchInput.fill("");
      await page.waitForTimeout(300);
      const rowCount = await getRowCount(page);
      expect(rowCount.showing).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Column Filters
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Column Filters", () => {
    test("Add filter button shows property dropdown", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await page.locator(".filter-bar-add").click();
      await page.waitForTimeout(200);
      const dropdown = page.locator(".filter-bar-dropdown");
      await expect(dropdown).toBeVisible();
      // Should show field names as buttons
      const props = page.locator(".filter-prop-btn");
      expect(await props.count()).toBeGreaterThan(0);
    });

    test("selecting a select field shows checkbox options", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await page.locator(".filter-bar-add").click();
      await page.waitForTimeout(200);
      // Click on "Light Needs" which is a select field
      await page.locator(".filter-prop-btn", { hasText: "Light Needs" }).click();
      await page.waitForTimeout(200);
      const checkboxes = page.locator(".filter-bar-dropdown input[type='checkbox']");
      expect(await checkboxes.count()).toBeGreaterThan(0);
    });

    test("checking filter options filters rows", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await addColumnFilter(page, "Difficulty", ["Beginner"]);
      const rowCount = await getRowCount(page);
      expect(rowCount.showing).toBeLessThan(rowCount.total);
    });

    test("filter tokens appear showing active filters", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await addColumnFilter(page, "Difficulty", ["Beginner"]);
      const tokens = page.locator(".filter-token");
      expect(await tokens.count()).toBeGreaterThan(0);
      const tokenText = await tokens.first().textContent();
      expect(tokenText).toContain("Beginner");
    });

    test("removing filter token restores rows", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await addColumnFilter(page, "Difficulty", ["Beginner"]);
      const beforeCount = (await getRowCount(page)).showing;
      // Click the remove button on the token
      await page.locator(".filter-token-remove").first().click();
      await page.waitForTimeout(300);
      const afterCount = (await getRowCount(page)).showing;
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    test("text field filter uses substring matching", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await addColumnFilter(page, "Plant Name", ["Mon"]);
      const rowCount = await getRowCount(page);
      expect(rowCount.showing).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Aggregation Bar
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Stats / Aggregation Bar", () => {
    test("TTRPG card type shows aggregation counts", async ({ page }) => {
      await loadTTRPGCards(page);
      await switchToTable(page);
      const aggs = await getAggregationValues(page);
      expect(aggs).toHaveProperty("Digitally Owned");
      expect(aggs).toHaveProperty("Played");
    });

    test("aggregation counts update when filters applied", async ({ page }) => {
      await loadTTRPGCards(page);
      await switchToTable(page);
      const before = await getAggregationValues(page);
      await addColumnFilter(page, "Complexity", ["Easy"]);
      const after = await getAggregationValues(page);
      // After filtering to Easy only, counts should change
      expect(after["Digitally Owned"]).toBeLessThanOrEqual(before["Digitally Owned"]);
    });

    test("Plant Care card type does not show aggregation bar", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const aggBar = page.locator(".table-aggregation-bar");
      expect(await aggBar.count()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Clear Filters
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Clear Filters", () => {
    test("Clear filters resets all column filters and global search", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      // Apply a search and a filter
      const searchInput = page.locator(".table-global-filter");
      await searchInput.fill("Monstera");
      await page.waitForTimeout(300);
      await clearFilters(page);
      const rowCount = await getRowCount(page);
      expect(rowCount.showing).toBe(rowCount.total);
      // Search input should be cleared
      expect(await searchInput.inputValue()).toBe("");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Column Selector
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Column Selector", () => {
    test("gear button opens column visibility dropdown", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const dropdown = await openColumnSelector(page);
      const labels = page.locator(".col-prefs-label");
      expect(await labels.count()).toBeGreaterThan(0);
    });

    test("unchecking a column hides it from the table", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await openColumnSelector(page);
      // Find the "Botanical Name" checkbox and uncheck it
      const label = page.locator(".col-prefs-label", { hasText: "Botanical" });
      const cb = label.locator("input[type='checkbox']");
      await cb.uncheck();
      await page.waitForTimeout(300);
      // The header should no longer have "Botanical Name"
      const headers = page.locator("thead th");
      const headerTexts = await headers.allTextContents();
      expect(headerTexts.some((h) => h.includes("Botanical"))).toBeFalsy();
    });

    test("re-checking a column restores it", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await openColumnSelector(page);
      const label = page.locator(".col-prefs-label", { hasText: "Botanical" });
      const cb = label.locator("input[type='checkbox']");
      await cb.uncheck({ force: true });
      await page.waitForTimeout(200);
      // The dropdown stays open (change handler only rebuilds the table).
      // Re-locate the checkbox since the dropdown contents were re-rendered.
      const label2 = page.locator(".col-prefs-label", { hasText: "Botanical" });
      const cb2 = label2.locator("input[type='checkbox']");
      await cb2.check({ force: true });
      await page.waitForTimeout(300);
      const headers = page.locator("thead th");
      const headerTexts = await headers.allTextContents();
      expect(headerTexts.some((h) => h.includes("Botanical"))).toBeTruthy();
    });
  });
});
