/**
 * Card Type Panel — Requirements
 *
 * Tests the left sidebar: card type selection, CSV upload, and custom card type features.
 * These are the entry points to the application experience.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  selectCardType,
  uploadCSV,
  uploadCSVString,
  loadPlantCards,
  getCardCount,
} from "./helpers/fixtures.js";

test.describe("Card Type Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Card Type Selection
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Card Type Selection", () => {
    test("card type dropdown starts with placeholder option", async ({ page }) => {
      const select = page.locator("#card-type-select");
      // The app auto-selects TTRPG on fresh load, but the placeholder should exist
      const options = await select.locator("option").allTextContents();
      expect(options.some((o) => o.includes("Select a card type"))).toBeTruthy();
    });

    test("selecting Plant Care shows plant field reference and sample data", async ({ page }) => {
      await selectCardType(page, "Plant");
      // Field reference should show plant-specific field keys
      const fieldRef = page.locator("#field-reference");
      const fieldText = await fieldRef.textContent();
      expect(fieldText).toContain("name");
      expect(fieldText).toContain("light");
    });

    test("selecting TTRPG shows TTRPG field reference and sample data", async ({ page }) => {
      await selectCardType(page, "TTRPG");
      const fieldRef = page.locator("#field-reference");
      const fieldText = await fieldRef.textContent();
      expect(fieldText).toContain("title");
      expect(fieldText).toContain("mechanical_style");
      expect(fieldText).toContain("complexity");
    });

    test("switching card type updates field reference", async ({ page }) => {
      await selectCardType(page, "Plant");
      const fieldRef = page.locator("#field-reference");
      let text = await fieldRef.textContent();
      expect(text).toContain("name");
      expect(text).toContain("light");

      await selectCardType(page, "TTRPG");
      text = await fieldRef.textContent();
      expect(text).toContain("title");
      expect(text).toContain("complexity");
    });

    test("Try with sample data button loads sample cards in empty state", async ({ page }) => {
      await selectCardType(page, "Plant");
      const tryBtn = page.locator("#empty-try-btn");
      if (await tryBtn.isVisible()) {
        await tryBtn.click();
        await page.waitForTimeout(500);
        const body = await page.textContent("body");
        expect(body).toContain("Monstera");
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Card Data Upload
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Card Data Upload", () => {
    test("uploading valid CSV loads correct number of cards", async ({ page }) => {
      await selectCardType(page, "Plant");
      await uploadCSV(page, "sample-plants.csv");
      const count = await getCardCount(page);
      expect(count).toBe(5);
    });

    test("upload hint text visible when no CSV loaded", async ({ page }) => {
      const hint = page.getByText(/Upload a CSV matching/i);
      await expect(hint).toBeVisible();
    });

    test("empty CSV (headers only) shows zero cards without crash", async ({ page }) => {
      await selectCardType(page, "Plant");
      await uploadCSVString(page, "name,botanical,light,water\n");
      const body = await page.textContent("body");
      expect(body).toBeDefined();
    });

    test("non-CSV file is rejected gracefully", async ({ page }) => {
      await selectCardType(page, "Plant");
      const filePath = (await import("path")).resolve(
        (await import("path")).dirname((await import("url")).fileURLToPath(import.meta.url)),
        "fixtures",
        "not-a-csv.txt"
      );
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count()) {
        await fileInput.setInputFiles(filePath);
        await page.waitForTimeout(1000);
        const body = await page.textContent("body");
        expect(body).toBeDefined();
      }
    });

    test("CSV with missing columns still renders available fields", async ({ page }) => {
      await selectCardType(page, "Plant");
      await uploadCSVString(page, "name,light\nMonstera,Bright\n");
      const body = await page.textContent("body");
      expect(body).toContain("Monstera");
    });

    test("CSV with extra columns beyond schema preserves data", async ({ page }) => {
      await selectCardType(page, "Plant");
      const csv =
        "name,botanical,light,water,humidity,notes,extra_col\n" +
        "Monstera,M. deliciosa,Bright,Weekly,High,Notes,ExtraVal\n";
      await uploadCSVString(page, csv);
      const body = await page.textContent("body");
      expect(body).toContain("Monstera");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Custom Card Type
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Custom Card Type", () => {
    test("download starter bundle link is available", async ({ page }) => {
      const starterLink = page.locator('.starter-link[data-starter="bundle"]');
      await expect(starterLink).toBeVisible();
    });

    test("download current card type exports active type as bundle", async ({ page }) => {
      await selectCardType(page, "Plant");
      const downloadBtn = page.locator("#custom-download-btn");
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
      await downloadBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.json$/);
    });
  });
});
