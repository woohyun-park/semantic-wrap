import { defineConfig, devices } from "@playwright/test";

const scope = process.env.SEMANTIC_WRAP_TEST_SCOPE ?? "all";
if (!["all", "react", "docs"].includes(scope)) {
  throw new Error(`Unknown SEMANTIC_WRAP_TEST_SCOPE: ${scope}`);
}

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: scope === "docs" ? "**/docs.spec.ts" : undefined,
  testIgnore: scope === "react" ? "**/docs.spec.ts" : undefined,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:4191",
    trace: "retain-on-failure",
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
  ],
  webServer: [
    ...(scope === "docs" ? [] : [{
      command: "bun tests/browser/server.ts",
      url: "http://127.0.0.1:4191",
      reuseExistingServer: false,
      stdout: "pipe" as const,
      stderr: "pipe" as const,
      timeout: 120_000,
    }]),
    ...(scope === "react" ? [] : [{
      command: "bun run --cwd apps/docs preview --host 127.0.0.1 --port 4192 --strictPort",
      url: "http://127.0.0.1:4192",
      reuseExistingServer: false,
      stdout: "pipe" as const,
      stderr: "pipe" as const,
      timeout: 120_000,
    }]),
  ],
});
