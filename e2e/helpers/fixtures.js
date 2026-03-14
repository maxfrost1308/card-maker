/**
 * Shared test fixture helpers for E2E tests.
 *
 * Provides reusable setup functions so every spec file can independently
 * prepare the app state it needs without duplicating boilerplate.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { expect } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "..", "fixtures");

/**
 * Clear all persisted state (IndexedDB, localStorage, sessionStorage)
 * and wait for the app to fully initialize after reload.
 * Call this in beforeEach to ensure full test isolation.
 */
export async function clearSession(page) {
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
  // Wait for the app to fully initialize (card types registered, dropdown populated)
  await page.waitForFunction(
    () => document.querySelectorAll("#card-type-select option").length > 1,
    { timeout: 10000 }
  );
}

/**
 * Select a built-in card type from the sidebar dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {string} typeName - Regex-friendly name (e.g. "Plant", "TTRPG")
 */
export async function selectCardType(page, typeName) {
  const select = page.locator("#card-type-select");
  const opts = await select.locator("option").allTextContents();
  const match = opts.find((o) => new RegExp(typeName, "i").test(o));
  if (!match) throw new Error(`Card type matching "${typeName}" not found in: ${opts.join(", ")}`);
  await select.selectOption({ label: match });
  await page.waitForTimeout(500);
}

/**
 * Upload a CSV file from e2e/fixtures/ via the file input.
 * @param {import('@playwright/test').Page} page
 * @param {string} fixtureName - Filename in e2e/fixtures/
 */
export async function uploadCSV(page, fixtureName) {
  const filePath = path.resolve(fixturesDir, fixtureName);
  const fileInput = page.locator('input[type="file"][accept*=".csv"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles(filePath);
  } else {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("#open-csv-btn").click(),
    ]);
    await fileChooser.setFiles(filePath);
  }
  await page.waitForTimeout(1000);
}

/**
 * Write a CSV string to a temp fixture file and upload it.
 * @param {import('@playwright/test').Page} page
 * @param {string} csvContent
 * @param {string} [filename='_temp-test.csv']
 */
export async function uploadCSVString(page, csvContent, filename = "_temp-test.csv") {
  const filePath = path.join(fixturesDir, filename);
  fs.writeFileSync(filePath, csvContent, "utf-8");
  const fileInput = page.locator('input[type="file"][accept*=".csv"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles(filePath);
  } else {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("#open-csv-btn").click(),
    ]);
    await fileChooser.setFiles(filePath);
  }
  await page.waitForTimeout(1000);
}

/**
 * Shorthand: select Plant Care card type + upload sample-plants.csv.
 */
export async function loadPlantCards(page) {
  await selectCardType(page, "Plant");
  await uploadCSV(page, "sample-plants.csv");
}

/**
 * Shorthand: select TTRPG card type + upload ttrpg-sample.csv.
 */
export async function loadTTRPGCards(page) {
  await selectCardType(page, "TTRPG");
  await uploadCSV(page, "ttrpg-sample.csv");
}

/**
 * Switch to Table view and wait for the table to render.
 */
export async function switchToTable(page) {
  await page.locator('.view-btn[data-view="table"]').click();
  await page.waitForTimeout(500);
}

/**
 * Switch to Cards view and wait for cards to render.
 */
export async function switchToCards(page) {
  await page.locator('.view-btn[data-view="cards"]').click();
  await page.waitForTimeout(500);
}

/**
 * Click the first edit button (card grid or table) and wait for the edit modal.
 * Returns the modal locator.
 */
export async function openEditModalForFirstCard(page) {
  const editBtn = page
    .locator("button[aria-label*='Edit card' i], .card-edit-btn, .table-edit-btn")
    .first();
  await editBtn.click();
  await page.waitForTimeout(500);
  const modal = page.locator("#edit-modal");
  await expect(modal).toBeVisible();
  return modal;
}

/**
 * Parse the card count from the page body text (e.g., "5 cards").
 * Returns the parsed number or null.
 */
export async function getCardCount(page) {
  const body = await page.textContent("body");
  const match = body.match(/(\d+)\s*cards?/i);
  return match ? parseInt(match[1], 10) : null;
}
