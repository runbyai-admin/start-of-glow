/**
 * The agent play driver: play Start of Glow yourself, one command at a time.
 *
 * The replay harness answers "record a run"; this answers "let me play". A
 * session is a growing input script on disk, and every command replays it from
 * frame 0 in logic-only mode (about 550 fps, deterministic per seed), applies
 * your new input, and reports what happened - so there is no daemon to keep
 * alive, a crash loses nothing, and every session is automatically a
 * reproducible replay.
 *
 *   npm run play -- dist --session s1 act "wait 1.5s; tap 640 360; hold ArrowRight 2s"
 *   npm run play -- dist --session s1 peek              # PNG of the current frame
 *   npm run play -- dist --session s1 peek --at 12s     # PNG of any past moment
 *   npm run play -- dist --session s1 state             # where the session stands
 *   npm run play -- dist --session s1 export replay/personas/my-run.json
 *
 * The DSL is documented in scripts/play-dsl.mjs (wait, press, hold, tap, move,
 * drag). Sessions live in .play/ (git-ignored) keyed by name; the seed is part
 * of the session and a --seed that disagrees refuses. An exported session is a
 * `"kind": "script"` persona that scripts/replay.mjs plays back verbatim -
 * including as a full video render for the pre-deploy check.
 *
 * No render queue: logic-only stepping costs no render slot, and a peek is one
 * software draw. Full videos still go through `npm run replay` and its queue.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./play-dsl.mjs";
import { serveDist } from "./replay.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIEW = { w: 1280, h: 720 };
const CHUNK_FRAMES = 600;
/** A window this long with no visible state change earns a feel warning. */
const STAGNATION_FRAMES = 180;

const log = (m) => console.log(`[play] ${m}`);

function usage(message) {
  if (message) console.error(`[play] ${message}`);
  console.error(
    "usage: npm run play -- <dist|url> --session <name> [--seed N] <command>\n" +
      '  act "<dsl>"              feed input and advance (wait/press/hold/tap/move/drag)\n' +
      "  peek [--at <2s|120f>]    write a PNG of the current (or a past) frame\n" +
      "  state                    where the session stands, without replaying\n" +
      "  export <file.json>       write the session as a script persona\n" +
      "  DSL and details: scripts/play-dsl.mjs",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { target: null, session: null, seed: null, at: null, command: null, rest: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--session") opts.session = argv[++i];
    else if (a === "--seed") opts.seed = Number.parseInt(argv[++i], 10);
    else if (a === "--at") opts.at = argv[++i];
    else if (!opts.target) opts.target = a;
    else if (!opts.command) opts.command = a;
    else opts.rest.push(a);
  }
  if (!opts.target || !opts.session || !opts.command) usage("target, --session and a command are required");
  if (!/^[a-z0-9][a-z0-9._-]{0,40}$/i.test(opts.session)) usage(`bad session name "${opts.session}"`);
  if (!["act", "peek", "state", "export"].includes(opts.command)) usage(`unknown command "${opts.command}"`);
  return opts;
}

function sessionPaths(name) {
  const dir = path.join(ROOT, ".play");
  return { dir, file: path.join(dir, `${name}.json`), shots: path.join(dir, name) };
}

function loadSession(opts) {
  const { file } = sessionPaths(opts.session);
  if (fs.existsSync(file)) {
    const session = JSON.parse(fs.readFileSync(file, "utf8"));
    if (opts.seed !== null && opts.seed !== session.seed) {
      throw new Error(
        `session "${opts.session}" was played on seed ${session.seed}, not ${opts.seed} - ` +
          "a different seed is a different world, so start a new session for it",
      );
    }
    return session;
  }
  return {
    version: 1,
    seed: opts.seed ?? 1,
    created: new Date().toISOString(),
    cursor: 0,
    actions: {},
    log: [],
    last: null,
  };
}

function saveSession(opts, session) {
  const { dir, file } = sessionPaths(opts.session);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(session)}\n`);
}

function parseAt(raw, cursor) {
  const m = /^(\d+(?:\.\d+)?)(s|f)$/.exec(raw ?? "");
  if (!m) usage(`--at must be like "12s" or "300f", got "${raw}"`);
  const frame = m[2] === "s" ? Math.round(Number.parseFloat(m[1]) * 60) : Math.round(Number.parseFloat(m[1]));
  if (frame > cursor) usage(`--at ${raw} is beyond the session's ${cursor} frames - peek looks at the past, act to get there`);
  return frame;
}

/** Replay the session's actions from frame 0 to `frames`, in logic-only mode. */
async function replayTo(opts, session, frames) {
  let served = null;
  let base = opts.target;
  if (!/^https?:\/\//.test(base)) {
    served = await serveDist(base);
    base = served.url;
  }
  const url = new URL(base);
  url.searchParams.set("glow-replay", String(session.seed));
  url.searchParams.set("glow-replay-seconds", String(Math.ceil(frames / 60) + 2));
  url.searchParams.set("glow-replay-render", "off");

  const browser = await chromium.launch({
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"],
  });
  const pageErrors = [];
  try {
    const context = await browser.newContext({ viewport: { width: VIEW.w, height: VIEW.h }, hasTouch: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(String(e.message)));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) pageErrors.push(`console: ${m.text()}`);
    });
    const origin = new URL(base).origin;
    await context.route("**/*", (route) => {
      const target = route.request().url();
      return target.startsWith(origin) && !target.includes("/api/marketing/analytics/track")
        ? route.continue()
        : route.abort();
    });

    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("body[data-glow-replay='ready']", { timeout: 120_000 });
    if (!(await page.evaluate(() => Boolean(window.__glowReplay?.ready)))) {
      throw new Error("this build has no replay runtime - the play driver needs a build from round-5-base onward");
    }

    const timeline = [];
    for (let from = 0; from < frames; from += CHUNK_FRAMES) {
      const to = Math.min(from + CHUNK_FRAMES, frames);
      const acts = {};
      for (let f = from; f < to; f += 1) {
        if (session.actions[String(f)]) acts[String(f)] = session.actions[String(f)];
      }
      const samples = await page.evaluate(
        async ({ from, to, acts }) => {
          const out = [];
          for (let f = from; f < to; f += 1) out.push(await window.__glowReplay.step(acts[String(f)] ?? []));
          return out;
        },
        { from, to, acts },
      );
      timeline.push(...samples);
    }
    return { page, browser, timeline, pageErrors, close: async () => { await browser.close(); served?.close(); } };
  } catch (err) {
    await browser.close();
    served?.close();
    throw err;
  }
}

function fmtTime(frame) {
  return `${(frame / 60).toFixed(2)}s`;
}

/** Everything that happened in timeline[from..], as one-line events. */
function eventsIn(timeline, fromFrame) {
  const events = [];
  let prev = null;
  let sounds = 0;
  for (const s of timeline) {
    if (s.frame <= fromFrame) {
      prev = s;
      continue;
    }
    if (prev) {
      if (s.scene !== prev.scene) events.push(`${fmtTime(s.frame)} scene ${prev.scene} -> ${s.scene}`);
      if (s.scene === "level" && prev.scene === "level") {
        if (s.level !== prev.level) events.push(`${fmtTime(s.frame)} entered level ${s.level}`);
        if (s.collected > prev.collected) events.push(`${fmtTime(s.frame)} collected mote ${s.collected} (${s.remaining} left)`);
        if (s.resets > prev.resets) events.push(`${fmtTime(s.frame)} FAILED - a hazard snuffed the light (reset ${s.resets})`);
        if (s.beaconOpen && !prev.beaconOpen) events.push(`${fmtTime(s.frame)} beacon opened`);
        if (s.chain > 0 && prev.chain === 0) events.push(`${fmtTime(s.frame)} lumen chain started`);
      }
    }
    sounds += s.sounds;
    prev = s;
  }
  return { events, sounds };
}

/** Feel warnings the driver can spot without eyes on the screen. */
function warningsIn(timeline, fromFrame) {
  const warnings = [];
  const window_ = timeline.filter((s) => s.frame > fromFrame);

  let stillRun = 0;
  let worstStill = 0;
  let prev = null;
  for (const s of window_) {
    const same =
      prev &&
      s.scene === prev.scene &&
      s.wispX === prev.wispX &&
      s.wispY === prev.wispY &&
      s.collected === prev.collected &&
      s.sounds === 0;
    stillRun = same ? stillRun + 1 : 0;
    worstStill = Math.max(worstStill, stillRun);
    prev = s;
  }
  if (worstStill >= STAGNATION_FRAMES) {
    warnings.push(`nothing moved, collected or sounded for ${(worstStill / 60).toFixed(1)}s - would a player wait that out?`);
  }

  let worstLatency = 0;
  for (let i = 0; i < window_.length; i += 1) {
    if (!window_[i].inputs || window_[i].scene !== "level") continue;
    let moved = false;
    for (let j = i + 1; j < Math.min(window_.length, i + 30); j += 1) {
      if (window_[j].wispX !== window_[i].wispX || window_[j].wispY !== window_[i].wispY) {
        worstLatency = Math.max(worstLatency, j - i);
        moved = true;
        break;
      }
    }
    if (!moved) worstLatency = Math.max(worstLatency, 30);
  }
  if (worstLatency >= 10) {
    warnings.push(`input went ${worstLatency} frames without visible motion - the game may not be answering the hand`);
  }
  return warnings;
}

function describe(sample) {
  const parts = [`frame ${sample.frame} (${fmtTime(sample.frame)})`, `scene=${sample.scene}`];
  if (sample.scene === "level") {
    parts.push(
      `level=${sample.level}`,
      `collected=${sample.collected} remaining=${sample.remaining}`,
      `resets=${sample.resets}`,
      `wisp=${Math.round(sample.wispX)},${Math.round(sample.wispY)}`,
      sample.beaconOpen ? "beacon OPEN" : "beacon closed",
    );
  }
  return parts.join("  ");
}

function report(session, timeline, fromFrame, pageErrors) {
  const last = timeline[timeline.length - 1];
  const { events, sounds } = eventsIn(timeline, fromFrame);
  const warnings = warningsIn(timeline, fromFrame);

  console.log(`\n[play] ${describe(last)}`);
  const before = timeline.find((s) => s.frame >= fromFrame) ?? timeline[0];
  const moved =
    before && last.scene === "level" && before.scene === "level"
      ? Math.round(Math.hypot(last.wispX - before.wispX, last.wispY - before.wispY))
      : 0;
  if (events.length) {
    console.log(`[play] since your last command (${fmtTime(fromFrame)} -> ${fmtTime(last.frame)}):`);
    for (const e of events.slice(0, 40)) console.log(`  ${e}`);
    if (events.length > 40) console.log(`  ... and ${events.length - 40} more`);
    if (moved) console.log(`  wisp moved ${moved}px to ${Math.round(last.wispX)},${Math.round(last.wispY)}`);
  } else if (last.frame > fromFrame) {
    console.log(
      moved
        ? `[play] since your last command: the wisp moved ${moved}px to ${Math.round(last.wispX)},${Math.round(last.wispY)} - nothing else happened`
        : "[play] since your last command: nothing observable happened",
    );
  }
  if (sounds) console.log(`[play] sound events in the window: ${sounds}`);
  for (const w of warnings) console.log(`[play] FEEL: ${w}`);
  for (const e of pageErrors.slice(0, 5)) console.log(`[play] PAGE ERROR: ${e}`);

  session.last = { sample: last, events: events.slice(0, 40), warnings, at: new Date().toISOString() };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const session = loadSession(opts);

  if (opts.command === "state") {
    if (!session.last) {
      console.log(`[play] session "${opts.session}" (seed ${session.seed}) has ${session.cursor} frames and no report yet - act first`);
      return;
    }
    console.log(`[play] session "${opts.session}" seed=${session.seed} frames=${session.cursor}`);
    console.log(`[play] ${describe(session.last.sample)}`);
    for (const e of session.last.events) console.log(`  ${e}`);
    for (const w of session.last.warnings) console.log(`[play] FEEL: ${w}`);
    return;
  }

  if (opts.command === "export") {
    const out = opts.rest[0];
    if (!out) usage("export takes an output file path");
    if (session.cursor === 0) throw new Error("nothing to export - the session has no frames yet");
    const persona = {
      name: path.basename(out).replace(/\.json$/, ""),
      description: `play session "${opts.session}" exported ${new Date().toISOString().slice(0, 10)}`,
      kind: "script",
      seed: session.seed,
      frames: session.cursor,
      seconds: Math.ceil(session.cursor / 60),
      actions: session.actions,
    };
    fs.writeFileSync(out, `${JSON.stringify(persona, null, 2)}\n`);
    log(`wrote ${out} - play it back with: npm run replay -- dist --persona ${persona.name} --seconds ${persona.seconds}`);
    return;
  }

  if (opts.command === "act") {
    const program = opts.rest.join(" ");
    if (!program.trim()) usage('act takes a DSL program, e.g. act "hold ArrowRight 2s; tap 620 400"');
    const compiled = compile(program, session.cursor);
    for (const [frame, acts] of Object.entries(compiled.actions)) {
      session.actions[frame] = [...(session.actions[frame] ?? []), ...acts];
    }
    const fromFrame = session.cursor;
    session.cursor = compiled.endFrame;
    session.log.push({ cmd: program, from: fromFrame, to: session.cursor, at: new Date().toISOString() });

    const started = Date.now();
    const run = await replayTo(opts, session, session.cursor);
    try {
      report(session, run.timeline, fromFrame, run.pageErrors);
      log(`replayed ${session.cursor} frames in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } finally {
      await run.close();
    }
    saveSession(opts, session);
    return;
  }

  // peek
  const frame = opts.at ? parseAt(opts.at, session.cursor) : session.cursor;
  if (frame === 0) throw new Error("nothing to peek at - the session has no frames yet");
  const run = await replayTo(opts, session, frame);
  try {
    const dataUrl = await run.page.evaluate(() => window.__glowReplay.capture());
    if (!dataUrl) throw new Error("capture failed - the one-frame draw threw in the page");
    const { shots } = sessionPaths(opts.session);
    fs.mkdirSync(shots, { recursive: true });
    const file = path.join(shots, `peek-${String(frame).padStart(6, "0")}.png`);
    fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
    console.log(`[play] ${describe(run.timeline[run.timeline.length - 1] ?? { frame, scene: "boot" })}`);
    log(`wrote ${path.relative(process.cwd(), file)}`);
  } finally {
    await run.close();
  }
}

await main();
