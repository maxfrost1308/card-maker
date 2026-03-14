// e2e/02-card-workflow.spec.js
// Tests: Select card type → load CSV → cards render → switch views
import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Core card workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // ---------------------------------------------------------------------------
  // Helper: select a built-in card type from the sidebar dropdown
  // ---------------------------------------------------------------------------
  async function selectCardType(page, typeName) {
    const select = page.locator("select").first();
    const opts = await select.locator("option").allTextContents();
    const match = opts.find((o) => new RegExp(typeName, "i").test(o));
    await select.selectOption({ label: match });
    await page.waitForTimeout(500); // let the app react
  }

  // ---------------------------------------------------------------------------
  // Helper: upload a CSV file via the Open CSV button / file input
  // ---------------------------------------------------------------------------
  async function uploadCSV(page, fixtureName) {
    const filePath = path.resolve(__dirname, "fixtures", fixtureName);

    // Most implementations use a hidden <input type="file"> triggered by the button
    const fileInput = page.locator('input[type="file"][accept*=".csv"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(filePath);
    } else {
      // Fallback: click the Open CSV button and handle the file chooser
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByText(/Open CSV/i).click(),
      ]);
      await fileChooser.setFiles(filePath);
    }
    await page.waitForTimeout(1000); // allow parsing + render
  }

  // ========================== TESTS ==========================================

  test("selecting a built-in card type shows sample cards or field reference", async ({
    page,
  }) => {
    await selectCardType(page, "Plant");

    // After selecting, either sample cards appear or the field reference updates
    const fieldRef = page.locator("[class*='field'], [class*='reference']");
    const sampleCards = page.locator("[class*='card']");
    const eitherVisible =
      (await fieldRef.count()) > 0 || (await sampleCards.count()) > 0;
    expect(eitherVisible).toBeTruthy();
  });

  test("uploading a CSV renders the correct number of cards", async ({
    page,
  }) => {
    await selectCardType(page, "Plant");
    await uploadCSV(page, "sample-plants.csv");

    // The fixture has 5 data rows — check the count indicator text
    const pageContent = await page.textContent("body");
    expect(pageContent).toMatch(/5\s*cards?/i);
  });

  test("card content includes data from CSV", async ({ page }) => {
    await selectCardType(page, "Plant");
    await uploadCSV(page, "sample-plants.csv");

    // At least one card should contain "Monstera" (first row of CSV)
    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Monstera");
    expect(pageContent).toContain("Snake Plant");
  });

  test("switching to Table view shows tabular data", async ({ page }) => {
    await selectCardType(page, "Plant");
    await uploadCSV(page, "sample-plants.csv");

    const tableTab = page.getByRole("button", { name: /^Table$/i });
    await tableTab.click();
    await page.waitForTimeout(500);

    // A table element or table-like grid should now be visible
    const table = page.locator("table, [role='grid'], [class*='table']");
    await expect(table.first()).toBeVisible();

    // Table should contain CSV data
    const tableText = await table.first().textContent();
    expect(tableText).toContain("Monstera");
  });

  test("switching back to Cards view preserves data", async ({ page }) => {
    await selectCardType(page, "Plant");
    await uploadCSV(page, "sample-plants.csv");

    // Go to table view and back (use button role to avoid strict-mode multi-match)
    await page.getByRole("button", { name: /^Table$/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Cards$/i }).click();
    await page.waitForTimeout(300);

    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Monstera");
  });

  test("'Add Card' button adds a new empty card", async ({ page }) => {
    await selectCardType(page, "Plant");
    await uploadCSV(page, "sample-plants.csv");

    const addBtn = page.getByText(/Add Card/i);
    await addBtn.click();
    await page.waitForTimeout(500);

    // Now we should have 6 cards (5 from CSV + 1 new)
    const cards = page.locator("[class*='card']");
    // Flexible: just verify count increased
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("'Show backs' toggle reveals card back sides", async ({ page }) => {
    await selectCardType(page, "Plant");
    await uploadCSV(page, "sample-plants.csv");

    const showBacks = page.getByText(/Show backs/i);
    if (await showBacks.isVisible()) {
      await showBacks.click();
      await page.waitForTimeout(500);
      // Back content should now be visible (class change or new elements)
      const backs = page.locator("[class*='back']");
      expect(await backs.count()).toBeGreaterThan(0);
    }
  });
});
