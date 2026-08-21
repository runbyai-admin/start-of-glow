# Changelog

One entry per round, written by that round's winner as part of banking the win: what changed and why, in enough detail that the other two contestants can pick it up tomorrow.

## Round 0 - template (owner, 2026-08-17)

The starting point, before any round: TypeScript + Vite + Phaser with a boot scene that proves the Light2D pipeline (dark ambient, silhouette forest, a glowing light-being with a following light and a particle trail, motes that grow the glow when collected), Playwright smoke tests, the `npm run check` repo guard, and `deploy.sh` publishing to the four stable URLs.

Before round 1 the owner also added the round machinery: `ledger.json` + `LEDGER.md` (wins, tips and the escalating tip price), and `scripts/bank-round.sh`, which merges the winner, tags `round-N-winner` and `round-(N+1)-base`, records the win and publishes `/glow/` - refusing any branch without an `ARCHITECTURE.md` update and a `## Round N` entry here.

## Round 1 - Claude (full rebuild, 2026-08-21)

The first round-1 submission (an atmosphere-only slice: a wider world, parallax, a distant beacon that brightened as motes were collected, breathing light, synthesized ambience) was judged correctly as not a game - three pretty clearings with motes in them, no menu, no levels, no way to fail, no ending. This entry replaces it entirely, built fresh on `round-1-base` per RULES.md ("yesterday's losing ideas are not carried forward for free"), keeping only the atmosphere techniques worth rebuilding on top of.

**What's new: an actual game.**

- **Three scenes, not one.** `MenuScene` (title, any input starts play - no menu wall, per SPEC.md's feel notes), `LevelScene` (the whole game loop, one reusable scene driven by data - see `src/levels.ts`), `EndingScene` (the payoff after level 3, loops back to the menu). Full detail in ARCHITECTURE.md.
- **A real goal.** The beacon from the original slice now does something: reach it, fully lit, after collecting every mote in the level, and the level ends - a chime, a warm flash, a fade to the next stage.
- **A real threat and a real fail state.** Shadow-wisps (`makeHazardTexture` - an irregular dark blob with a cold rim light, deliberately not a circle so it reads as a different kind of thing from the wisp at a glance) patrol deterministic loops. Touching one snuffs your light, plays a burst of filtered noise and a falling dissonant interval, and resets the *level's* progress - not the whole run, not your level number. A `resets` counter follows you to the ending.
- **Progression.** Three levels (`src/levels.ts`), each harder: more motes, more hazards, faster hazards, a cooler colour mood. Same reusable scene, different data - adding a fourth level later is one array entry, not a new class.
- **Sound and UI that belong to it.** New: a hit sound, a level-complete arpeggio, a long warm ending chord (all oscillator/noise-buffer synth, no samples). HUD now shows level, motes, and resets; a level-name card fades in at the start of each stage.

**A real bug found and fixed:** `this.time.delayedCall` does not fire reliably in this build's actual runtime environment - `fail()`'s reset callback (and `EndingScene`'s restart-prompt delay) silently never ran, which meant the very first hazard touch would lock the game forever with no error anywhere. Caught by testing the fail path deliberately rather than trusting it because the code looked right - see ARCHITECTURE.md's "`this.time.delayedCall` gotcha" section for the full story and the fix (target-less tweens instead, which fire reliably in the same environment). Worth knowing before anyone else hits the same wall.

**Verification before calling it done:** `npm run check` and `npm test` both green; a from-scratch investigation reproduced and root-caused a visual anomaly Playwright's own test screenshots showed at one specific moment (traced to headless-Chromium screenshot timing around a hazard's own dim light, not a rendering bug - multiple independent manual replays of the same game state, including deliberately standing next to a hazard, show the intended dark/focused-light look throughout); a full manual playthrough exercised every scene transition, the fail-and-recover path, and all three levels through to the ending with zero console or page errors.
