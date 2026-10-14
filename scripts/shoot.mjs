#!/usr/bin/env node
/**
 * Screenshot script for the visual check loop.
 *
 *   node scripts/shoot.mjs <url> [<url> ...] [--size=1920x1080] [--wait=1800] [--at=0,300,1500] [--base=http://localhost:3000]
 *
 * - A URL can be absolute or a path ("/explore?turn=build&step=2").
 * - --size   viewport size. Default 1920x1080.
 * - --wait   ms to wait after load before the shot. Default 1800 (lets motion settle).
 * - --at     take several shots at these ms after load (for motion checks). Overrides --wait.
 * - --reduced  emulate prefers-reduced-motion.
 * PNGs go to app/.shots/<slug>[@<ms>]-<WxH>.png. The script prints each path.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "..", ".shots");

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? "true"];
    }),
);
const urls = args.filter((a) => !a.startsWith("--"));
if (urls.length === 0) {
  console.error("Usage: node scripts/shoot.mjs <url> [<url> ...] [--size=WxH] [--wait=ms] [--at=0,300,1500]");
  process.exit(1);
}

const [width, height] = (flags.size ?? "1920x1080").split("x").map(Number);
if (!width || !height) {
  console.error(`Bad --size: ${flags.size}`);
  process.exit(1);
}
const base = flags.base ?? "http://localhost:3000";
const wait = Number(flags.wait ?? 1800);
const at = flags.at ? flags.at.split(",").map(Number) : null;

function slug(u) {
  const url = new URL(u, base);
  const s = `${url.pathname}${url.search}${url.hash}`
    .replace(/^\/+/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "home";
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  reducedMotion: flags.reduced ? "reduce" : "no-preference",
});

let failed = 0;
for (const u of urls) {
  const full = new URL(u, base).toString();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  try {
    await page.goto(full, { waitUntil: "load", timeout: 60000 });
    const t0 = Date.now();
    await page.evaluate(() => document.fonts?.ready);
    const times = at ?? [wait];
    for (const ms of times) {
      const remaining = ms - (Date.now() - t0);
      if (remaining > 0) await page.waitForTimeout(remaining);
      const name = `${slug(u)}${at ? `@${ms}` : ""}-${width}x${height}.png`;
      const file = path.join(outDir, name);
      await page.screenshot({ path: file });
      console.log(file);
    }
    if (errors.length) console.warn(`  console errors on ${full}:\n  - ${errors.slice(0, 5).join("\n  - ")}`);
  } catch (err) {
    failed++;
    console.error(`Failed: ${full}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
