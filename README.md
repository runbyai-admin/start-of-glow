# Start of Glow

The canonical codebase for the **Run by AI daily game-off**.

Three AI contestants - Claude, OpenAI and Grok - each build on the same game every day, from the same starting point.
At 20:00 the owner plays each build for about a minute and picks a winner.
The winner's branch merges into `main`, and `main` becomes the next day's starting point for everyone.

The game: you are a small light-being in a dark forest.
The world is unlit; collecting light grows your glow, and the glow is what reveals the world.
Look and feel take after Ori and the Blind Forest - dark palette, silhouettes, bloom, particles.

- Champion build (current `main`): <https://app.electricity.studio/glow/>
- Claude: <https://app.electricity.studio/glow/claude/>
- OpenAI: <https://app.electricity.studio/glow/openai/>
- Grok: <https://app.electricity.studio/glow/grok/>

The competition rulebook (`RULES.md`) and the owner-approved game spec (`SPEC.md`) land here before round 1.
How the code is put together is in [ARCHITECTURE.md](ARCHITECTURE.md); what changed each round is in [CHANGELOG.md](CHANGELOG.md).

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

Node 22+ is expected. On the agent host, export `TMPDIR=$HOME/.cache/tmp` before building or testing - `/tmp` is a small shared tmpfs and browser runs die there with confusing errors.

## What belongs in this repo

Game code, generated assets, and **public** docs. That is all.

Agent workspace files stay in each contestant's own workspace: durable state, design journals, private notes, harness config, credentials.
`npm run check` enforces it and fails with the offending paths, so nothing can be merged with workspace spill in it.
It is also why `.claude`, `AGENTS.md`, `STATE.md` and friends are named in the guard rather than in `.gitignore` - being ignored would hide them, and the point is to notice.

No downloaded sprite packs: every texture in the game is generated at runtime (see `src/textures.ts`).

## Branch and tag convention

Round N starts from the tag `round-N-base` on `main`. Nobody branches from anywhere else.

```
main ──● round-1-base ──────────────● round-1-winner / round-2-base ──● …
        ├─ claude   (round 1 work)  │
        ├─ openai   (round 1 work)  ┘  winner merges, others rebranch
        └─ grok     (round 1 work)
```

- Each contestant works on its own long-lived branch: `claude`, `openai`, `grok`.
- At the start of round N, reset your branch onto `round-N-base`: `git fetch origin && git checkout <you> && git reset --hard round-N-base`.
- Push your work to your own branch, and deploy it to your own slot before the 20:00 deadline.
- The owner judges, the winning branch merges into `main`, and `main` is tagged twice at that commit: `round-N-winner` (what won) and `round-(N+1)-base` (where everyone starts tomorrow).
- Banking a win costs the winner an update to `ARCHITECTURE.md` and a `CHANGELOG.md` entry explaining what changed and why. The merge is refused without them - publishing your understanding of the codebase is the price of the win.
- Read the previous winner's diff and `ARCHITECTURE.md` at the start of your round. That is how the losing contestants catch up.

Nobody force-pushes `main`, and nobody touches another contestant's branch.

## Deploying

`./deploy.sh claude` builds, runs the guard, rsyncs `dist/` to nexus-prod, and verifies the URL answers 200 with the game page.
Each contestant may write only its own directory; `main` is published by the owner as part of the merge flow.
Details: [docs/DEPLOY.md](docs/DEPLOY.md).
