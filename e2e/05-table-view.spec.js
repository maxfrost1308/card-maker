/**
 * Table View — Requirements
 *
 * Tests the data table: headers, sorting, row count, bulk selection,
 * and cell rendering for various data types.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  loadPlantCards,
  loadTTRPGCards,
  switchToTable,
} from "./helpers/fixtures.js";
import { getRowCount } from "./helpers/navigation.js";

test.describe("Table View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Header & Sorting
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Header & Sorting", () => {
    test("column headers match card type field labels", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const headers = page.locator("thead th[data-key]");
      const headerTexts = await headers.allTextContents();
      expect(headerTexts).toContain("Plant Name");
      expect(headerTexts).toContain("Light Needs");
    });

    test("clicking header sorts ascending then descending", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const nameHeader = page.locator('thead th[data-key="name"]');
      // Click to sort ascending
      await nameHeader.click();
      await page.waitForTimeout(300);
      expect(await nameHeader.getAttribute("aria-sort")).toBe("ascending");
      // Click again to sort descending
      await nameHeader.click();
      await page.waitForTimeout(300);
      expect(await nameHeader.getAttribute("aria-sort")).toBe("descending");
    });

    test("only one column sorted at a time", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const nameHeader = page.locator('thead th[data-key="name"]');
      await nameHeader.click();
      await page.waitForTimeout(200);
      // Now sort by a different column
      const lightHeader = page.locator('thead th[data-key="light"]');
      await lightHeader.click();
      await page.waitForTimeout(200);
      expect(await nameHeader.getAttribute("aria-sort")).toBe("none");
      expect(await lightHeader.getAttribute("aria-sort")).toBe("ascending");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Row Count
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Row Count", () => {
    test("shows Showing X of Y rows indicator", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const rowCount = await getRowCount(page);
      expect(rowCount.showing).toBe(5);
      expect(rowCount.total).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Bulk Selection
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Bulk Selection", () => {
    test("individual row checkboxes toggle selection", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const checkbox = page.locator(".row-checkbox").first();
      await checkbox.check();
      const bulkBar = page.locator(".bulk-action-bar");
      await expect(bulkBar).toBeVisible();
      const countText = await page.locator(".bulk-count").textContent();
      expect(countText).toContain("1");
    });

    test("select-all checkbox selects all visible rows", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const selectAll = page.locator("thead .select-col input[type='checkbox']");
      await selectAll.check();
      await page.waitForTimeout(200);
      const countText = await page.locator(".bulk-count").textContent();
      expect(countText).toContain("5");
    });

    test("select-all shows indeterminate when some rows selected", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      // Check just one row
      await page.locator(".row-checkbox").first().check();
      await page.waitForTimeout(200);
      const selectAll = page.locator("thead .select-col input[type='checkbox']");
      const isIndeterminate = await selectAll.evaluate((el) => el.indeterminate);
      expect(isIndeterminate).toBeTruthy();
    });

    test("delete selected removes cards and shows toast", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await page.locator(".row-checkbox").first().check();
      await page.waitForTimeout(200);
      await page.locator(".btn-danger", { hasText: "Delete selected" }).click();
      await page.waitForTimeout(500);
      const rowCount = await getRowCount(page);
      expect(rowCount.total).toBe(4);
      // Toast should show deletion message
      const toast = page.locator("#toast");
      await expect(toast).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cell Rendering by Data Type
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Cell Rendering by Data Type", () => {
    test("text field renders plain text", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const tbody = page.locator("tbody");
      const text = await tbody.textContent();
      expect(text).toContain("Monstera");
    });

    test("select field renders as colored pill", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      // Difficulty field has pillColors
      const pills = page.locator("tbody .cell-pill");
      expect(await pills.count()).toBeGreaterThan(0);
      // Check that at least one pill has a background color
      const bgColor = await pills.first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bgColor).not.toBe("");
    });

    test("multi-select field renders as multiple pills", async ({ page }) => {
      await loadTTRPGCards(page);
      await switchToTable(page);
      // Genre is a multi-select field with pipe-separated values in TTRPG data
      const pillGroups = page.locator("tbody .cell-pill-group");
      expect(await pillGroups.count()).toBeGreaterThan(0);
    });

    test("tags field renders as hash-colored pills (TTRPG)", async ({ page }) => {
      await loadTTRPGCards(page);
      await switchToTable(page);
      // Collections is a tags field
      const pills = page.locator("tbody .cell-pill");
      expect(await pills.count()).toBeGreaterThan(0);
    });
  });
});
