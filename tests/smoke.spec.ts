import { expect, test } from "@playwright/test";

/**
 * The smoke test contestants extend.
 *
 * It answers the only question the owner asks at judging time: does the build
 * actually come up and respond to input? Add your own tests beside it - keep
 * this one passing, a build that fails it is not playable.
 */

function collectConsoleErrors(page: import("@playwright/test").Page): string[] {
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
  return consoleErrors;
}

test("the title screen comes up with the light pipeline running", async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  // The scene sets this once its first frame has been rendered.
  await page.waitForSelector("body[data-game-ready='true']", { timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();

  const state = await page.evaluate(() => window.__glow);
  expect(state?.ready).toBe(true);
  expect(state?.scene).toBe("menu");
  expect(state?.lightsActive).toBe(true);

  await page.screenshot({ path: "test-results/menu.png" });
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("starting the game loads level 1, and the light-being follows input and collects motes", async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("body[data-game-ready='true']", { timeout: 30_000 });

  const canvas = page.locator("canvas");
  let box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Any input starts the game from the title screen.
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForFunction(() => window.__glow?.scene === "level", { timeout: 5_000 });

  box = await canvas.boundingBox();
  const { x, y, width, height } = box!;

  // Sweep the pointer across the scene; the wisp chases it and eats whatever
  // motes it passes through. A second click part-way through re-centres the
  // sweep so it does not spend the whole pass right at the level's start
  // point, where the level places no motes.
  //
  // Step count and per-step wait give the wisp real time to cover real
  // ground: the wisp's speed is capped (WISP_MAX_SPEED in LevelScene.ts,
  // shared between keyboard and mouse input as of the movement-fairness fix
  // - see that file's note), so a full-viewport sweep now takes several
  // real seconds rather than the near-instant catch-up unbounded mouse
  // input used to allow. 40 steps * 90ms = 3.6s, comfortably above the
  // ~2.7s a capped wisp needs to cross the full 1280px viewport width once.
  for (let i = 0; i <= 40; i += 1) {
    const px = x + (width * i) / 40;
    const py = y + height * (0.25 + 0.5 * Math.abs(Math.sin(i / 5)));
    await page.mouse.move(px, py);
    await page.waitForTimeout(90);
  }
  await page.mouse.click(x + width / 2, y + height / 2);
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => window.__glow);
  expect(state?.scene).toBe("level");
  expect(state?.level).toBe(1);
  expect(state?.collected, "the sweep should have collected at least one mote").toBeGreaterThan(0);
  expect(state?.glowRadius).toBeGreaterThan(260);

  await page.screenshot({ path: "test-results/level-1-after-input.png" });
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
