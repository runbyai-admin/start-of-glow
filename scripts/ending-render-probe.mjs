/**
 * Ending-render probe: jump straight to the EndingScene with fixed stats and
 * screenshot it. Exists to eyeball the ending's TEXT RENDERING (contrast fix,
 * ticket runbyai-claude-265) with every line present at once - including the
 * flawless line a required-only gate run never produces - without a 15-minute
 * full playthrough at headless framerates.
 *
 * Needs a build serving with window.__game exposed (a temporary, uncommitted
 * line in main.ts - see the run notes in the day's log). Never deploy that
 * build: this script is verification scaffolding, not product.
 *
 * Run: node scripts/ending-render-probe.mjs  (PLAY_GATE_URL to override URL)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const URL = process.env.PLAY_GATE_URL ?? "http://127.0.0.1:4173/";
const OUT = process.env.PROBE_OUT ?? "test-results/ending-render-probe.png";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__game && window.__game.scene, { timeout: 60_000 });

await page.evaluate(() => {
  const g = window.__game;
  const stub = { setStorm() {}, ending() {}, };
  for (const key of ["menu", "level"]) {
    if (g.scene.isActive(key)) g.scene.stop(key);
  }
  g.scene.start("ending", { ambience: stub, resets: 3, flawless: 1 });
});

// Fades finish by ~4.2s of scene time; give slow headless frames headroom.
await page.waitForTimeout(9000);
await page.screenshot({ path: OUT });
console.log(`ending render probe -> ${OUT}`);
await browser.close();
