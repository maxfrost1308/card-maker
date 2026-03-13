import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // sequential — some tests depend on app state
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "https://maxfrost1308.github.io/card-maker/",
    // For local dev, change to: "http://localhost:5173"
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
