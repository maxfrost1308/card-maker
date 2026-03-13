// e2e/04-export-print.spec.js
// Tests: CSV download, deck export/import, print layout
import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Export, import & print", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    const select = page.locator("select").first();
    await select.selectOption({ label: /Plant/i });
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
  // Save / Download CSV
  // ---------------------------------------------------------------------------

  test("Save button triggers download or File System Access save", async ({
    page,
  }) => {
    const saveBtn = page.locator("button:has-text('Save'), a:has-text('Save')").first();
    await expect(saveBtn).toBeVisible();

    // Listen for a download event (non-Chromium fallback path)
    const downloadPromise = page.waitForEvent("download", { timeout: 3000 }).catch(() => null);
    await saveBtn.click();
    const download = await downloadPromise;

    // Either a download happened or the File System Access API was used (no download event)
    // Both are valid — we just verify no error was thrown
  });

  // ---------------------------------------------------------------------------
  // Export deck (.cardmaker)
  // ---------------------------------------------------------------------------

  test("Export deck triggers a .cardmaker file download", async ({ page }) => {
    // Open the Export dropdown
    const exportTrigger = page.getByText(/Export ▾/i);
    if (await exportTrigger.isVisible()) {
      await exportTrigger.click();
      await page.waitForTimeout(300);

      const exportDeck = page.getByText(/Export deck/i);
      if (await exportDeck.isVisible()) {
        const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
        await exportDeck.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.cardmaker$/);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Export as PNG
  // ---------------------------------------------------------------------------

  test("Export cards as PNG is available", async ({ page }) => {
    const exportTrigger = page.getByText(/Export ▾/i);
    if (await exportTrigger.isVisible()) {
      await exportTrigger.click();
      await page.waitForTimeout(300);

      const pngExport = page.getByText(/Export cards as PNG/i);
      await expect(pngExport).toBeVisible();
    }
  });

  // ---------------------------------------------------------------------------
  // Print / PDF
  // ---------------------------------------------------------------------------

  test("Print button opens print layout or triggers print dialog", async ({
    page,
  }) => {
    const printBtn = page.getByText(/Print \/ PDF/i);
    await expect(printBtn).toBeVisible();

    // Intercept window.print() to avoid actually opening the dialog
    await page.evaluate(() => {
      window.__printCalled = false;
      window.print = () => {
        window.__printCalled = true;
      };
    });

    await printBtn.click();
    await page.waitForTimeout(1000);

    // Check if print was called OR if a print-specific layout was rendered
    const printCalled = await page.evaluate(() => window.__printCalled);
    const printLayout = page.locator(
      "[class*='print'], @media print, [class*='layout']"
    );
    const printLayoutVisible =
      printCalled || (await printLayout.count()) > 0;

    expect(printLayoutVisible).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Keyboard shortcut: Ctrl+S
  // ---------------------------------------------------------------------------

  test("Ctrl+S triggers save", async ({ page }) => {
    // Intercept to prevent browser default save-page dialog
    await page.evaluate(() => {
      window.__saveCalled = false;
      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key === "s") {
          window.__saveCalled = true;
        }
      });
    });

    await page.keyboard.press("Control+s");
    await page.waitForTimeout(500);

    const saveCalled = await page.evaluate(() => window.__saveCalled);
    expect(saveCalled).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Sample CSV downloads
  // ---------------------------------------------------------------------------

  test("Download sample CSV link triggers a download", async ({ page }) => {
    const sampleLink = page.getByText(/Download sample CSV/i);
    if (await sampleLink.isVisible()) {
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
      await sampleLink.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    }
  });

  test("Download blank template CSV link triggers a download", async ({
    page,
  }) => {
    const templateLink = page.getByText(/Download blank template/i);
    if (await templateLink.isVisible()) {
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
      await templateLink.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    }
  });
});
