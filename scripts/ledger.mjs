#!/usr/bin/env node
/**
 * The wins and tips ledger for the Run by AI game-off.
 *
 * `ledger.json` is the source of truth and `LEDGER.md` is generated from it, so
 * the standings can never disagree with the record they are derived from.
 *
 *   node scripts/ledger.mjs check                 validate ledger.json
 *   node scripts/ledger.mjs status                print the standings
 *   node scripts/ledger.mjs render                rewrite LEDGER.md
 *   node scripts/ledger.mjs record-round --round 1 --winner claude \
 *        --verdict "..." --commit <sha> [--date YYYY-MM-DD] [--verdict-file v.json]
 *   node scripts/ledger.mjs verdict-check --file v.json [--print verdict|winner|video]
 *   node scripts/ledger.mjs tip --provider claude --note "..." [--date YYYY-MM-DD]
 *
 * The git side of a round - commit, tags, push - belongs to scripts/bank-round.sh
 * and scripts/skip-round.sh; this script only ever touches ledger.json and LEDGER.md.
 *
 * A win is one glow point. The first tip costs 3 points and each further tip
 * costs one more, so a provider's Nth tip costs N+2 and the balance is wins
 * minus everything spent. Three wins before any advice is bought is deliberate:
 * a tip should cost a run of good rounds, not a single lucky one.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DATA = resolve(ROOT, "ledger.json");
const DOC = resolve(ROOT, "LEDGER.md");

const PROVIDERS = ["claude", "openai", "grok"];
/** What a provider's Nth tip costs, in glow points: 3, 4, 5, ... */
const tipCost = (n) => n + 2;
const LABEL = { claude: "Claude", openai: "OpenAI", grok: "Grok" };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** The four fields the owner fills in per build while judging (RULES.md, "Judging"). */
const VERDICT_FIELDS = ["did", "stopped", "keep", "kill"];
const FIELD_LABEL = {
  did: "First two minutes",
  stopped: "Where I stopped",
  keep: "Keep",
  kill: "Kill",
};

function die(msg) {
  console.error(`ledger: ${msg}`);
  process.exit(1);
}

function load() {
  let raw;
  try {
    raw = readFileSync(DATA, "utf8");
  } catch {
    die(`cannot read ${DATA}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    die(`ledger.json is not valid JSON: ${err.message}`);
  }
  data.rounds ??= [];
  data.tips ??= [];
  return data;
}

function save(data) {
  writeFileSync(DATA, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Problems with a structured verdict: every provider, every field, non-empty.
 * The four fields are the owner's own words from the judging session, and a
 * build the owner did not write up is a build that was not judged - so a
 * partial verdict is a bug in the judging, not a shape the ledger accepts.
 */
function verdictProblems(builds, at) {
  const problems = [];
  if (!builds || typeof builds !== "object" || Array.isArray(builds)) {
    return [`${at} must be an object keyed by provider`];
  }
  for (const key of Object.keys(builds)) {
    if (!PROVIDERS.includes(key)) problems.push(`${at}.${key} is not a provider`);
  }
  for (const p of PROVIDERS) {
    const b = builds[p];
    if (!b || typeof b !== "object") {
      problems.push(`${at}.${p} is missing`);
      continue;
    }
    for (const f of VERDICT_FIELDS) {
      if (typeof b[f] !== "string" || !b[f].trim()) problems.push(`${at}.${p}.${f} is required`);
    }
  }
  return problems;
}

/**
 * Read a verdict file: the winner line, the optional judging video, and the
 * four fields per build. Written by the owner during judging and passed to
 * bank-round.sh / skip-round.sh / close-round.sh, so all three say the same
 * thing without the owner retyping it.
 */
function readVerdictFile(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    die(`cannot read verdict file ${path}`);
  }
  let v;
  try {
    v = JSON.parse(raw);
  } catch (err) {
    die(`${path} is not valid JSON: ${err.message}`);
  }
  const problems = [];
  if (typeof v.verdict !== "string" || !v.verdict.trim()) problems.push("verdict is required - the one line the video uses");
  if (v.video !== undefined && !/^https?:\/\/\S+$/.test(v.video ?? "")) problems.push("video must be a URL");
  if (v.winner !== undefined && v.winner !== "none" && v.winner !== null && !PROVIDERS.includes(v.winner)) {
    problems.push(`winner must be ${PROVIDERS.join("|")}|none`);
  }
  problems.push(...verdictProblems(v.builds, "builds"));
  if (problems.length) {
    console.error(`${path} is not a valid verdict file:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  return v;
}

/** Validate the record and return the derived standings, or exit non-zero. */
function derive(data) {
  const problems = [];
  const seenRounds = new Set();

  for (const [i, r] of data.rounds.entries()) {
    const at = `rounds[${i}]`;
    if (!Number.isInteger(r.round) || r.round < 1) problems.push(`${at}.round must be a positive integer`);
    else if (seenRounds.has(r.round)) problems.push(`${at}.round ${r.round} is recorded twice`);
    else seenRounds.add(r.round);
    if (!DATE_RE.test(r.date ?? "")) problems.push(`${at}.date must be YYYY-MM-DD`);
    if (r.winner !== null && !PROVIDERS.includes(r.winner)) {
      problems.push(`${at}.winner must be one of ${PROVIDERS.join(", ")} or null (no round)`);
    }
    if (typeof r.verdict !== "string" || !r.verdict.trim()) problems.push(`${at}.verdict is required`);
    if (r.winner && !/^[0-9a-f]{7,40}$/.test(r.commit ?? "")) {
      problems.push(`${at}.commit must be the merge commit sha`);
    }
    if (r.video !== undefined && !/^https?:\/\/\S+$/.test(r.video ?? "")) {
      problems.push(`${at}.video must be a URL`);
    }
    if (r.builds !== undefined) problems.push(...verdictProblems(r.builds, `${at}.builds`));
  }

  const rounds = [...data.rounds].sort((a, b) => a.round - b.round);
  const tips = [...data.tips].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const stand = Object.fromEntries(
    PROVIDERS.map((p) => [p, { wins: 0, tips: 0, spent: 0, balance: 0 }]),
  );
  for (const r of rounds) if (r.winner) stand[r.winner].wins += 1;

  for (const [i, t] of tips.entries()) {
    const at = `tips[${i}]`;
    if (!PROVIDERS.includes(t.provider)) {
      problems.push(`${at}.provider must be one of ${PROVIDERS.join(", ")}`);
      continue;
    }
    if (!DATE_RE.test(t.date ?? "")) problems.push(`${at}.date must be YYYY-MM-DD`);
    const s = stand[t.provider];
    const n = s.tips + 1;
    const cost = tipCost(n);
    if (t.n !== undefined && t.n !== n) problems.push(`${at}.n should be ${n}, not ${t.n}`);
    if (t.cost !== undefined && t.cost !== cost) problems.push(`${at}.cost should be ${cost}, not ${t.cost}`);
    s.tips = n;
    s.spent += cost;
    if (s.spent > s.wins) {
      problems.push(`${at}: ${LABEL[t.provider]} cannot afford tip #${n} (${cost} points, ${s.wins} wins banked)`);
    }
  }

  for (const p of PROVIDERS) {
    stand[p].balance = stand[p].wins - stand[p].spent;
    stand[p].nextTip = stand[p].tips + 1;
    stand[p].nextTipCost = tipCost(stand[p].nextTip);
  }

  if (problems.length) {
    console.error("ledger.json is invalid:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  return { rounds, tips, stand };
}

function ranked(stand) {
  return [...PROVIDERS].sort(
    (a, b) => stand[b].wins - stand[a].wins || stand[b].balance - stand[a].balance || a.localeCompare(b),
  );
}

/** A markdown table cell: pipes escaped, newlines flattened. */
const cell = (v) => String(v ?? "").replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|");

function render(data) {
  const { rounds, tips, stand } = derive(data);
  const out = [];
  out.push("# Ledger");
  out.push("");
  out.push(
    "Wins and tips for the game-off. A win is one glow point; the first tip costs 3 points and each further one costs one more, so a provider's Nth tip costs N+2 ([RULES.md](RULES.md#wins-are-currency)).",
  );
  out.push("");
  out.push(
    "Generated from `ledger.json` by `npm run ledger` - edit the JSON, never this file. Rounds are appended by `scripts/bank-round.sh` as part of the merge, or by `scripts/skip-round.sh` when a round goes unwon, so the standings and the tags cannot drift apart.",
  );
  out.push("");
  out.push("## Standings");
  out.push("");
  out.push("| Provider | Wins | Tips bought | Points spent | Balance | Next tip costs |");
  out.push("|----------|-----:|------------:|-------------:|--------:|---------------:|");
  for (const p of ranked(stand)) {
    const s = stand[p];
    out.push(`| ${LABEL[p]} | ${s.wins} | ${s.tips} | ${s.spent} | ${s.balance} | ${s.nextTipCost} |`);
  }
  out.push("");
  out.push("## Rounds");
  out.push("");
  if (!rounds.length) {
    out.push("No round has been judged yet.");
  } else {
    out.push("| Round | Date | Winner | Verdict | Merged | Video |");
    out.push("|------:|------|--------|---------|--------|-------|");
    for (const r of rounds) {
      const winner = r.winner ? LABEL[r.winner] : "no round";
      const merged = r.commit ? `\`${r.commit.slice(0, 7)}\` \`round-${r.round}-winner\`` : "-";
      const video = r.video ? `[judging](${r.video})` : "-";
      out.push(`| ${r.round} | ${r.date} | ${winner} | ${cell(r.verdict)} | ${merged} | ${video} |`);
    }
  }

  const judged = rounds.filter((r) => r.builds);
  if (judged.length) {
    out.push("");
    out.push("## Verdicts");
    out.push("");
    out.push(
      "What the owner wrote down while playing each build: the first two minutes, where the play stopped, the one thing to keep and the one thing to remove. Every build's verdict is public, so a round you lost still tells you what won and why.",
    );
    for (const r of [...judged].reverse()) {
      out.push("");
      out.push(`### Round ${r.round} - ${r.winner ? LABEL[r.winner] : "no winner"} (${r.date})`);
      out.push("");
      out.push(`${r.verdict}`);
      if (r.video) {
        out.push("");
        out.push(`[Judging session](${r.video})`);
      }
      out.push("");
      out.push(`| Build | ${VERDICT_FIELDS.map((f) => FIELD_LABEL[f]).join(" | ")} |`);
      out.push(`|-------|${VERDICT_FIELDS.map(() => "-------").join("|")}|`);
      for (const p of PROVIDERS) {
        const b = r.builds[p];
        const mark = p === r.winner ? ` **(won)**` : "";
        out.push(`| ${LABEL[p]}${mark} | ${VERDICT_FIELDS.map((f) => cell(b[f])).join(" | ")} |`);
      }
    }
  }
  out.push("");
  out.push("## Tips bought");
  out.push("");
  if (!tips.length) {
    out.push("No tip has been bought yet.");
  } else {
    out.push("| Date | Provider | Tip | Cost | What it was about |");
    out.push("|------|----------|----:|-----:|-------------------|");
    for (const t of tips) {
      out.push(
        `| ${t.date} | ${LABEL[t.provider]} | #${t.n} | ${t.cost} | ${(t.note ?? "").replace(/\|/g, "\\|")} |`,
      );
    }
    out.push("");
    out.push("The tip itself is answered in the buyer's own workspace, so only the purchase is public.");
  }
  out.push("");
  writeFileSync(DOC, `${out.join("\n")}`);
  return stand;
}

function status(data) {
  const { stand } = derive(data);
  for (const p of ranked(stand)) {
    const s = stand[p];
    console.log(
      `${LABEL[p].padEnd(7)} wins ${s.wins}  tips ${s.tips}  balance ${s.balance}  next tip #${s.nextTip} costs ${s.nextTipCost}`,
    );
  }
}

function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) die(`unexpected argument "${argv[i]}"`);
    const key = argv[i].slice(2);
    const val = argv[i + 1];
    if (val === undefined || val.startsWith("--")) die(`--${key} needs a value`);
    out[key] = val;
    i += 1;
  }
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);

function recordRound(data, argv) {
  const f = flags(argv);
  const round = Number(f.round);
  if (!Number.isInteger(round) || round < 1) die("--round must be a positive integer");
  const winner = f.winner === "none" ? null : f.winner;
  if (winner !== null && !PROVIDERS.includes(winner)) die(`--winner must be ${PROVIDERS.join("|")}|none`);
  const file = f["verdict-file"] ? readVerdictFile(f["verdict-file"]) : null;
  const verdict = (f.verdict ?? file?.verdict ?? "").trim();
  if (!verdict) die("--verdict is required - one line on why this build won");
  if (winner && !f.commit) die("--commit is required for a round with a winner");
  if (data.rounds.some((r) => r.round === round)) die(`round ${round} is already recorded`);

  data.rounds.push({
    round,
    date: f.date ?? today(),
    winner,
    verdict,
    ...(winner ? { commit: f.commit } : {}),
    ...(file?.builds ? { builds: file.builds } : {}),
    ...(f.video ?? file?.video ? { video: f.video ?? file.video } : {}),
  });
  const stand = render(data);
  save(data);
  if (winner) {
    console.log(
      `recorded round ${round}: ${LABEL[winner]} wins (balance ${stand[winner].balance}, next tip costs ${stand[winner].nextTipCost})`,
    );
  } else {
    console.log(`recorded round ${round}: no winner`);
  }
}

function buyTip(data, argv) {
  const f = flags(argv);
  if (!PROVIDERS.includes(f.provider)) die(`--provider must be ${PROVIDERS.join("|")}`);
  const before = derive(data).stand[f.provider];
  if (before.balance < before.nextTipCost) {
    die(
      `${LABEL[f.provider]} has ${before.balance} point(s) and tip #${before.nextTip} costs ${before.nextTipCost}`,
    );
  }
  data.tips.push({
    date: f.date ?? today(),
    provider: f.provider,
    n: before.nextTip,
    cost: before.nextTipCost,
    ...(f.note ? { note: f.note } : {}),
  });
  const stand = render(data);
  save(data);
  console.log(
    `${LABEL[f.provider]} bought tip #${before.nextTip} for ${before.nextTipCost} point(s); balance ${stand[f.provider].balance}, next tip costs ${stand[f.provider].nextTipCost}`,
  );
}

const [cmd = "check", ...rest] = process.argv.slice(2);
const data = load();
switch (cmd) {
  case "check":
    derive(data);
    console.log("ledger ok");
    break;
  case "status":
    status(data);
    break;
  case "render":
    render(data);
    console.log(`wrote ${DOC}`);
    break;
  case "record-round":
    recordRound(data, rest);
    break;
  case "verdict-check": {
    const f = flags(rest);
    if (!f.file) die("--file is required");
    const v = readVerdictFile(f.file);
    // --print <field> is how the shell scripts read the file back without
    // parsing JSON themselves, so the file is validated exactly once.
    if (f.print) {
      if (!["verdict", "winner", "video"].includes(f.print)) die(`--print must be verdict, winner or video`);
      const val = v[f.print];
      if (val !== undefined && val !== null) console.log(val);
      break;
    }
    console.log(`verdict file ok: ${v.verdict}${v.video ? ` (video ${v.video})` : ""}`);
    break;
  }
  case "tip":
    buyTip(data, rest);
    break;
  default:
    die(`unknown command "${cmd}" (check | status | render | record-round | verdict-check | tip)`);
}
