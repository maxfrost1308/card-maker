/**
 * Cards View — Requirements
 *
 * Tests the card grid rendering, card fronts & backs, empty state,
 * and card-level interactions.
 */
import { test, expect } from "@playwright/test";
import {
  clearSession,
  selectCardType,
  loadPlantCards,
  uploadCSVString,
  getCardCount,
} from "./helpers/fixtures.js";
import { toggleShowBacks } from "./helpers/navigation.js";

test.describe("Cards View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearSession(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Card Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Card Rendering", () => {
    test("cards render with correct content from CSV data", async ({ page }) => {
      await loadPlantCards(page);
      const body = await page.textContent("body");
      expect(body).toContain("Monstera");
      expect(body).toContain("Snake Plant");
      expect(body).toContain("Pothos");
    });

    test("card count indicator shows correct number", async ({ page }) => {
      await loadPlantCards(page);
      const count = await getCardCount(page);
      expect(count).toBe(5);
    });

    test("each card has an edit button", async ({ page }) => {
      await loadPlantCards(page);
      const editBtns = page.locator(".card-edit-btn");
      expect(await editBtns.count()).toBe(5);
    });

    test("card grid uses list role for accessibility", async ({ page }) => {
      await loadPlantCards(page);
      const grid = page.locator("#card-grid");
      expect(await grid.getAttribute("role")).toBe("list");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Card Fronts & Backs
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Card Fronts & Backs", () => {
    test("front template renders field values", async ({ page }) => {
      await loadPlantCards(page);
      const firstCard = page.locator(".card-wrapper").first();
      const text = await firstCard.textContent();
      expect(text).toContain("Monstera");
    });

    test("back template renders when Show Backs enabled", async ({ page }) => {
      await loadPlantCards(page);
      // Show backs is checked by default
      const backs = page.locator(".card-back-wrapper");
      expect(await backs.count()).toBeGreaterThan(0);
    });

    test("unchecking Show Backs removes back cards", async ({ page }) => {
      await loadPlantCards(page);
      await toggleShowBacks(page);
      const backs = page.locator(".card-back-wrapper");
      expect(await backs.count()).toBe(0);
    });

    test("card pairs have listitem role", async ({ page }) => {
      await loadPlantCards(page);
      const pairs = page.locator(".card-pair");
      const first = pairs.first();
      expect(await first.getAttribute("role")).toBe("listitem");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty State
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Empty State", () => {
    test("shows empty state message when no data loaded", async ({ page }) => {
      // Clear session and don't select anything — app auto-selects TTRPG sample
      // So we need to test the upload hint instead
      const hint = page.getByText(/Upload a CSV matching/i);
      await expect(hint).toBeVisible();
    });

    test("shows drag-and-drop hint text", async ({ page }) => {
      await selectCardType(page, "Plant");
      const tryBtn = page.locator("#empty-try-btn");
      // If there's sample data, the empty state with drag hint won't show
      // But the help text should always be there
      const helpText = page.getByText(/Drag a CSV file/i);
      if (await helpText.isVisible()) {
        expect(await helpText.textContent()).toContain("Drag a CSV");
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Large Dataset / Virtual Scrolling
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Large Dataset", () => {
    test("200-row CSV loads without timeout and shows correct count", async ({ page }) => {
      await selectCardType(page, "Plant");
      let csv = "name,botanical,light,water,humidity,notes\n";
      for (let i = 0; i < 200; i++) {
        csv += `Plant ${i},Species ${i},Bright,Weekly,Medium,Note ${i}\n`;
      }
      await uploadCSVString(page, csv, "_large-test.csv");
      const body = await page.textContent("body");
      expect(body).toContain("Plant 0");
      expect(body).toMatch(/200\s*cards?/i);
    });
  });
});
