/**
 * Persona gate: the five shipped personas must still be able to play the game.
 *
 * Runs each persona in logic-only replay mode (no draw, so a minute of game
 * time costs seconds), and fails the build when a persona crashes the page or
 * cannot find its first mote inside 30 seconds - the two ways a change makes
 * the game unplayable without making any test red.
 *
 *   node scripts/replay-gate.mjs [dist|url]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runReplay, printMetrics } from "./replay.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] ?? path.join(ROOT, "dist");
const SECONDS = 45;
/** The idle persona spends its first 15 seconds deliberately doing nothing. */
const FIRST_COLLECT_DEADLINE = { default: 30, "idle-15s": 42 };
const PERSONAS = ["cautious", "greedy", "idle-15s", "keyboard-only", "touch-only"];

let failures = 0;
for (const persona of PERSONAS) {
  const metrics = await runReplay({
    target,
    persona,
    seconds: SECONDS,
    out: path.join(ROOT, "test-results", "replay-gate", persona),
    capture: false,
    render: false,
    lock: false,
    quiet: true,
  });
  printMetrics(metrics);

  const deadline = FIRST_COLLECT_DEADLINE[persona] ?? FIRST_COLLECT_DEADLINE.default;
  const problems = [];
  if (metrics.mode !== "replay") problems.push("build has no replay runtime (compat mode)");
  if (metrics.pageErrors.length) problems.push(`page errors: ${metrics.pageErrors.slice(0, 3).join(" | ")}`);
  if (metrics.levelsReached < 1) problems.push("never reached a level");
  if (metrics.timeToFirstCollectSeconds === null || metrics.timeToFirstCollectSeconds > deadline) {
    problems.push(`first collect ${metrics.timeToFirstCollectSeconds ?? "never"}s, deadline ${deadline}s`);
  }
  if (problems.length) {
    failures += 1;
    console.error(`[gate] FAIL ${persona}: ${problems.join("; ")}`);
  } else {
    console.log(`[gate] pass ${persona}`);
  }
}

if (failures) {
  console.error(`[gate] ${failures}/${PERSONAS.length} personas failed`);
  process.exit(1);
}
console.log(`[gate] all ${PERSONAS.length} personas passed`);
