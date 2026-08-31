#!/usr/bin/env node
/**
 * Repo hygiene guard for the Start of Glow game-off.
 *
 * The canonical repo holds game code, assets and public docs - nothing else.
 * Agent workspace files (durable state, private journals, harness config) stay
 * in each contestant's own workspace, and secrets stay out of git entirely.
 *
 * Run it with `npm run check`. It exits non-zero with the offending paths so a
 * winner's branch cannot be merged with workspace spill in it.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/** Exact file/dir names that must never appear anywhere in the repo. */
const FORBIDDEN_NAMES = new Set([
  "STATE.md",
  "JOURNAL.md",
  "NOTES.md",
  "MEMORY.md",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".claude",
  ".codex",
  ".grok",
  ".kimi-code",
  ".gemini",
  ".agents",
  "journal",
  "notes",
  "private",
  "memory",
  "workspace",
  ".env",
]);

/** Patterns that catch the same spill under a different name. */
const FORBIDDEN_PATTERNS = [
  { re: /\.private\.[^/]+$/i, why: "private file" },
  { re: /(^|\/)\.env(\..+)?$/i, why: "environment/secrets file" },
  { re: /(^|\/)(state|journal|scratch|handoff)[-_.].*\.(md|json|jsonl|txt)$/i, why: "agent workspace note" },
  { re: /(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/i, why: "ssh key" },
];

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "test-results", "playwright-report"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = resolve(dir, entry);
    const rel = relative(ROOT, abs).split(sep).join("/");
    if (SKIP_DIRS.has(entry)) continue;
    const stats = statSync(abs);
    out.push({ rel, name: entry, dir: stats.isDirectory() });
    if (stats.isDirectory()) walk(abs, out);
  }
  return out;
}

function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((rel) => ({ rel, name: rel.split("/").pop(), dir: false }));
  } catch {
    return [];
  }
}

const seen = new Map();
for (const entry of [...walk(ROOT), ...trackedFiles()]) {
  seen.set(entry.rel, entry);
}

const violations = [];
for (const entry of seen.values()) {
  if (FORBIDDEN_NAMES.has(entry.name)) {
    violations.push(`${entry.rel} - workspace file "${entry.name}" belongs in the agent's own workspace`);
    continue;
  }
  for (const { re, why } of FORBIDDEN_PATTERNS) {
    if (re.test(entry.rel)) {
      violations.push(`${entry.rel} - ${why}`);
      break;
    }
  }
}

// Round notes: the judge-facing "what changed" panel (src/round-notes.ts)
// reads public/round-notes.json, and a build whose notes are missing, empty or
// placeholder text is a build the judge has to guess at - fail it here, not at
// the judging table.
try {
  const { readFileSync } = await import("node:fs");
  const raw = JSON.parse(readFileSync(resolve(ROOT, "public/round-notes.json"), "utf8"));
  const notes = Array.isArray(raw.notes) ? raw.notes : null;
  if (!Number.isInteger(raw.round) || raw.round < 1) {
    violations.push('public/round-notes.json - "round" must be the round number you are building');
  }
  if (!notes || notes.length < 3 || notes.length > 6) {
    violations.push('public/round-notes.json - "notes" must hold 3 to 6 one-liners on what this round changed');
  } else {
    for (const note of notes) {
      const text = typeof note === "string" ? note.trim() : "";
      if (text.length === 0 || text.length > 160) {
        violations.push(`public/round-notes.json - each note is one non-empty line of at most 160 characters (got: ${JSON.stringify(note).slice(0, 60)})`);
      } else if (/^(\.{3}|todo|tbd|fixme)\b/i.test(text)) {
        violations.push(`public/round-notes.json - placeholder note "${text}" - write what actually changed`);
      }
    }
  }
} catch {
  violations.push("public/round-notes.json - missing or not valid JSON; every build ships its round notes");
}

if (violations.length > 0) {
  console.error("repo check FAILED - the canonical repo takes game code, assets and public docs only:\n");
  for (const v of violations.sort()) console.error(`  x ${v}`);
  console.error(
    "\nMove these to your own agent workspace (or delete them) and run `npm run check` again.",
  );
  process.exit(1);
}

console.log(`repo check OK - ${seen.size} paths scanned, no agent workspace files present`);
