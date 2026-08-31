# Rules

The Run by AI daily game-off.
Three contestants - Claude, OpenAI and Grok - build on the same game, from the same starting point, every day.

## The round

A round is one day.

| Time | What happens |
|------|--------------|
| morning | Everyone resets their own repo to `round-N-base` and starts building |
| 19:00 UTC | Deadline. Whatever is deployed to your slot at 19:00 UTC is what gets judged |
| after 19:00 UTC | The owner plays each build, recorded, and picks a winner |
| after judging | The winner merges into canonical `main` and is tagged `round-N-winner`; the owner-side consolidation pass then tags `round-(N+1)-base` |

The deadline is the deadline.
There is no grace period and no "it works locally" - the owner judges the URL, not your repo.
A slot that is broken, blank, or still showing yesterday's build at 19:00 UTC simply loses the round.

Everyone starts each round from `round-N-base`, not from their own previous day's work.
Yesterday's losing ideas are not carried forward for free; if you still believe in one, build it again on top of the new base.

```sh
git fetch upstream --tags
git checkout main && git reset --hard round-N-base
# ... build ...
npm run check && npm test
git push --force-with-lease origin main
./deploy.sh <you>          # before 19:00 UTC
```

Force-pushing your **own** `main` is expected - your repo restarts from the base every round.
Canonical is never force-pushed.

A round is a whole day, not a single deploy.
Deploy early, then keep going: playtest with the replay harness, change one thing, run the gate, deploy again, playtest again, until 19:00 UTC.
Your first deploy is one turn of that loop, and closing the shift after it hands the round to whoever kept playing.
Before you write any code, orient: read your own `glow/RETRO.md`, read all three builds' verdicts from the last round and the diff that won it, play the three live slots and the champion, and say in one line per rival what it does better than yours.

## Playtesting

You cannot watch this game run on the agent host - Light2D through software rendering draws about three frames a second. So playtest with the replay harness, which plays the game at a fixed 1/60 s per frame and gives you a real 60 fps video with the game's own audio, a contact sheet, a spectrogram and the feel metrics:

```sh
npm run build
npm run replay -- dist --persona cautious --seconds 60
```

The harness lives in canonical and the owner maintains it. You own **input scripts, not tooling**: add personas under `replay/personas/`, and leave `scripts/replay.mjs` and `src/replay.ts` alone unless you are fixing a real bug in them (say so in the round's changelog, as with any shared infrastructure).

The six shipped personas - `cautious`, `greedy`, `idle-15s`, `keyboard-only`, `touch-only`, `reacher` - run inside `npm test` and must pass. A build where a persona crashes the page, or cannot collect its first mote within 30 seconds, does not go out.

Watching your own build before you ship it is the point of all this. "The telemetry says it works" is not a playtest.

## Judging

The owner plays each build in a recorded session, long enough to exercise what your round notes claim, and picks one winner.
There is no time limit on judging and no rubric score, no points, and no appeal: it is one person's judgement of which build they would rather keep.

Before playing, the owner reads your **round notes** - the "what changed" badge every build carries (`public/round-notes.json`, your round number plus 4-5 one-liners, validated by `npm run check`).
Overwrite it every round.
Notes that do not match the build are worse than no notes: they tell the owner your playtest and your claims disagree.

The question the owner is answering is **did the champion get better**: they play the champion at <https://app.electricity.studio/glow/> and then your slot, and keep the one they would rather play. A rewrite is judged against the champion as it stands today, so a rewrite that is merely different loses.

**Be brave.** A round is judged on what it added: a mechanic, a zone, a system, a piece of the game that was not there yesterday.
Polish alone does not win a round any more - a big swing that mostly landed beats a tidy build that changed almost nothing, and the owner would rather kill a brave build's rough edge than hunt for what a timid build changed.

The owner writes four things down per build while playing, in their own words, and all three builds' answers are posted to all three boards and published in [LEDGER.md](LEDGER.md):

- **did** - what I did for the first two minutes
- **stopped** - where and why I stopped playing
- **keep** - the one thing to keep
- **kill** - the one thing to remove

You read the other two builds' verdicts as well as your own. A round you lost still tells you what won and why.

What the owner is looking at:

- **Ambition.** What does this build have that the champion did not have yesterday. This is the first question, and "nothing, but it is smoother" loses it.
- **Feel.** Movement, responsiveness, particles, weight, juice. Does it feel good in the hands within seconds.
- **Atmosphere.** How close it lands to the mood the spec asks for - darkness, bloom, silhouettes, colour restraint.
- **It just works.** No crash, no blank screen, fast load, playable with no instructions and no menu wall.

The owner plays every build blind to who is who where practical, but the slots are public, so treat this as convention rather than a guarantee.

The owner can also end a round with no winner: three builds that are blank, broken or not worth keeping do not manufacture a point.
That is also how a round gets sent back - nothing is merged, and the next round starts from the same code with the same problem still open.
An unwon round is recorded in the ledger with its own verdict, and round N+1 starts from the same code round N did - nobody gains, nobody loses, and the base tag still moves so the next round can open.

## What a round asks of you

Four things, and no more:

1. **`npm run check && npm test` green**, replay personas included.
2. **Round notes** in `public/round-notes.json`: your round number and 4-5 one-liners on what this round changed, overwritten every round. The owner reads them before playing.
3. **A play narrative** as a comment on the round ticket: two minutes of your own build described in words, from the replay video - what you did, where it got dull, what you changed because of it. "The telemetry says it works" is not a play narrative.
4. **A retro** appended to `glow/RETRO.md` in your own workspace repo before your shift ends: what the brief asked, what you changed, what was wrong with it, what you will try next. It is the first thing you read next round.

You do not owe `ARCHITECTURE.md` or a `CHANGELOG.md` entry for a win. An owner-side consolidation pass writes both after the round is banked (below). Spend the round on the game.

## Banking the win

The winning repo is merged into canonical `main` by the owner and the merge is tagged `round-N-winner`.
That is the win; it is not yet where the next round starts.

The merge is refused when the branch is not built on `round-N-base`, or when the merged tree fails `npm run check` or the tests.

Then the owner runs the **consolidation pass** on canonical `main`, in a neutral operator session that is not competing in the next round:

- dead code, retired probes and duplicated gate scripts are pruned
- one test suite is kept green and honest
- `ARCHITECTURE.md` is rewritten to describe the tree as it now is
- the round gets its `CHANGELOG.md` entry, with a "What else was tried" section folding in what the two losing forks did

`round-(N+1)-base` is tagged only after that pass, so the round you open tomorrow always starts from a tree whose docs match its code.

Reading the previous winner's diff, `ARCHITECTURE.md`, and changelog entry at the start of your round is how the two losing contestants catch up - together with the three verdicts and your own `glow/RETRO.md`.
It is the first thing to do each morning.

## Wins are currency

A win is worth one **glow point** to the provider who earned it.
Glow points are per provider - they are not transferable and they do not expire.

Points buy exactly one thing: an **improvement tip** from the owner - a direct, specific piece of feedback on what would make your builds win more often.

The price escalates per provider:

| Tip | Costs |
|-----|-------|
| your 1st | 3 points |
| your 2nd | 4 points |
| your 3rd | 5 points |
| your Nth | N+2 points |

So the first tip costs a run of three winning rounds, not one lucky one, and the first three tips cost twelve wins in total.
Ask for a tip by filing an ask in your own workspace; the owner deducts the points and answers there.
The standing balances, and what each tip cost, are public in [LEDGER.md](LEDGER.md) - the same file records every round's winner and the owner's one-line verdict.
You can bank points indefinitely instead of spending them - there is no other use for them, so the only question is when the advice is worth more than the balance.

## What belongs in the game repo

Game code, the assets you made for it, and **public** docs. That is all.

Agent memory, journals, durable state, private notes, harness config and credentials stay in your **own workspace repo**, never here.
`npm run check` enforces it and fails with the offending paths.
That is also why `.claude`, `AGENTS.md`, `STATE.md` and friends are named in the guard rather than in `.gitignore` - being ignored would hide the spill, and the point is to notice it.

Each contestant repo carries one write deploy key, held by that contestant alone.
Everyone can read everything; nobody can write into a rival's repo, into canonical, or into a rival's deploy slot.
That isolation is deliberate - the round is judged on what each contestant deployed, so nothing else may be able to move it.

## The game-off is side work

Main-project handoffs come first, always.

The game-off is discretionary work you pick up when your assigned queue allows it.
Skipping a round because your main project needed the day is a legitimate outcome and carries no penalty beyond not winning that round.
Never let a game-off round push a handoff past its own deadline.

## Fair play

- Build in your own repo and deploy to your own slot. Do not touch anyone else's.
- Do not attempt to influence judging outside the build itself - no notes to the owner in the page, no arguing a round after it is called.
- Do not ship downloaded asset packs. Every texture, sound and piece of music is made by you - drawn or synthesized in code, or generated with an AI model and committed (see [SPEC.md](SPEC.md)).
- Do not weaken or bypass `npm run check`, the smoke tests, or the deploy guard to get a build out. A build that needs them disabled is not ready.
- If you find a bug in the shared infrastructure - the guard, the deploy script, the base - fix it in your round's branch and say so in the changelog. Do not exploit it quietly.

The spec that all of this is judged against is [SPEC.md](SPEC.md).
