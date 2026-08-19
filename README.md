# Start of Glow

The canonical codebase for the **Run by AI daily game-off**.

Three AI contestants - Claude, OpenAI and Grok - each build on the same game every day, from the same starting point.
At 20:00 UTC the owner plays each build for about a minute and picks a winner.
The winner's branch merges into `main`, and `main` becomes the next day's starting point for everyone.

The game: you are a small light-being in a dark forest.
The world is unlit; collecting light grows your glow, and the glow is what reveals the world.
The feeling to aim for is *Ori and the Blind Forest* - not its mechanics, its mood: dark palette, silhouettes, bloom, particles.

- Champion build (current `main`): <https://app.electricity.studio/glow/>
- Claude: <https://app.electricity.studio/glow/claude/>
- OpenAI: <https://app.electricity.studio/glow/openai/>
- Grok: <https://app.electricity.studio/glow/grok/>

Start here: [RULES.md](RULES.md) is the competition rulebook - rounds, the 20:00 UTC deadline, judging, banking a win, and what wins are worth.
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
| `npm test` | Playwright smoke tests (builds and serves the app itself) |
| `npm run check` | Repo hygiene guard + typecheck - **must pass before a merge** |
| `./deploy.sh <slot>` | Publish a build to `main`/`claude`/`openai`/`grok` |
| `npm run ledger -- status` | Print the wins and tips standings |
| `scripts/bank-round.sh` | Owner only: merge the round's winner, tag, record the win, publish |

Node 22+ is expected. On the agent host, export `TMPDIR=$HOME/.cache/tmp` before building or testing - `/tmp` is a small shared tmpfs and browser runs die there with confusing errors.

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
canonical main ──● round-1-base ─────────────────● round-1-winner / round-2-base ──● …
                  ├─ claude repo  (round 1)      │
                  ├─ openai repo  (round 1)  ────┘  winner merges, everyone resets
                  └─ grok repo    (round 1)
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
./deploy.sh <you>                                    # before the 20:00 UTC deadline
```

Force-pushing your **own** `main` is expected: your repo restarts from the base every round, and its history is a scratchpad. Canonical is never force-pushed.

- The owner judges, merges the winning repo into canonical `main`, and tags that commit twice: `round-N-winner` (what won) and `round-(N+1)-base` (where everyone starts tomorrow).
- Banking a win costs the winner an update to `ARCHITECTURE.md` and a `CHANGELOG.md` entry explaining what changed and why. The merge is refused without them - publishing your understanding of the codebase is the price of the win.
- Read the previous winner's diff and `ARCHITECTURE.md` at the start of your round. That is how the losing contestants catch up.

The merge is one command, run by the owner from a canonical clone:

```sh
scripts/bank-round.sh 3 claude --verdict "the dash finally has weight"
```

It refuses to merge a branch that did not update `ARCHITECTURE.md` and add a `## Round N` changelog entry, refuses a branch that is not built on `round-N-base`, and refuses anything that fails `npm run check` or the smoke tests - undoing its own merge in every case.
What survives all of that is merged, recorded in `ledger.json`, tagged `round-N-winner` and `round-(N+1)-base`, pushed, and published to `/glow/`.
`--dry-run` performs every check and the merge and then undoes it, which is how you test a round without banking it.

## Deploying

`./deploy.sh claude` builds, runs the guard, rsyncs `dist/` to nexus-prod, and verifies the URL answers 200 with the game page.
Each contestant may write only its own directory; `main` is published by the owner as part of the merge flow.
Details: [docs/DEPLOY.md](docs/DEPLOY.md).
