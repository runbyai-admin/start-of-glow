import { expect, test } from "@playwright/test";

/**
 * The smoke test contestants extend.
 *
 * It answers the only question the owner asks at judging time: does the build
 * actually come up and respond to input? Add your own tests beside it - keep
 * this one passing, a build that fails it is not playable.
 */

test("boot scene comes up with the light pipeline running", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    // "Failed to load resource" carries no URL, so bad responses are checked
    // through the response listener below instead.
    if (msg.type() === "error" && !/Failed to load resource/.test(msg.text())) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  // The analytics beacon is fire-and-forget and only accepted from the
  // deployed origins, so its status off-production is not the game's problem.
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("/api/marketing/analytics/")) {
      consoleErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  // The scene sets this once its first frame has been rendered.
  await page.waitForSelector("body[data-game-ready='true']", { timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();

  const state = await page.evaluate(() => window.__glow);
  expect(state?.ready).toBe(true);
  expect(state?.lightsActive).toBe(true);
  expect(state?.remaining).toBeGreaterThan(0);

  await page.screenshot({ path: "test-results/boot-scene.png" });
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("the light-being follows input and collects motes", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("body[data-game-ready='true']", { timeout: 30_000 });

  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const { x, y, width, height } = box!;

  // Sweep the pointer across the scene; the wisp chases it and eats whatever
  // motes it passes through.
  for (let i = 0; i <= 24; i += 1) {
    const px = x + (width * i) / 24;
    const py = y + height * (0.25 + 0.5 * Math.abs(Math.sin(i / 3)));
    await page.mouse.move(px, py);
    await page.waitForTimeout(60);
  }
  await page.mouse.click(x + width / 2, y + height / 2);
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => window.__glow);
  expect(state?.collected, "the sweep should have collected at least one mote").toBeGreaterThan(0);
  expect(state?.glowRadius).toBeGreaterThan(260);

  await page.screenshot({ path: "test-results/after-input.png" });
});
