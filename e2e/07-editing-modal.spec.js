/**
 * Editing Modal — Requirements
 *
 * Tests the card edit modal: opening/closing, navigation, field editing,
 * save, duplicate, and verification features.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  loadPlantCards,
  loadTTRPGCards,
  switchToTable,
  openEditModalForFirstCard,
} from "./helpers/fixtures.js";
import { clickAddCard } from "./helpers/navigation.js";

test.describe("Editing Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Opening & Closing
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Opening & Closing", () => {
    test("edit button on card opens modal with correct card data", async ({ page }) => {
      await loadPlantCards(page);
      const modal = await openEditModalForFirstCard(page);
      const title = await page.locator("#edit-title").textContent();
      expect(title).toContain("Monstera");
    });

    test("edit button in table row opens modal with correct row data", async ({ page }) => {
      await loadPlantCards(page);
      await switchToTable(page);
      const editBtn = page.locator(".table-edit-btn").first();
      await editBtn.click();
      await page.waitForTimeout(500);
      const modal = page.locator("#edit-modal");
      await expect(modal).toBeVisible();
      const title = await page.locator("#edit-title").textContent();
      expect(title).toContain("Monstera");
    });

    test("Cancel button closes modal without saving", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      // Modify a field
      const input = page.locator("#edit-modal-body input[data-field-key='name']");
      if (await input.isVisible()) {
        await input.fill("SHOULD_NOT_PERSIST");
      }
      await page.locator("#edit-cancel").click();
      await page.waitForTimeout(300);
      await expect(page.locator("#edit-modal")).toBeHidden();
      const body = await page.textContent("body");
      expect(body).not.toContain("SHOULD_NOT_PERSIST");
    });

    test("Close (×) button closes modal", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      await page.locator("#edit-close").click();
      await page.waitForTimeout(300);
      await expect(page.locator("#edit-modal")).toBeHidden();
    });

    test("Escape key closes modal", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await expect(page.locator("#edit-modal")).toBeHidden();
    });

    test("clicking backdrop closes modal", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      // Click the modal backdrop (the outer .edit-modal div)
      await page.locator("#edit-modal").click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(300);
      await expect(page.locator("#edit-modal")).toBeHidden();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Navigation
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Navigation", () => {
    test("Previous/Next arrows navigate between cards", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      const title = page.locator("#edit-title");
      expect(await title.textContent()).toContain("Monstera");
      // Click next
      await page.locator("#edit-next").click();
      await page.waitForTimeout(500);
      expect(await title.textContent()).not.toContain("Monstera");
    });

    test("Previous disabled on first card", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      const prevBtn = page.locator("#edit-prev");
      await expect(prevBtn).toBeDisabled();
    });

    test("Next disabled on last card", async ({ page }) => {
      await loadPlantCards(page);
      // Open last card's edit modal
      const editBtns = page.locator(".card-edit-btn");
      const lastBtn = editBtns.last();
      await lastBtn.click();
      await page.waitForTimeout(500);
      const nextBtn = page.locator("#edit-next");
      await expect(nextBtn).toBeDisabled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Field Editing in Modal
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Field Editing in Modal", () => {
    test("text field input shows current value", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      const nameInput = page.locator("#edit-modal-body input[data-field-key='name']");
      expect(await nameInput.inputValue()).toBe("Monstera");
    });

    test("select field uses pill picker", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      // Light Needs is a select field
      const picker = page.locator("#edit-modal-body .pill-picker");
      expect(await picker.count()).toBeGreaterThan(0);
    });

    test("hidden fields are not shown in the form", async ({ page }) => {
      await loadTTRPGCards(page);
      await openEditModalForFirstCard(page);
      // back_color and verified_fields are hidden
      const backColorInput = page.locator("#edit-modal-body [data-field-key='back_color']");
      expect(await backColorInput.count()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Save & Persist
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Save & Persist", () => {
    test("save persists changes and shows toast", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      const nameInput = page.locator("#edit-modal-body input[data-field-key='name']");
      await nameInput.fill("Updated Monstera");
      await page.locator("#edit-save").click();
      await page.waitForTimeout(500);
      // Modal should be closed
      await expect(page.locator("#edit-modal")).toBeHidden();
      // Change reflected in cards
      const body = await page.textContent("body");
      expect(body).toContain("Updated Monstera");
      // Toast shown
      const toast = page.locator("#toast");
      await expect(toast).toBeVisible();
    });

    test("changes reflected in table view after save", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      const nameInput = page.locator("#edit-modal-body input[data-field-key='name']");
      await nameInput.fill("Table Test Plant");
      await page.locator("#edit-save").click();
      await page.waitForTimeout(500);
      await switchToTable(page);
      const tableText = await page.locator("tbody").textContent();
      expect(tableText).toContain("Table Test Plant");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Duplicate
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Duplicate", () => {
    test("duplicate creates copy and opens edit modal for new card", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      await page.locator("#edit-duplicate").click();
      await page.waitForTimeout(500);
      // Modal should reopen for the duplicate
      await expect(page.locator("#edit-modal")).toBeVisible();
      // Toast
      const toast = page.locator("#toast");
      const toastText = await toast.textContent();
      expect(toastText).toContain("duplicated");
    });

    test("card count increases after duplicate", async ({ page }) => {
      await loadPlantCards(page);
      await openEditModalForFirstCard(page);
      await page.locator("#edit-duplicate").click();
      await page.waitForTimeout(500);
      // Close modal
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      // Verify 6 cards are rendered in the grid (5 original + 1 duplicate)
      const cardPairs = page.locator(".card-pair");
      expect(await cardPairs.count()).toBe(6);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Verification (TTRPG-specific)
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Verification", () => {
    test("verifiable fields show checkbox next to label", async ({ page }) => {
      await loadTTRPGCards(page);
      await openEditModalForFirstCard(page);
      const verifyCheckboxes = page.locator(".edit-verify-checkbox");
      expect(await verifyCheckboxes.count()).toBeGreaterThan(0);
    });

    test("checking verify checkbox updates visual state", async ({ page }) => {
      await loadTTRPGCards(page);
      await openEditModalForFirstCard(page);
      const verifyCheckbox = page.locator(".edit-verify-checkbox").first();
      const wrapper = page.locator(".edit-field").first();
      const wasChecked = await verifyCheckbox.isChecked();
      await verifyCheckbox.click();
      await page.waitForTimeout(200);
      if (wasChecked) {
        await expect(wrapper).not.toHaveClass(/verified/);
      } else {
        await expect(wrapper).toHaveClass(/verified/);
      }
    });
  });
});
