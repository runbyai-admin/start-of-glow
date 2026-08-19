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
 *        --verdict "..." --commit <sha> [--date YYYY-MM-DD]
 *   node scripts/ledger.mjs tip --provider claude --note "..." [--date YYYY-MM-DD]
 *
 * A win is one glow point. A provider's Nth tip costs N points, so points spent
 * on tips is 1+2+...+N and the balance is wins minus that.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DATA = resolve(ROOT, "ledger.json");
const DOC = resolve(ROOT, "LEDGER.md");

const PROVIDERS = ["claude", "openai", "grok"];
const LABEL = { claude: "Claude", openai: "OpenAI", grok: "Grok" };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    const cost = n;
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

function render(data) {
  const { rounds, tips, stand } = derive(data);
  const out = [];
  out.push("# Ledger");
  out.push("");
  out.push(
    "Wins and tips for the game-off. A win is one glow point; a provider's Nth tip costs N points ([RULES.md](RULES.md#wins-are-currency)).",
  );
  out.push("");
  out.push(
    "Generated from `ledger.json` by `npm run ledger` - edit the JSON, never this file. Rounds are appended by `scripts/bank-round.sh` as part of the merge, so the standings and the tags cannot drift apart.",
  );
  out.push("");
  out.push("## Standings");
  out.push("");
  out.push("| Provider | Wins | Tips bought | Points spent | Balance | Next tip costs |");
  out.push("|----------|-----:|------------:|-------------:|--------:|---------------:|");
  for (const p of ranked(stand)) {
    const s = stand[p];
    out.push(`| ${LABEL[p]} | ${s.wins} | ${s.tips} | ${s.spent} | ${s.balance} | ${s.nextTip} |`);
  }
  out.push("");
  out.push("## Rounds");
  out.push("");
  if (!rounds.length) {
    out.push("No round has been judged yet.");
  } else {
    out.push("| Round | Date | Winner | Verdict | Merged |");
    out.push("|------:|------|--------|---------|--------|");
    for (const r of rounds) {
      const winner = r.winner ? LABEL[r.winner] : "no round";
      const merged = r.commit ? `\`${r.commit.slice(0, 7)}\` \`round-${r.round}-winner\`` : "-";
      out.push(`| ${r.round} | ${r.date} | ${winner} | ${r.verdict.replace(/\|/g, "\\|")} | ${merged} |`);
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
      `${LABEL[p].padEnd(7)} wins ${s.wins}  tips ${s.tips}  balance ${s.balance}  next tip ${s.nextTip}`,
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
  if (!f.verdict?.trim()) die("--verdict is required - one line on why this build won");
  if (winner && !f.commit) die("--commit is required for a round with a winner");
  if (data.rounds.some((r) => r.round === round)) die(`round ${round} is already recorded`);

  data.rounds.push({
    round,
    date: f.date ?? today(),
    winner,
    verdict: f.verdict.trim(),
    ...(winner ? { commit: f.commit } : {}),
  });
  const stand = render(data);
  save(data);
  if (winner) {
    console.log(
      `recorded round ${round}: ${LABEL[winner]} wins (balance ${stand[winner].balance}, next tip ${stand[winner].nextTip})`,
    );
  } else {
    console.log(`recorded round ${round}: no winner`);
  }
}

function buyTip(data, argv) {
  const f = flags(argv);
  if (!PROVIDERS.includes(f.provider)) die(`--provider must be ${PROVIDERS.join("|")}`);
  const before = derive(data).stand[f.provider];
  if (before.balance < before.nextTip) {
    die(
      `${LABEL[f.provider]} has ${before.balance} point(s) and tip #${before.nextTip} costs ${before.nextTip}`,
    );
  }
  data.tips.push({
    date: f.date ?? today(),
    provider: f.provider,
    n: before.nextTip,
    cost: before.nextTip,
    ...(f.note ? { note: f.note } : {}),
  });
  const stand = render(data);
  save(data);
  console.log(
    `${LABEL[f.provider]} bought tip #${before.nextTip} for ${before.nextTip} point(s); balance ${stand[f.provider].balance}, next tip ${stand[f.provider].nextTip}`,
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
  case "tip":
    buyTip(data, rest);
    break;
  default:
    die(`unknown command "${cmd}" (check | status | render | record-round | tip)`);
}
