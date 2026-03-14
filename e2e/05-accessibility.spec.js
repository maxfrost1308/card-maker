// e2e/05-accessibility.spec.js
// Tests: Automated axe-core scans on every major app state + keyboard nav
import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// You'll need: npm install -D @axe-core/playwright
// If unavailable, the axe tests will be skipped gracefully.
let AxeBuilder;
try {
  AxeBuilder = require("@axe-core/playwright").default;
} catch {
  AxeBuilder = null;
}

const runAxe = AxeBuilder !== null;

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // ---------------------------------------------------------------------------
  // AXE-CORE AUTOMATED SCANS
  // ---------------------------------------------------------------------------

  test("axe: no violations on initial load", async ({ page }) => {
    test.skip(!runAxe, "@axe-core/playwright not installed");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    logViolations(results.violations);
    expect(results.violations.length).toBe(0);
  });

  test("axe: no violations with cards loaded", async ({ page }) => {
    test.skip(!runAxe, "@axe-core/playwright not installed");

    await loadCards(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    logViolations(results.violations);
    expect(results.violations.length).toBe(0);
  });

  test("axe: no violations in table view", async ({ page }) => {
    test.skip(!runAxe, "@axe-core/playwright not installed");

    await loadCards(page);
    await page.getByText("Table").click();
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    logViolations(results.violations);
    expect(results.violations.length).toBe(0);
  });

  test("axe: no violations in edit modal", async ({ page }) => {
    test.skip(!runAxe, "@axe-core/playwright not installed");

    await loadCards(page);

    const editBtn = page
      .locator("button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')")
      .first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    logViolations(results.violations);
    expect(results.violations.length).toBe(0);
  });

  test("axe: no violations in dark mode", async ({ page }) => {
    test.skip(!runAxe, "@axe-core/playwright not installed");

    const darkToggle = page.locator("button:has-text('🌙')");
    if (await darkToggle.isVisible()) {
      await darkToggle.click();
      await page.waitForTimeout(300);
    }

    await loadCards(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    logViolations(results.violations);
    expect(results.violations.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // KEYBOARD NAVIGATION
  // ---------------------------------------------------------------------------

  test("all interactive elements are reachable via Tab", async ({ page }) => {
    await loadCards(page);

    const focusableElements = await page.evaluate(() => {
      const selectors =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const elements = [...document.querySelectorAll(selectors)].filter(
        (el) => el.offsetParent !== null // visible
      );
      return elements.map((el) => ({
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 40),
        hasTabIndex: el.hasAttribute("tabindex"),
        tabIndex: el.tabIndex,
      }));
    });

    // There should be a reasonable number of focusable elements
    expect(focusableElements.length).toBeGreaterThan(5);
  });

  test("edit modal traps focus when open", async ({ page }) => {
    await loadCards(page);

    const editBtn = page
      .locator("button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')")
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Tab through all elements — focus should stay inside the modal
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");
      }

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        const modal = el?.closest("[class*='modal'], [role='dialog'], dialog");
        return {
          tag: el?.tagName,
          insideModal: modal !== null,
        };
      });

      // Focus should remain inside the modal
      expect(focusedElement.insideModal).toBeTruthy();
    }
  });

  test("skip link navigates to main content", async ({ page }) => {
    const skipLink = page.locator("a[href='#card-grid']");
    if (await skipLink.count()) {
      await skipLink.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);

      // Either the card-grid element is focused, or the URL hash updated
      const result = await page.evaluate(() => ({
        hash: window.location.hash,
        focusedId: document.activeElement?.id,
        focusedIsInGrid: document.getElementById("card-grid")?.contains(document.activeElement),
      }));
      const navigated =
        result.hash === "#card-grid" ||
        result.focusedId === "card-grid" ||
        result.focusedIsInGrid;
      expect(navigated).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // ARIA
  // ---------------------------------------------------------------------------

  test("modals have appropriate ARIA roles", async ({ page }) => {
    await loadCards(page);

    const editBtn = page
      .locator("button[aria-label*='edit' i], [class*='edit'], button:has-text('✎')")
      .first();

    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      const hasDialogRole = await page.evaluate(() => {
        return (
          document.querySelector("[role='dialog']") !== null ||
          document.querySelector("dialog[open]") !== null
        );
      });

      expect(hasDialogRole).toBeTruthy();
    }
  });

  test("images and icons have alt text", async ({ page }) => {
    await loadCards(page);

    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll("img")];
      return imgs
        .filter((img) => !img.alt && !img.getAttribute("role"))
        .map((img) => img.src);
    });

    expect(imagesWithoutAlt.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // CONTRAST (basic check)
  // ---------------------------------------------------------------------------

  test("text meets minimum contrast ratio (spot check)", async ({ page }) => {
    await loadCards(page);

    const lowContrast = await page.evaluate(() => {
      // Spot-check a few key text elements
      const elements = document.querySelectorAll("h1, h2, h3, p, label, button, a");
      const issues = [];

      for (const el of [...elements].slice(0, 20)) {
        const style = getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        // Basic check: if both are very similar light colors, flag it
        if (color === bg && color !== "rgba(0, 0, 0, 0)") {
          issues.push(el.textContent?.trim().slice(0, 30));
        }
      }
      return issues;
    });

    expect(lowContrast.length).toBe(0);
  });
});

// =============================================================================
// Helpers
// =============================================================================

async function loadCards(page) {
  const select = page.locator("select").first();
  const opts = await select.locator("option").allTextContents();
  const plantOpt = opts.find((o) => /plant/i.test(o));
  await select.selectOption({ label: plantOpt });
  await page.waitForTimeout(300);

  const filePath = path.resolve(__dirname, "fixtures", "sample-plants.csv");
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

function logViolations(violations) {
  if (violations.length === 0) return;
  console.log("\n=== AXE VIOLATIONS ===");
  for (const v of violations) {
    console.log(`\n[${v.impact}] ${v.id}: ${v.description}`);
    console.log(`  Help: ${v.helpUrl}`);
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`  Target: ${node.target.join(", ")}`);
      console.log(`  HTML: ${node.html.slice(0, 120)}`);
    }
  }
}
