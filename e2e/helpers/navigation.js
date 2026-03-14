/**
 * Panel-level interaction helpers for E2E tests.
 *
 * Provides reusable helpers for interacting with the top panel,
 * sub-header, and other shared UI controls.
 */
import { expect } from "@playwright/test";

/**
 * Toggle the overlay button and return the new pressed state.
 */
export async function toggleOverlay(page) {
  const btn = page.locator("#overlay-toggle-btn");
  await btn.click();
  await page.waitForTimeout(300);
  return (await btn.getAttribute("aria-pressed")) === "true";
}

/**
 * Toggle the Show Backs checkbox.
 */
export async function toggleShowBacks(page) {
  const cb = page.locator("#show-backs");
  await cb.click();
  await page.waitForTimeout(300);
}

/**
 * Toggle dark mode and return whether dark class is now on html.
 */
export async function toggleDarkMode(page) {
  const btn = page.locator("#dark-mode-toggle");
  await btn.click();
  await page.waitForTimeout(200);
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

/**
 * Open the Export dropdown menu.
 */
export async function openExportMenu(page) {
  const btn = page.locator("#export-menu-btn");
  await btn.click();
  await page.waitForTimeout(200);
  const menu = page.locator("#export-menu");
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * Click the Add Card button.
 */
export async function clickAddCard(page) {
  const btn = page.locator("#add-card-btn");
  await btn.click();
  await page.waitForTimeout(500);
}

/**
 * Open the column selector (gear icon) dropdown.
 */
export async function openColumnSelector(page) {
  const dropdown = page.locator(".col-prefs-dropdown");
  // If dropdown is already visible, don't toggle it closed
  if (await dropdown.isVisible()) return dropdown;
  const btn = page.locator(".table-col-prefs-btn");
  await btn.click();
  await page.waitForTimeout(200);
  await expect(dropdown).toBeVisible();
  return dropdown;
}

/**
 * Add a column filter via the filter bar UI.
 * @param {import('@playwright/test').Page} page
 * @param {string} fieldLabel - The field label to filter on
 * @param {string[]} values - For select/multi-select: option values to check.
 *                            For text: single-element array with substring.
 */
export async function addColumnFilter(page, fieldLabel, values) {
  // Open filter dropdown
  await page.locator(".filter-bar-add").click();
  await page.waitForTimeout(200);

  // Select the property
  const propBtn = page.locator(".filter-prop-btn", { hasText: fieldLabel });
  await propBtn.click();
  await page.waitForTimeout(200);

  // Check if it's a checkbox-based filter or text input
  const checkboxes = page.locator(".filter-bar-dropdown input[type='checkbox']");
  if (await checkboxes.count()) {
    // Checkbox filter — check the specified values
    for (const val of values) {
      const label = page.locator(".filter-value-label", { hasText: val });
      const cb = label.locator("input[type='checkbox']");
      await cb.click({ force: true });
      await page.waitForTimeout(200);
    }
    // Click outside to close the dropdown
    await page.locator("body").click({ position: { x: 0, y: 0 } });
  } else {
    // Text input filter
    const input = page.locator(".filter-text-input");
    await input.fill(values[0]);
    await page.locator(".filter-apply-btn").click();
  }
  await page.waitForTimeout(300);
}

/**
 * Click the Clear Filters button.
 */
export async function clearFilters(page) {
  await page.locator(".table-clear-filters-btn").click();
  await page.waitForTimeout(300);
}

/**
 * Parse "Showing X of Y rows" text.
 * @returns {{ showing: number, total: number } | null}
 */
export async function getRowCount(page) {
  const text = await page.locator(".table-row-count").textContent();
  const match = text.match(/Showing\s+(\d+)\s+of\s+(\d+)/i);
  return match ? { showing: parseInt(match[1]), total: parseInt(match[2]) } : null;
}

/**
 * Get aggregation bar values as { label: count } object.
 */
export async function getAggregationValues(page) {
  const items = page.locator(".agg-item");
  const count = await items.count();
  const result = {};
  for (let i = 0; i < count; i++) {
    const label = await items.nth(i).locator(".agg-label").textContent();
    const value = await items.nth(i).locator(".agg-value").textContent();
    result[label.replace(":", "").trim()] = parseInt(value);
  }
  return result;
}
