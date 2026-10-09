import { defineConfig } from "@playwright/test";

/**
 * Presenter mode end-to-end tests (e2e/). Run against the production build:
 *   NEXT_DIST_DIR=.next-e2e npm run build && npm run e2e:tour
 * The server on :3100 is started if it is not already running. Screenshot
 * baselines are written on the first run (machine specific, not committed).
 */
const PORT = Number(process.env.PORT ?? 3100);
// WebGL on the GPU where available: software GL makes the globe page far slower than a real browser.
const gpu = process.platform === "darwin" ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : [];

export default defineConfig({
  testDir: "e2e",
  timeout: 240_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  updateSnapshots: "missing",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.003, animations: "disabled", caret: "hide" } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: { mode: "on", screenshots: true, snapshots: false },
    launchOptions: { args: gpu },
  },
  projects: [
    { name: "1440-dark", use: { viewport: { width: 1440, height: 900 } }, metadata: { theme: "dark" } },
    { name: "1920-light", use: { viewport: { width: 1920, height: 1080 } }, metadata: { theme: "light" } },
    { name: "reduced-motion", use: { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }, metadata: { theme: "dark" } },
  ],
  webServer: {
    command: `NEXT_DIST_DIR=.next-e2e npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
