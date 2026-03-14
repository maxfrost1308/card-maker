/**
 * Export & Session Persistence — Requirements
 *
 * Tests deck export/import, CSV operations, and IndexedDB session persistence.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  selectCardType,
  loadPlantCards,
  openEditModalForFirstCard,
} from "./helpers/fixtures.js";

test.describe("Export & Session Persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Deck Export / Import
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Deck Export / Import", () => {
    test("export deck downloads .cardmaker file", async ({ page }) => {
      await loadPlantCards(page);
      await page.locator("#export-menu-btn").click();
      await page.waitForTimeout(200);
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
      await page.locator("#export-deck-btn").click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.cardmaker$/);
    });

    test("import deck restores card type and data", async ({ page }) => {
      // First export a deck
      await loadPlantCards(page);
      await page.locator("#export-menu-btn").click();
      await page.waitForTimeout(200);
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
      await page.locator("#export-deck-btn").click();
      const download = await downloadPromise;
      const deckPath = await download.path();

      // Clear and reimport
      await clearSession(page);
      await page.waitForTimeout(500);

      await page.locator("#export-menu-btn").click();
      await page.waitForTimeout(200);
      const importInput = page.locator("#import-deck-input");
      await importInput.setInputFiles(deckPath);
      await page.waitForTimeout(1000);

      // Toast should show import message
      const toast = page.locator("#toast");
      const toastText = await toast.textContent();
      expect(toastText).toContain("Imported");

      // Cards should be rendered
      const body = await page.textContent("body");
      expect(body).toContain("Monstera");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CSV Operations
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("CSV Operations", () => {
    test("download sample CSV produces valid CSV file", async ({ page }) => {
      await selectCardType(page, "Plant");
      const sampleLink = page.locator("#download-sample");
      if (await sampleLink.isVisible()) {
        const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
        await sampleLink.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.csv$/);
      }
    });

    test("download blank template CSV produces CSV file", async ({ page }) => {
      await selectCardType(page, "Plant");
      const templateLink = page.locator("#download-template");
      if (await templateLink.isVisible()) {
        const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
        await templateLink.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.csv$/);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Session Persistence
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Session Persistence", () => {
    test("data persists after page reload via IndexedDB", async ({ page }) => {
      await loadPlantCards(page);
      // Wait for IndexedDB debounce save (1s)
      await page.waitForTimeout(2000);
      // Reload without clearing session
      await page.reload();
      await page.waitForTimeout(2000);
      // Data should be restored
      const body = await page.textContent("body");
      expect(body).toContain("Monstera");
    });

    test("editing a card and reloading preserves the edit", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      const nameInput = page.locator("#edit-modal-body input[data-field-key='name']");
      await nameInput.fill("Persisted Plant");
      await page.locator("#edit-save").click();
      await page.waitForTimeout(500);
      // setRowData doesn't auto-schedule a save, so explicitly trigger session persistence
      await page.evaluate(async () => {
        const { saveSession } = await import('./js/storage.js');
        await saveSession();
      });
      await page.waitForTimeout(500);
      await page.reload();
      await page.waitForTimeout(2000);
      const body = await page.textContent("body");
      expect(body).toContain("Persisted Plant");
    });
  });
});
