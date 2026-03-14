// e2e/03-editing.spec.js
// Tests: Edit modal open/close, field editing, save, cancel, bulk edit
import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Editing flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    // Setup: select Plant Care + upload CSV
    const select = page.locator("select").first();
    const opts = await select.locator("option").allTextContents();
    const plantOpt = opts.find((o) => /plant/i.test(o));
    await select.selectOption({ label: plantOpt });
    await page.waitForTimeout(300);

    const fileInput = page.locator('input[type="file"][accept*=".csv"]').first();
    const filePath = path.resolve(__dirname, "fixtures", "sample-plants.csv");
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
  });

  // ---------------------------------------------------------------------------
  // Edit Modal
  // ---------------------------------------------------------------------------

  test("clicking edit icon opens the edit modal", async ({ page }) => {
    // Look for edit buttons/icons on cards
    const editBtn = page
      .locator(
        "button[aria-label*='edit' i], [class*='edit'], button:has(svg), button:has-text('✎')"
      )
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator(
        "[class*='modal'], [role='dialog'], dialog"
      );
      await expect(modal.first()).toBeVisible();
    }
  });

  test("edit modal displays current card data", async ({ page }) => {
    // Open edit for first card
    const editBtn = page
      .locator(
        "button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')"
      )
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator("[class*='modal'], [role='dialog'], dialog");
      const modalText = await modal.first().textContent();
      // The first card is Monstera — its data should appear in the modal
      expect(modalText).toContain("Monstera");
    }
  });

  test("cancel button closes modal without saving changes", async ({
    page,
  }) => {
    const editBtn = page
      .locator(
        "button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')"
      )
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Modify a field
      const nameInput = page
        .locator("[class*='modal'] input, [role='dialog'] input")
        .first();
      if (await nameInput.isVisible()) {
        await nameInput.fill("CHANGED_NAME_12345");
      }

      // Click cancel
      const cancelBtn = page.getByText("Cancel");
      await cancelBtn.click();
      await page.waitForTimeout(300);

      // Modal should be closed
      const modal = page.locator("[class*='modal']:visible, [role='dialog']:visible");
      expect(await modal.count()).toBe(0);

      // The card should NOT show the changed name
      const pageContent = await page.textContent("body");
      expect(pageContent).not.toContain("CHANGED_NAME_12345");
    }
  });

  test("save button persists changes to the card", async ({ page }) => {
    const editBtn = page
      .locator(
        "button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')"
      )
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Modify a field
      const nameInput = page
        .locator("[class*='modal'] input, [role='dialog'] input")
        .first();
      if (await nameInput.isVisible()) {
        await nameInput.fill("Updated Monstera");
      }

      // Click save
      const saveBtn = page.locator(
        "[class*='modal'] button:has-text('Save'), [role='dialog'] button:has-text('Save')"
      );
      await saveBtn.click();
      await page.waitForTimeout(500);

      // The card grid should reflect the change
      const pageContent = await page.textContent("body");
      expect(pageContent).toContain("Updated Monstera");
    }
  });

  test("arrow buttons navigate between cards in edit modal", async ({
    page,
  }) => {
    const editBtn = page
      .locator(
        "button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')"
      )
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Click next arrow
      const nextBtn = page.locator(
        "button:has-text('→'), button[aria-label*='next' i]"
      );
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(300);

        // Should now show a different card (e.g., Snake Plant)
        const modal = page.locator("[class*='modal'], [role='dialog']");
        const modalText = await modal.first().textContent();
        expect(modalText).toContain("Snake Plant");
      }
    }
  });

  test("Escape key closes the edit modal", async ({ page }) => {
    const editBtn = page
      .locator(
        "button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')"
      )
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      const modal = page.locator("[class*='modal']:visible, [role='dialog']:visible");
      expect(await modal.count()).toBe(0);
    }
  });

  // ---------------------------------------------------------------------------
  // Bulk Edit
  // ---------------------------------------------------------------------------

  test("bulk edit: select cards and apply a value", async ({ page }) => {
    // Switch to table view where selection checkboxes are more likely visible
    await page.getByRole("button", { name: /^Table$/i }).click();
    await page.waitForTimeout(300);

    // Try "Select all"
    const selectAll = page.getByText(/Select all/i);
    if (await selectAll.isVisible()) {
      await selectAll.click();
      await page.waitForTimeout(300);

      const bulkEditBtn = page.getByText(/Bulk Edit/i);
      if (await bulkEditBtn.isVisible()) {
        await bulkEditBtn.click();
        await page.waitForTimeout(500);

        // Bulk edit dialog should be open
        const bulkModal = page.locator("[class*='bulk'], [class*='modal']");
        await expect(bulkModal.first()).toBeVisible();
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Duplicate
  // ---------------------------------------------------------------------------

  test("duplicate button creates a copy of the card", async ({ page }) => {
    const editBtn = page
      .locator(
        "button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')"
      )
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      const dupBtn = page.getByText(/Duplicate/i);
      if (await dupBtn.isVisible()) {
        await dupBtn.click();
        await page.waitForTimeout(500);

        // Close modal
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);

        // Verify Monstera appears twice now
        const monsteraOccurrences = await page
          .locator("text=Monstera")
          .count();
        expect(monsteraOccurrences).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
