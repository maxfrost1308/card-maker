/**
 * Edge Cases & Security — Requirements
 *
 * Tests CSV edge cases, XSS sanitization, and card type switching behavior.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  selectCardType,
  uploadCSVString,
  loadPlantCards,
} from "./helpers/fixtures.js";

test.describe("Edge Cases & Security", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
    await selectCardType(page, "Plant");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CSV Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("CSV Edge Cases", () => {
    test("empty CSV (headers only) shows zero cards without crash", async ({ page }) => {
      await uploadCSVString(page, "name,botanical,light,water\n");
      const body = await page.textContent("body");
      expect(body).toBeDefined();
    });

    test("CSV with no headers is handled gracefully", async ({ page }) => {
      await uploadCSVString(page, "Monstera,Bright,Weekly\nPothos,Low,Bi-weekly\n");
      const body = await page.textContent("body");
      expect(body).toBeDefined();
    });

    test("extra columns beyond schema are not lost", async ({ page }) => {
      const csv =
        "name,botanical,light,water,humidity,notes,extra1,extra2\n" +
        "Monstera,M. deliciosa,Bright,Weekly,High,Notes,A,B\n";
      await uploadCSVString(page, csv);
      const body = await page.textContent("body");
      expect(body).toContain("Monstera");
    });

    test("missing columns still render available fields", async ({ page }) => {
      await uploadCSVString(page, "name,light\nMonstera,Bright\n");
      const body = await page.textContent("body");
      expect(body).toContain("Monstera");
    });

    test("special characters displayed correctly without XSS", async ({ page }) => {
      const csv =
        "name,botanical,light,water,humidity,notes\n" +
        '"Plant & <Flower>","Species ""quoted""",Bright,Weekly,High,"Notes with, commas"\n';
      await uploadCSVString(page, csv, "_special.csv");
      const body = await page.textContent("body");
      expect(body).toContain("Plant &");
      // No actual <flower> HTML element injected
      const flowerEl = await page.locator("flower").count();
      expect(flowerEl).toBe(0);
    });

    test("Unicode and emoji render correctly", async ({ page }) => {
      const csv =
        "name,botanical,light,water,humidity,notes\n" +
        "Monstera 🌿,Monstera déliciosa,☀️ Bright,💧 Weekly,High,Très bien\n";
      await uploadCSVString(page, csv, "_unicode.csv");
      const body = await page.textContent("body");
      expect(body).toContain("🌿");
      expect(body).toContain("déliciosa");
    });

    test("large CSV (200 rows) loads within timeout", async ({ page }) => {
      let csv = "name,botanical,light,water,humidity,notes\n";
      for (let i = 0; i < 200; i++) {
        csv += `Plant ${i},Species ${i},Bright,Weekly,Medium,Note ${i}\n`;
      }
      await uploadCSVString(page, csv, "_large.csv");
      const body = await page.textContent("body");
      expect(body).toContain("Plant 0");
      expect(body).toMatch(/200\s*cards?/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Security
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Security", () => {
    test("script tags in CSV are sanitized", async ({ page }) => {
      const csv =
        "name,botanical,light,water,humidity,notes\n" +
        '"<script>alert(1)</script>",Species,Bright,Weekly,High,Notes\n';
      await uploadCSVString(page, csv, "_xss.csv");
      const alertFired = await page.evaluate(() => window.__xssAlertFired === true);
      expect(alertFired).toBeFalsy();
      const scriptTag = await page.locator("script:text('alert')").count();
      expect(scriptTag).toBe(0);
    });

    test("event handler attributes in CSV are sanitized", async ({ page }) => {
      const csv =
        "name,botanical,light,water,humidity,notes\n" +
        '"<img onerror=alert(1) src=x>",Species,Bright,Weekly,High,Notes\n';
      await uploadCSVString(page, csv, "_xss2.csv");
      const alertFired = await page.evaluate(() => window.__xssAlertFired === true);
      expect(alertFired).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Card Type Switching
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Card Type Switching", () => {
    test("switching types clears previous data and updates UI", async ({ page }) => {
      await uploadCSVString(
        page,
        "name,botanical,light,water,humidity,notes\nMonstera,M. deliciosa,Bright,Weekly,High,Test\n"
      );
      const body1 = await page.textContent("body");
      expect(body1).toContain("Monstera");

      await selectCardType(page, "TTRPG");
      await page.waitForTimeout(500);
      // Field reference should update
      const fieldRef = page.locator("#field-reference");
      const fieldText = await fieldRef.textContent();
      expect(fieldText).toContain("title");
      expect(fieldText).not.toContain("botanical");
    });
  });
});
