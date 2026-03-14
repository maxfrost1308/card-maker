/**
 * Table Cell Editing — Requirements
 *
 * Tests inline cell editing for each data type, keyboard navigation,
 * and undo/redo. This is the modular test file that covers editing
 * combinations across data types without cardinality explosion.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  loadPlantCards,
  loadTTRPGCards,
  switchToTable,
} from "./helpers/fixtures.js";

test.describe("Table Cell Editing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Text Field Editing
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Text Field Editing", () => {
    test("click cell to enter edit mode shows input", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      // Click the first name cell (text field)
      const nameCell = page.locator('td[data-nav-row="0"][data-nav-col="0"]');
      await nameCell.click();
      await page.waitForTimeout(300);
      const input = nameCell.locator("input.cell-edit-input");
      await expect(input).toBeVisible();
    });

    test("type new value and press Enter to commit", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const nameCell = page.locator('td[data-nav-row="0"][data-nav-col="0"]');
      await nameCell.click();
      await page.waitForTimeout(300);
      const input = nameCell.locator("input.cell-edit-input");
      await input.fill("Updated Plant");
      await input.press("Enter");
      await page.waitForTimeout(300);
      const cellText = await nameCell.textContent();
      expect(cellText).toContain("Updated Plant");
    });

    test("press Escape to cancel edit and restore original value", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const nameCell = page.locator('td[data-nav-row="0"][data-nav-col="0"]');
      const originalText = await nameCell.textContent();
      await nameCell.click();
      await page.waitForTimeout(300);
      const input = nameCell.locator("input.cell-edit-input");
      await input.fill("Should Not Save");
      await input.press("Escape");
      await page.waitForTimeout(300);
      const cellText = await nameCell.textContent();
      expect(cellText).toBe(originalText);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Select Field Editing
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Select Field Editing", () => {
    test("click select cell shows pill picker", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      // Find a cell that's a select field (e.g., Difficulty)
      // Difficulty is not the first visible column, need to find its column index
      const headers = page.locator("thead th[data-key]");
      const headerTexts = await headers.allTextContents();
      const difficultyIdx = headerTexts.findIndex((h) => h.includes("Difficulty"));
      if (difficultyIdx >= 0) {
        const cell = page.locator(`td[data-nav-row="0"][data-nav-col="${difficultyIdx}"]`);
        await cell.click();
        await page.waitForTimeout(300);
        const picker = cell.locator(".pill-picker");
        await expect(picker).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Multi-Select Field Editing
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Multi-Select Field Editing", () => {
    test("click multi-select cell shows pill picker", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const headers = page.locator("thead th[data-key]");
      const headerTexts = await headers.allTextContents();
      const seasonsIdx = headerTexts.findIndex((h) => h.includes("Active Seasons"));
      if (seasonsIdx >= 0) {
        const cell = page.locator(`td[data-nav-row="0"][data-nav-col="${seasonsIdx}"]`);
        await cell.click();
        await page.waitForTimeout(300);
        const picker = cell.locator(".pill-picker");
        await expect(picker).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Tags Field Editing
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Tags Field Editing", () => {
    test("click tags cell shows tag picker", async ({ page }) => {
      await loadTTRPGCards(page);
      await switchToTable(page);
      const headers = page.locator("thead th[data-key]");
      const headerTexts = await headers.allTextContents();
      const collectionsIdx = headerTexts.findIndex((h) => h.includes("Collections"));
      if (collectionsIdx >= 0) {
        const cell = page.locator(`td[data-nav-row="0"][data-nav-col="${collectionsIdx}"]`);
        await cell.click();
        await page.waitForTimeout(300);
        const picker = cell.locator(".tag-picker");
        await expect(picker).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Keyboard Navigation
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Keyboard Navigation", () => {
    test("arrow keys navigate between cells", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const firstCell = page.locator('td[data-nav-row="0"][data-nav-col="0"]');
      await firstCell.focus();
      // Press ArrowDown to move to next row
      await page.keyboard.press("ArrowDown");
      const focused = await page.evaluate(() => ({
        row: document.activeElement?.dataset?.navRow,
        col: document.activeElement?.dataset?.navCol,
      }));
      expect(focused.row).toBe("1");
      expect(focused.col).toBe("0");
    });

    test("ArrowRight moves to next column", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const firstCell = page.locator('td[data-nav-row="0"][data-nav-col="0"]');
      await firstCell.focus();
      await page.keyboard.press("ArrowRight");
      const focused = await page.evaluate(() => ({
        row: document.activeElement?.dataset?.navRow,
        col: document.activeElement?.dataset?.navCol,
      }));
      expect(focused.row).toBe("0");
      expect(focused.col).toBe("1");
    });

    test("Enter starts editing focused cell", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const firstCell = page.locator('td[data-nav-row="0"][data-nav-col="0"]');
      await firstCell.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const input = firstCell.locator("input, .pill-picker, .tag-picker");
      expect(await input.count()).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Undo / Redo
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Undo / Redo", () => {
    test("Ctrl+Z undoes the last cell edit", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const nameCell = page.locator('td[data-nav-row="0"][data-nav-col="0"]');
      const originalText = await nameCell.textContent();
      // Edit the cell
      await nameCell.click();
      await page.waitForTimeout(300);
      const input = nameCell.locator("input.cell-edit-input");
      await input.fill("Changed Name");
      await input.press("Enter");
      await page.waitForTimeout(300);
      expect(await nameCell.textContent()).toContain("Changed Name");
      // Undo
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(500);
      const restoredText = await nameCell.textContent();
      expect(restoredText).toBe(originalText);
    });

    test("Ctrl+Shift+Z redoes the undone edit", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const nameCell = page.locator('td[data-nav-row="0"][data-nav-col="0"]');
      // Edit
      await nameCell.click();
      await page.waitForTimeout(300);
      const input = nameCell.locator("input.cell-edit-input");
      await input.fill("Redo Test");
      await input.press("Enter");
      await page.waitForTimeout(300);
      // Undo
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(500);
      // Redo
      await page.keyboard.press("Control+Shift+z");
      await page.waitForTimeout(500);
      expect(await nameCell.textContent()).toContain("Redo Test");
    });
  });
});
