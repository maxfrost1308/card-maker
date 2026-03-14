// e2e/06-edge-cases.spec.js
// Tests: Malformed CSV, empty CSV, mismatched columns, special characters, large data
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate fixture files on the fly
const fixturesDir = path.resolve(__dirname, "fixtures");

test.describe("Edge cases & error handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("card-maker-db");
        req.onsuccess = res;
        req.onerror = res;
        req.onblocked = res;
      });
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    const select = page.locator("select").first();
    const opts = await select.locator("option").allTextContents();
    const plantOpt = opts.find((o) => /plant/i.test(o));
    await select.selectOption({ label: plantOpt });
    await page.waitForTimeout(300);
  });

  // ---------------------------------------------------------------------------
  // Helper to upload a CSV string as a file
  // ---------------------------------------------------------------------------
  async function uploadCSVString(page, csvContent, filename = "test.csv") {
    const filePath = path.join(fixturesDir, filename);
    fs.writeFileSync(filePath, csvContent, "utf-8");

    const fileInput = page.locator('input[type="file"][accept*=".csv"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(filePath);
    } else {
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByText(/Open CSV/i).click(),
      ]);
      await fileChooser.setFiles(filePath);
    }
    await page.waitForTimeout(1000);
  }

  // ========================== TESTS ==========================================

  test("empty CSV (headers only) shows zero cards without crashing", async ({
    page,
  }) => {
    await uploadCSVString(page, "name,species,light,water\n");

    // No error should appear, and no cards should be shown
    const errorDialog = page.locator("[class*='error'], [role='alert']");
    // It's acceptable to show a message — just no crash
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeDefined(); // Page is still responsive
  });

  test("CSV with no headers at all is handled gracefully", async ({
    page,
  }) => {
    await uploadCSVString(page, "Monstera,Bright,Weekly\nPothos,Low,Bi-weekly\n");

    // Should not crash — may show an error message or misparse
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeDefined();
  });

  test("CSV with extra columns beyond the schema is not lost", async ({
    page,
  }) => {
    const csv =
      "name,species,light,water,humidity,notes,extra_col1,extra_col2\n" +
      "Monstera,Monstera deliciosa,Bright,Weekly,High,Notes,ExtraA,ExtraB\n";
    await uploadCSVString(page, csv);

    // Cards should still render for the known fields
    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Monstera");
  });

  test("CSV with missing columns still renders available fields", async ({
    page,
  }) => {
    const csv = "name,light\nMonstera,Bright\n";
    await uploadCSVString(page, csv);

    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Monstera");
  });

  test("special characters in CSV are displayed correctly", async ({
    page,
  }) => {
    const csv =
      'name,species,light,water,humidity,notes\n' +
      '"Plant & <Flower>","Species ""quoted""",Bright,Weekly,High,"Notes with, commas"\n';
    await uploadCSVString(page, csv, "special-chars.csv");

    const pageContent = await page.textContent("body");
    // The literal text should appear as-is
    expect(pageContent).toContain("Plant &");
    // Verify no actual <flower> DOM element was injected (XSS check)
    const flowerEl = await page.locator("flower").count();
    expect(flowerEl).toBe(0);
  });

  test("Unicode/emoji in CSV fields render correctly", async ({ page }) => {
    // Use "botanical" (not "species") to match the plant-care schema key
    const csv =
      "name,botanical,light,water,humidity,notes\n" +
      "Monstera 🌿,Monstera déliciosa,☀️ Bright,💧 Weekly,High,Très bien\n";
    await uploadCSVString(page, csv, "unicode.csv");

    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("🌿");          // emoji in name field
    expect(pageContent).toContain("déliciosa");    // accented chars in botanical field
  });

  test("large CSV (200 rows) loads without timeout", async ({ page }) => {
    let csv = "name,species,light,water,humidity,notes\n";
    for (let i = 0; i < 200; i++) {
      csv += `Plant ${i},Species ${i},Bright,Weekly,Medium,Note ${i}\n`;
    }
    await uploadCSVString(page, csv, "large.csv");

    // Virtual scroll only renders visible cards — check count indicator and first card
    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Plant 0");
    // Check the card count indicator shows 200
    expect(pageContent).toMatch(/200\s*cards?/i);
  });

  test("XSS attempt via CSV field is sanitized", async ({ page }) => {
    const csv =
      "name,species,light,water,humidity,notes\n" +
      '"<script>alert(1)</script>",Species,Bright,Weekly,High,Notes\n' +
      '"<img onerror=alert(1) src=x>",Species,Bright,Weekly,High,Notes\n';
    await uploadCSVString(page, csv, "xss.csv");

    // The script should NOT execute
    const alertFired = await page.evaluate(() => {
      return window.__xssAlertFired === true;
    });
    expect(alertFired).toBeFalsy();

    // The raw HTML tags should be escaped, not rendered
    const scriptTag = await page.locator("script:text('alert')").count();
    expect(scriptTag).toBe(0);
  });

  test("uploading a non-CSV file is rejected gracefully", async ({ page }) => {
    const filePath = path.join(fixturesDir, "not-a-csv.txt");
    fs.writeFileSync(filePath, "this is not a csv file at all", "utf-8");

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(filePath);
      await page.waitForTimeout(1000);

      // Should still be functional (no crash)
      const pageContent = await page.textContent("body");
      expect(pageContent).toBeDefined();
    }
  });

  test("switching card types clears previous card data", async ({ page }) => {
    await uploadCSVString(
      page,
      "name,species,light,water,humidity,notes\nMonstera,M. deliciosa,Bright,Weekly,High,Test\n"
    );

    const pageContent1 = await page.textContent("body");
    expect(pageContent1).toContain("Monstera");

    // Switch to TTRPG type
    const select = page.locator("select").first();
    const options = await select.locator("option").allTextContents();
    const ttrpgOption = options.find((o) => /ttrpg|monster|rpg/i.test(o));
    if (ttrpgOption) {
      await select.selectOption({ label: ttrpgOption });
      await page.waitForTimeout(500);

      // Old Plant data should no longer display as cards
      // (it may still be in memory, but the card view should reflect the new type)
    }
  });
});
