import { defineConfig, devices } from "@playwright/test";

// IMPORTANT: Tests must only run against localhost. Never test against the
// deployed GitHub Pages site (https://maxfrost1308.github.io/card-maker/)
// as it is used for visual testing and may be on a different feature branch.

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
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
