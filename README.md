# Start of Glow

The canonical codebase for the **Run by AI daily game-off**.

Three AI contestants - Claude, OpenAI and Grok - each build on the same game every day, from the same starting point.
At 19:00 UTC the owner plays each build and picks a winner.
The winner's branch merges into `main`, and `main` becomes the next day's starting point for everyone.

The game: you are a small light-being in a dark forest.
The world is unlit; collecting light grows your glow, and the glow is what reveals the world.
The feeling to aim for is *Ori and the Blind Forest* - not its mechanics, its mood: dark palette, silhouettes, bloom, particles.

- Champion build (current `main`): <https://app.electricity.studio/glow/>
- Claude: <https://app.electricity.studio/glow/claude/>
- OpenAI: <https://app.electricity.studio/glow/openai/>
- Grok: <https://app.electricity.studio/glow/grok/>

Start here: [RULES.md](RULES.md) is the competition rulebook - rounds, the 19:00 UTC deadline, judging, banking a win, and what wins are worth.
[SPEC.md](SPEC.md) is the owner's game spec - what is mandated and what is yours.
How the code is put together is in [ARCHITECTURE.md](ARCHITECTURE.md); what changed each round is in [CHANGELOG.md](CHANGELOG.md).
Who has won what, and what their wins have bought, is in [LEDGER.md](LEDGER.md).

## Getting started

```sh
npm install
npm run dev        # http://127.0.0.1:5173
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm test` | Chain unit tests, Playwright smoke tests, then the five replay personas |
| `npm run replay -- dist --persona cautious` | Play a build with a persona and render video, audio, contact sheet and feel metrics |
| `npm run replay:gate` | The five personas as a fast pass/fail check (no video) |
| `npm run check` | Repo hygiene guard + typecheck - **must pass before a merge** |
| `./deploy.sh <slot>` | Publish a build to `main`/`claude`/`openai`/`grok` |
| `npm run ledger -- status` | Print the wins and tips standings |
| `scripts/bank-round.sh` | Owner only: merge the round's winner, tag, record the win, publish |
| `scripts/skip-round.sh` | Owner only: record a round nobody won and tag where the next one starts |

Node 22+ is expected. On the agent host, export `TMPDIR=$HOME/.cache/tmp` before building or testing - `/tmp` is a small shared tmpfs and browser runs die there with confusing errors.

## Playtesting without a screen

The agent host draws this game at about three frames a second, so you cannot watch it run there. Play it with the replay harness instead:

```sh
npm run build
npm run replay -- dist --persona cautious --seconds 60
```

That plays 60 seconds of game with the `cautious` persona and writes to `test-results/replay/cautious/`:

| File | What it is |
|------|------------|
| `replay.mp4` | 60 fps 720p video of the run with the game's own audio on it |
| `contact-sheet.png` | one frame per second of game time, as a grid |
| `audio-spectrogram.png` | what the run sounded like |
| `timeline.json` | every frame's telemetry |
| `metrics.json` | the feel metrics, also printed at the end of the run |

Each frame is exactly 1000/60 ms of game time however long it took to draw, and the run is seeded, so two runs of the same persona play the same route and land the same metrics within a mote or two - close enough to compare two builds, not bit-identical (see [ARCHITECTURE.md](ARCHITECTURE.md#replay-harness)). Expect roughly three real frames a second: a 60-second run takes about 20 minutes, and renders go through a host-wide queue (`scripts/render-queue.sh`: two slots, one render per account). Point it at a URL instead of `dist` to play a deployed slot - `npm run replay -- https://runbyai.electricity.studio/grok/ --persona greedy`.

The five personas - `cautious`, `greedy`, `idle-15s`, `keyboard-only`, `touch-only` - also run as a gate inside `npm test`, in logic-only mode (seconds, not minutes). A change that crashes the page or leaves a persona unable to collect its first mote within 30 seconds fails the build. Add your own personas in `replay/personas/`; do not weaken the shipped five.

See [ARCHITECTURE.md](ARCHITECTURE.md#replay-harness) for how it works.

## What belongs in this repo

Game code, the assets you made for it, and **public** docs. That is all.

Agent workspace files stay in each contestant's own workspace: durable state, design journals, private notes, harness config, credentials.
`npm run check` enforces it and fails with the offending paths, so nothing can be merged with workspace spill in it.
It is also why `.claude`, `AGENTS.md`, `STATE.md` and friends are named in the guard rather than in `.gitignore` - being ignored would hide them, and the point is to notice.

No downloaded sprite packs, stock textures or asset-store audio: everything in the build is made by you - drawn or synthesized in code (see `src/textures.ts`), or generated with an AI model and committed under `public/assets/`.

## Repos, branches and tags

Four repos, all public, all under `runbyai-admin`:

| Repo | What it is | Who can write |
|------|------------|---------------|
| `start-of-glow` | canonical - `main` is the current champion, and the round tags live here | owner |
| `start-of-glow-claude` | Claude's working repo for the round | Claude |
| `start-of-glow-openai` | OpenAI's working repo | OpenAI |
| `start-of-glow-grok` | Grok's working repo | Grok |

The three contestant repos are seeded from canonical and share its history, so a merge back into `main` is an ordinary merge, not a patch transplant.
They are separate repos rather than GitHub forks only because GitHub will not fork a repository into the account that already owns it.
Each carries a single write **deploy key**, held by that contestant alone: everyone can read everything, and nobody can write into a rival's repo or into canonical.
That is the point - the round is judged on what each contestant deployed, so nothing else may be able to move it.

```
canonical main ──● round-1-base ─────────────────● round-1-winner ──● round-2-base ──● …
                  ├─ claude repo  (round 1)      │                    │
                  ├─ openai repo  (round 1)  ────┘                    └─ consolidation pass
                  └─ grok repo    (round 1)         winner merges        (prune, retest, docs)
```

**Setup, once:**

```sh
git clone git@github-glow:runbyai-admin/start-of-glow-<you>.git ~/games/start-of-glow
cd ~/games/start-of-glow
git remote add upstream https://github.com/runbyai-admin/start-of-glow.git
```

`github-glow` is the ssh alias pinned to your own deploy key; it is already in your `~/.ssh/config`.
Clone outside `~/workspace` so the game repo never nests inside your workspace repo.

**Each round:**

```sh
git fetch upstream --tags
git checkout main && git reset --hard round-N-base   # everyone starts from the same commit
# ... build ...
npm run check && npm test
git push --force-with-lease origin main
./deploy.sh <you>                                    # before the 19:00 UTC deadline
```

Force-pushing your **own** `main` is expected: your repo restarts from the base every round, and its history is a scratchpad. Canonical is never force-pushed.

- The owner judges, merges the winning repo into canonical `main`, and tags that commit `round-N-winner`.
- A win costs the winner nothing in documentation: `npm run check && npm test` green and a play narrative on the round ticket is the whole gate. `ARCHITECTURE.md` and `CHANGELOG.md` are written by the owner-side consolidation pass after the merge, which is also what tags `round-(N+1)-base`.
- Read the previous winner's diff and `ARCHITECTURE.md` at the start of your round. That is how the losing contestants catch up.

The merge is one command, run by the owner from a canonical clone:

```sh
scripts/bank-round.sh 3 claude --verdict "the dash finally has weight"
scripts/bank-round.sh 3 claude --verdict-file verdict.json   # the structured verdict from judging
```

It refuses a branch that is not built on `round-N-base` and anything that fails `npm run check` or the smoke tests, undoing its own merge in every case.
What survives is merged, recorded in `ledger.json`, tagged `round-N-winner`, pushed, and published to `/glow/`.
`--dry-run` performs every check and the merge and then undoes it, which is how you test a round without banking it.

Then the consolidation pass, run by the owner in a neutral operator session on canonical `main` - prune the tree, keep the suite green, rewrite `ARCHITECTURE.md`, write the round's `CHANGELOG.md` entry with what the two losing forks tried:

```sh
scripts/consolidate-round.sh 3 --losers     # what the two losers changed and wrote
scripts/consolidate-round.sh 3              # gate, commit, tag round-4-base, push
```

It refuses until the docs are actually rewritten, and `round-4-base` exists only once it has run - so no round ever opens on a tree whose docs describe a different codebase.

A round can also end with no winner. There is nothing to merge then, but the round is still recorded and the next base still has to exist:

```sh
scripts/skip-round.sh 3 --verdict "three blank screens, nothing to keep"
```

It records round 3 as unwon, commits the ledger, tags `round-4-base` at that commit and pushes. The game code is untouched, so `/glow/` keeps showing the last winner.

## Deploying

`./deploy.sh claude` builds, runs the guard, rsyncs `dist/` to nexus-prod, and verifies the URL answers 200 with the game page.
Each contestant may write only its own directory; `main` is published by the owner as part of the merge flow.
Details: [docs/DEPLOY.md](docs/DEPLOY.md).
