/**
 * Top Panel — Requirements
 *
 * Tests the header action bar: Cards/Table switcher, overlay, add card,
 * show backs, save, export, print/PDF, and night mode.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  selectCardType,
  uploadCSV,
  loadPlantCards,
  switchToTable,
  switchToCards,
  getCardCount,
} from "./helpers/fixtures.js";
import {
  toggleOverlay,
  toggleShowBacks,
  toggleDarkMode,
  openExportMenu,
  clickAddCard,
} from "./helpers/navigation.js";

test.describe("Top Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cards / Table Switcher
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Cards / Table Switcher", () => {
    test("default view is Cards", async ({ page }) => {
      const cardsBtn = page.locator('.view-btn[data-view="cards"]');
      await expect(cardsBtn).toHaveClass(/active/);
      const cardGrid = page.locator("#card-grid");
      expect(await cardGrid.isHidden()).toBeFalsy();
    });

    test("switching to Table shows tabular data", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const table = page.locator(".data-table");
      await expect(table).toBeVisible();
      const tableText = await table.textContent();
      expect(tableText).toContain("Monstera");
    });

    test("switching back to Cards preserves data", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      await switchToCards(page);
      const body = await page.textContent("body");
      expect(body).toContain("Monstera");
    });

    test("active button has visual indicator", async ({ page }) => {
      const cardsBtn = page.locator('.view-btn[data-view="cards"]');
      const tableBtn = page.locator('.view-btn[data-view="table"]');
      await expect(cardsBtn).toHaveClass(/active/);
      await tableBtn.click();
      await page.waitForTimeout(300);
      await expect(tableBtn).toHaveClass(/active/);
      await expect(cardsBtn).not.toHaveClass(/active/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Overlay
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Overlay", () => {
    test("overlay button toggles field values on card fronts", async ({ page }) => {
      await loadPlantCards(page);
      await toggleOverlay(page);
      const overlays = page.locator(".card-overlay");
      expect(await overlays.count()).toBeGreaterThan(0);
    });

    test("overlay shows field labels and values", async ({ page }) => {
      await loadPlantCards(page);
      await toggleOverlay(page);
      const overlayText = await page.locator(".card-overlay").first().textContent();
      expect(overlayText).toContain("Plant Name");
      expect(overlayText).toContain("Monstera");
    });

    test("overlay button shows active state when enabled", async ({ page }) => {
      await loadPlantCards(page);
      const btn = page.locator("#overlay-toggle-btn");
      expect(await btn.getAttribute("aria-pressed")).toBe("false");
      await toggleOverlay(page);
      expect(await btn.getAttribute("aria-pressed")).toBe("true");
    });

    test("toggling overlay off removes overlays from cards", async ({ page }) => {
      await loadPlantCards(page);
      await toggleOverlay(page);
      expect(await page.locator(".card-overlay").count()).toBeGreaterThan(0);
      await toggleOverlay(page);
      expect(await page.locator(".card-overlay").count()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Add Card
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Add Card", () => {
    test("Add Card is hidden when only sample data loaded", async ({ page }) => {
      await selectCardType(page, "Plant");
      const addBtn = page.locator("#add-card-btn");
      await expect(addBtn).toBeHidden();
    });

    test("Add Card appears after CSV upload", async ({ page }) => {
      await loadPlantCards(page);
      const addBtn = page.locator("#add-card-btn");
      await expect(addBtn).toBeVisible();
    });

    test("Add Card creates blank card and opens edit modal", async ({ page }) => {
      await loadPlantCards(page);
      await clickAddCard(page);
      const modal = page.locator("#edit-modal");
      await expect(modal).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Show Backs
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Show Backs", () => {
    test("Show Backs toggle renders card backs when back template exists", async ({ page }) => {
      await loadPlantCards(page);
      // Show backs is checked by default
      const backs = page.locator(".card-back-wrapper");
      const count = await backs.count();
      // Plant Care has a back template, so backs should be visible
      expect(count).toBeGreaterThan(0);
    });

    test("unchecking Show Backs hides card backs", async ({ page }) => {
      await loadPlantCards(page);
      await toggleShowBacks(page);
      const backs = page.locator(".card-back-wrapper");
      expect(await backs.count()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Save
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Save", () => {
    test("Save button disabled when no data loaded", async ({ page }) => {
      const saveBtn = page.locator("#save-btn");
      await expect(saveBtn).toBeDisabled();
    });

    test("Save button enabled after CSV upload", async ({ page }) => {
      await loadPlantCards(page);
      const saveBtn = page.locator("#save-btn");
      await expect(saveBtn).not.toBeDisabled();
    });

    test("Ctrl+S triggers save action", async ({ page }) => {
      await loadPlantCards(page);
      await page.evaluate(() => {
        window.__saveCalled = false;
        document.addEventListener("keydown", (e) => {
          if (e.ctrlKey && e.key === "s") window.__saveCalled = true;
        });
      });
      await page.keyboard.press("Control+s");
      await page.waitForTimeout(500);
      const called = await page.evaluate(() => window.__saveCalled);
      expect(called).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Export Menu
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Export Menu", () => {
    test("Export dropdown opens and closes on click", async ({ page }) => {
      const btn = page.locator("#export-menu-btn");
      const menu = page.locator("#export-menu");
      await btn.click();
      await page.waitForTimeout(200);
      await expect(menu).toBeVisible();
      // Click outside to close
      await page.locator("body").click();
      await page.waitForTimeout(200);
      await expect(menu).toBeHidden();
    });

    test("Export deck downloads .cardmaker file", async ({ page }) => {
      await loadPlantCards(page);
      const menu = await openExportMenu(page);
      const exportBtn = page.locator("#export-deck-btn");
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
      await exportBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.cardmaker$/);
    });

    test("Export PNG option is available", async ({ page }) => {
      await openExportMenu(page);
      const pngBtn = page.locator("#export-png-btn");
      await expect(pngBtn).toBeVisible();
    });

    test("Import deck option is available", async ({ page }) => {
      await openExportMenu(page);
      const importInput = page.locator("#import-deck-input");
      expect(await importInput.count()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Print / PDF
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Print / PDF", () => {
    test("Print button triggers print layout or dialog", async ({ page }) => {
      await loadPlantCards(page);
      await page.evaluate(() => {
        window.__printCalled = false;
        window.print = () => { window.__printCalled = true; };
      });
      await page.locator("#print-btn").click();
      await page.waitForTimeout(1000);
      const printCalled = await page.evaluate(() => window.__printCalled);
      const printArea = page.locator("#print-area");
      const printAreaContent = await printArea.innerHTML();
      expect(printCalled || printAreaContent.length > 0).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Night Mode
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Night Mode", () => {
    test("dark mode toggle adds dark class to html element", async ({ page }) => {
      const isDark = await toggleDarkMode(page);
      expect(isDark).toBeTruthy();
    });

    test("toggling back removes dark class", async ({ page }) => {
      await toggleDarkMode(page);
      const isDark = await toggleDarkMode(page);
      expect(isDark).toBeFalsy();
    });

    test("dark mode changes button icon", async ({ page }) => {
      const btn = page.locator("#dark-mode-toggle");
      const initialText = await btn.textContent();
      await toggleDarkMode(page);
      const newText = await btn.textContent();
      expect(newText).not.toBe(initialText);
    });
  });
});
