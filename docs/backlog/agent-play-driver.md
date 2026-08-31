# Agent play driver

Status: backlog spec, agreed with the owner 2026-08-31.
Direction chosen over alternatives (cheap-peeks-only, judge-proxy-first, round format changes): the contestants' core deficit is that nobody but the owner ever plays the game, and the fix is a driver that lets an agent play it interactively.

## Problem

The replay harness made the game observable, but its economics fight the iteration loop it serves.
One 60-second playtest costs about 20 real minutes of render through a two-slot host queue, so a contestant gets 10 to 15 playtests in a ten-hour round and changes several things per test.
The output is a video the agent cannot watch; it reads `metrics.json` and a contact sheet, and the six feel metrics are proxies.
Round 3's verdicts show what the proxies miss: "pull has no cooldown so there is no decision in it" is invisible in every metric, and it took the owner two minutes of actual play to find.
Personas are canned input scripts.
The agent never plays, so it never has the "I spammed the pull and got bored" experience the judging is made of.

## Shape

A stateless, deterministic play session driven one command at a time, in logic mode, with on-demand single-frame screenshots.
No daemon: the harness `bash -c` wrapper kills backgrounded local servers when the command returns, and a long-lived page per contestant is lifecycle the tooling does not need.
Determinism replaces the daemon.
The session is a growing input script on disk; every command replays it from frame 0 in logic-only mode (about 550 fps, so replaying 60 seconds of prior play costs a few seconds), applies the new actions, and reports.
Every session is therefore automatically a reproducible replay, resumable after any crash, and exportable as a persona.

## Agent-facing commands

```sh
npm run play -- dist --seed 7 --session s1 act "hold ArrowRight 2s; tap 620 400; wait 1s"
npm run play -- dist --seed 7 --session s1 peek              # PNG of the current frame
npm run play -- dist --seed 7 --session s1 peek --at 12s     # PNG of any past moment
npm run play -- dist --seed 7 --session s1 state             # current sample + aggregates
npm run play -- dist --seed 7 --session s1 export replay/personas/my-run.json
```

`act` takes a small verb DSL (hold/press/tap/drag/wait, seconds or frames) compiled to `ReplayAction` lists; agents must not hand-author frame-indexed events.
Its response is what makes the loop informative: the new state sample, plus an event digest since the last command (collects, resets, scene changes, sound starts, chain changes) and feel warnings the driver derives from the timeline (e.g. "no on-screen state change for 4s", "input produced no motion for N frames").
`peek` is the perception primitive: one software-raster draw of one frame costs well under a second, against 20 minutes for the only current path to a picture.
Sessions live under the game checkout (git-ignored), keyed by name; `--seed` is part of the session and a mismatch refuses.

## Changes required

- `src/replay.ts`: a `capture()` on the `GlowReplay` API that, in `render: "off"` mode, restores the real renderer for one draw, returns `canvas.toDataURL()`, and re-stubs it. Everything else the driver needs (`step(actions)`, the timeline, seeded determinism) already exists.
- `scripts/play.mjs`: the driver. Loads the build with `?glow-replay=<seed>&glow-replay-render=off`, replays the session script to its cursor, applies the command, writes the session file, prints the report. Reuses the page-driving code in `scripts/replay.mjs`.
- The verb DSL and its compiler, with unit tests.
- `export` writes a persona-shaped input script, so a session that found a problem becomes a regression persona in `replay/personas/`.
- Round ticket text and `ARCHITECTURE.md` contract section: playtest with the play driver in the loop, full replay video as the pre-deploy final check, not the iteration step.
- The render queue is untouched: `peek` does not queue (single frames are cheap), full `npm run replay` renders still do.

## Non-goals, noted as follow-ups

- Judge-proxy: a sub-agent that plays a build through this driver and answers the owner's four verdict fields before deploy. Cheap once the driver exists; separate ticket.
- Champion-diff: one command comparing build vs champion keyframes and metric deltas. Separate ticket.

## Owner-side rollout

The driver is owner-maintained canonical tooling like the replay harness; contestants own sessions, not the driver.
Ships through the consolidation pass onto a round base, with the round ticket text updated in `runbyai` (`ops/open-round.sh`) the same day.
