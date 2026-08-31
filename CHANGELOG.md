# Changelog

One entry per round, written by that round's winner as part of banking the win: what changed and why, in enough detail that the other two contestants can pick it up tomorrow.

## Round 4 - OpenAI (the pull has a price, 2026-08-31)

The brief was to make every press a visible choice with a felt cost in the first ten seconds, and to add no new opening mechanic.
The owner's verdict: "openai was the only one where spending reach and refilling it felt like a decision."

**A pull spends the whole glow, and only travel earns it back.** `src/reach.ts` is now the one place that knows the economy.
Pressing requires a fully kindled glow (`reach >= REACH_READY`, 390) and burns it straight to the floor (170) whether or not it caught anything.
Light comes back asymmetrically: 36 for a mote you walked through, 10 for one the pull carried in.
A press therefore cannot pay for itself - four pulled motes leave you at 210, still spent - and five motes walked through is what buys the next pull.
Round 3's version returned 32 per mote against a 170 cost, which read as a slow drain rather than a decision; this one asks a question every time the circle is full.

**The resource is a halo on the wisp, not a meter in a corner.** A 38px arc around the wisp fills with `reachReadiness()`: a partial cold blue arc while spent, a complete warm gold circle when the pull is ready, and the outer reach ring takes the same two colours.
`kindleReach()` blooms one gold ring at the moment it completes, so the state change has a sound and a shape rather than only a value.
A press made while spent is answered, not swallowed: a cold blue collapsing ring, a dead voice, and a `deniedGathers` counter for the gate.
Level 1 says it in two lines total - "press · draw the light in", then, once, after the first pull, "move through light to kindle the reach".

**The opening carries one resource.** The lumen chain now starts at level 3 (`chainActiveForLevel`), so levels 1 and 2 have no corner arc, no four-second boundary and no radiance wave.
Two timers in the first ten seconds is what made the previous opening unreadable; the final clearing is where the extra layer earns its place.

**Levels 2 and 3 are hand-authored.** The seeded generator placed motes without knowing where the patrols went, so a careful route through level 2 could pass inside a shadow's loop through no fault of the player.
All three levels now carry explicit layouts with the same contract, enforced by `tests/levels.test.ts`: the required motes form a route that clears every patrol segment by 200px, and every optional mote sits within 90px of one.
Level 3 turns the economy into terrain - three pairs of fast shadows gate the forest, the required route goes the long way around them, and six shortcut motes sit inside the gates where only a full reach can buy them.

`npm test` gained `tests/reach.test.ts` and `tests/levels.test.ts`, and `window.__glow` gained `gatherReady`, `deniedGathers`, `touchedMotes` and `gatheredMotes` - enough for a persona gate to tell a pull apart from a walk.

### What else was tried

**Claude - the price you can see before you pay it.** The same diagnosis, a different readout: the colour of the light told you whether a press was affordable, the cost was shown before it was charged, and a death returned the wisp where it fell rather than at the level's door.
It also cut level 3 for being long rather than hard.
Then it stopped: two attempts at replacing the seeded level layouts were tried and thrown away as negative results, and the slot was deliberately left on the 00:33 UTC build for the rest of the round.
The owner played it out and found nothing to keep - "it was just weird, like not that much of improvement".

**Grok - the clock on the spent radius.** A press spent 200 and started a two-second gold clock drawn on the radius you had just spent, pulled motes stopped refunding light, a dead press was audible, and the menu dive came down to 180ms so the first frame is the forest rather than a title going dark.
Eighteen deploys in the round, most of them 100-200ms presentation adjustments.
The owner watched the clock refill, played it out, and kept nothing: waiting for a cooldown is not the same decision as choosing what to spend a finite glow on.

## Round 3 - Claude (the reach, 2026-08-29)

The round's brief was mechanics and nothing else: one clear thing you do with the light, good in the hands inside ten seconds, no new menus or modes.
This entry gives the game a verb and makes every other system speak it.

**The reach.** The wisp's lit radius is also its pull radius - one number, `reach`, and the circle you can see is the rule.
Press (click, tap or Space) and every mote inside it comes to you, nearest first, four at most per press with the overflow left on the ground.
The press costs 170 off the reach whether it catches anything or not; each mote taken, pulled or walked into, returns 32; the reach is clamped to [170, 470].
A full armful returns less than the press cost, so pulling is what you spend light on to take a mote you could not safely walk to, and walking into motes is how you get bright again.
There is no HUD line for it: the trail thins, the wisp dims, and under a third of the range it gutters.

**Being noticed scales with the light, being hunted does not.** A shadow notices as far as the light carries (`alertRadius` = 0.6 x reach, capped at 290) and its own glow comes up so the state is readable across the glade, but the chase speed ramps in from a fixed floor.
Coupling the two killed the wrong player - someone who had not found the press kept a full reach and was permanently at top chase speed. The split took the cautious persona from two deaths in sixteen seconds to forty-five clean ones, with greedy still dying seven times.

**A shadow takes your light, not your work.** Death used to wipe the level's motes and restart it, which twenty seconds into a judging session is where a player puts the game down, and it punished exactly the behaviour the round wanted: going near a shadow to reach past it.
Now the motes stay, the reach drops to its floor, and the sting is finishing the level nearly blind over ground you had already lit. Loss, gain and spend all move the same number.

**Feel pass on the same verb.** The press draws a collapsing ring rather than washing the screen; death goes dark through a veil instead of flashing the screen on; the level arrival is a swell rather than a switch; the spawn scale is derived from the reach instead of a hand-set 0.5; the `shadows slowed` readout fades after a beat instead of sitting in the corner for the chain's full four seconds; and the level-1 hint that names the verb destroys itself on the first press.

Added `replay/personas/reacher.json`, which presses whenever motes are inside the circle - the persona that makes a press costing light and catching nothing visible to `npm test`.

### What else was tried

**OpenAI - the surge.** Light became a movement verb: a short aimed dash with a refill ring, a rising synth voice and displacement-led stretch.
Surging through a shadow spent the dash to slow it for 2.2 seconds; touching one without the timing still snuffed you. Collection gained magnetism and a chain-driven speed lift.
Two focused probes are worth keeping in mind for anyone building on this tree: a wall-clock dash window let a clamped game delta move the wisp only 27px on a slow host (distance now owns completion), and endpoint-only collision sampling let a low-frame-rate dash tunnel clean through a shadow (contact sweeps relative motion instead).
The owner could not tell what mechanic the build had added, and judged it as the previous champion.

**Grok - the forest as the HUD.** A thread pointing at the next mote, an open beacon that tows the player toward it like a tide, a gather lunge on click, camera breathing per gather, sparks shed from the haul while it orbits, a chain that warms the afterglow, and a snuff that no longer freezes the forest.
The mechanics read well; the presentation around them did not hold up, and the owner stopped playing on roughness rather than on the mechanic.
It shipped no changelog entry of its own.

## Round 2 - OpenAI candidate (playable menu + lumen chain, 2026-08-26)

Round 1's owner feedback was unusually specific: OpenAI was the close loser and generally stronger, but collecting light—the most repeated action—lacked weight, and its sound missed the mood. This candidate starts from Claude's canonical winner and answers that gap without discarding its three-level optional/flawless route.

**Extended-window depth pass (2026-08-27).** The first judging pass produced no winner: all three candidates felt thin and interchangeable, and their basic shells counted as part of the game. This branch therefore adds no new mechanic. It concentrates the extension on the first fifteen seconds. The former title-over-stars screen is now an authored Light2D forest threshold with layered hills, lit tree silhouettes, foreground ground, drifting firefly depth, a warm destination, and a five-mote path drawn through the clearing. The wisp has displacement-led stretch and lean, a fading afterglow, and a slightly trailing light; nearby motes anticipate contact by magnetizing, then wake the forest and threshold one step at a time. The fifth pickup blooms the way open without making it a requirement. Click/touch, Enter or Space still registers immediately, now pulling the title, wisp and threshold into one short transition. All art remains runtime-generated, and the level/lumen-chain rules are unchanged.

**The menu is already play.** Pointer movement and arrows/WASD steer the title wisp through five composed motes, previewing the same pull, ring, growing light, and harmonic response used in the world. Click/touch, Enter or Space still begins immediately; movement keys never throw the player into level 1. A clear `ENTER THE FOREST` invitation remains visible, and one quiet line responds as the player wakes the path.

**Collection now creates a tactical chain.** Consecutive pickups inside a visible four-second boundary build to five. Motes pull into the wisp instead of blinking away; rings, particles, camera response, and the fully synthesized collect voice grow in layers. The first cap releases a warm radiance wave that briefly slows only nearby, alerted shadows. Per-hazard slowdown state resolves through the same function as alert speed, so patrol legs cannot cancel it. The capped chain cannot reward twice; expiry and damage reset it.

**Input parity is explicit.** Level play now supports WASD alongside arrows, pointer, and touch. The mechanic adds no control and grants no invulnerability or permanent hazard removal.

Public architecture and the browser test hook now describe the menu and chain state. Verification covers typecheck, workspace/ledger guards, production build, deterministic chain behavior, and the affected real-input menu/opening path. The inherited full-play gate repeatedly proved the 10/14 optional route and open beacon, but its generic recovery/flee driver remained unstable under multi-second software-renderer frames; that is reported as partial gate evidence, not a complete path or a game defect.

**Test isolation and pacing fixes.** The inherited Playwright config reused any process on port 4173. On the shared host that silently drove another contestant's already-running preview instead of this candidate. This branch uses strict port 4183 for both preview and Playwright; the other process was left untouched. The smoke test also stops after the deterministic opening arc instead of spending minutes on a nondeterministic broad sweep across hazard lanes; fast chain tests carry the timing/reset/reward truth.

The full-play driver uses the same isolated port and a 240-second per-leg wall budget. This changes no game clock or input: it only lets real mouse movement receive enough rendered frames when the shared host falls below one frame per second.

Its cautious route now uses the authored safe margins: around the fixed vertical sentry via the visibly open top edge, down to the far-side mote, then under the beacon circuit along y=680 before rising to the low-road mote. The old timed paths repeatedly failed at the same crossings under multi-second frames despite an earlier run reaching the beacon; the route change removes renderer-dependent timing from the harness without changing the game or bypassing input.

The full-path gate does not require a four-second chain cap under that degraded renderer: when frames themselves take multiple seconds, such an assertion measures the host rather than the mechanic. The deterministic chain tests prove cap/expiry/reset/one-shot semantics, and the real-bundle smoke path proves collected motes enter the live chain.

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

**A second infrastructure bug, same as the first:** `deploy.sh` 403'd on first deploy of this round, for the exact reason fixed in the previous round-1 submission - `rsync -a` preserves the deploying account's own restrictive default-ACL permissions onto the deploy target. That fix lived only in this fork's history, and since round 1 was never banked into canonical, resetting to `round-1-base` (per RULES.md - every round starts from the shared base, not your own previous work) silently undid it. Reapplied the same `--chmod=Do+rx,Fo+r` fix, disclosed here again for the same reason RULES.md asks for it the first time. Worth knowing: any fork-local infra fix from an unbanked round will need reapplying every time you reset to that round's base, until a round actually banks and folds it into canonical.

## Round 1 - Claude (continued: plan Phase 1 - a real choice, a composed opening, a storm with weather, 2026-08-23 late)

The 1-year plan (docs/game-1-year-plan.md) is now under a standing execute loop, and this is its Phase 1, built the same evening the loop started. Three changes, all aimed at the same gap the plan named: the game had a goal and a threat, but no *decision*.

**Collection is optional now - that's the decision.** Each level's beacon opens at `requiredMotes` (10/14, 13/18, 16/22), not at full collection. The moment it opens is marked so the choice is legible in one play: a soft two-note call, the beacon's pulse starting, one quiet serif line ("the beacon is lit"), and the HUD flipping from `beacon at 10` to `beacon open`. The remaining motes are the player's own call - and in level 1 they are exactly the motes inside guarded pockets, so the call is "is that one worth the sentry" rather than a bookkeeping preference. Finding *every* mote flips the flawless variant (a warmer, brighter beacon, a deeper pulse, a fuller six-note completion run), a per-run `flawless` count rides to the ending alongside `resets`, and the ending gives it one line when it is earned. A run that skips motes is not scolded - the skip is the design working, not a failure to play properly.

**Level 1 is hand-authored.** The judged first minute looks at level 1, so level 1 is now a composed space, not a seeded roll (`layout` in `src/levels.ts`; seeded placement still drives levels 2-3): an opening arc of five safe motes that teaches collection in the first ten seconds, one vertical sentry patrolling the midfield gap so the player *watches* the threat cross their path before they have to cross it, a calm mid-glade, then a second hazard circling the beacon approach with two greedy motes inside its circuit and a safe low road under it. Nine motes are safe, two need one timed lane-crossing, three sit in the pockets - ten open the beacon, so a careful player clears without ever braving a pocket, and a flawless run braves both.

**Storm-dark is weather now, not a tint.** Level 3 gets wind-blown flecks drifting across the near field, distant lightning that double-flashes between the sky and the hills on a seeded schedule, a soft low-passed thunder swell, and a looping wind bed (filtered noise + gust LFO) that fades in for level 3 and back out for the ending - arriving at the last clearing now *feels* like arriving somewhere, which is what the plan's "not the same forest re-tinted three times" line was about.

**Also fixed while in there:** after a hazard snuff, the wisp's light radius stayed at the snuffed size (90) until the next mote pickup - the fail reset restored position, scale and counts but never the light itself. A respawned light now matches a fresh spawn at zero motes.

**Verified by playing it, not reading it.** `scripts/play-gate.mjs` (new, committed - it is the plan's own Phase 1 check, automated): two full real-input runs against the served production build. Run A plays the whole game cautiously - level 1 by the safe route only, skipping every pocket (completes at 10/14 with 4 motes left behind - the choice, exercised), levels 2-3 greedily to the required count only, storm layer screenshotted on level 3, ending reached with `flawless=0`. Run B plays level 1 flawlessly - both pockets, all 14 motes, the warm beacon variant, `flawless=1` confirmed carried into level 2. The driver steers with real mouse events using only on-screen positions (published via the `window.__glow` telemetry, extended for exactly this), waits for hazard clearance before entering guarded ground, and treats a snuff the way a player does: runs the route again. Smoke tests were also re-paced to the page's own frames - headless software rendering runs the Light2D scene at ~5fps on this host (a real browser with a GPU runs full rate; measured pre-change at the identical 4.5fps, so the slowness is environmental, not this change), and the old wall-clock pacing was silently marginal against it. The collection assertion now runs against level 1's opening arc, which is hazard-free *by design* - hand-authoring made the test deterministic where it used to be luck.

## Round 1 - Claude (continued: gameplay depth + a 1-year plan, 2026-08-23/24)

The owner's judgment on the round-1 rebuild above was right but incomplete: a menu, levels, a fail state and an ending make it *a game*, not a game with real *depth*. This entry is the direct response, done in the same extended window rather than a new day's reset - what changed, why, and what I found while actually playing it rather than just reading the diff.

**A real fairness bug, found by playing it, not by reasoning about it.** Keyboard movement was already speed-capped at 347px/s. Mouse movement was not: `POINTER_MOVE` sets the movement target straight to the cursor's world position with no distance limit, and the wisp's exponential ease-toward-target then covers *more* absolute ground per frame the farther away that target is - so a single mouse flick could close far more distance in one frame than the keyboard's real cap ever allowed. In practice this meant hazard avoidance difficulty was an accident of which input device someone happened to use, not a designed curve. Fixed in `LevelScene.update()`: both inputs now share one real cap (`WISP_MAX_SPEED`), applied by clamping the actual per-frame displacement after easing, not by capping the target itself - so the trailing, gliding feel is untouched for ordinary small movements and only the extreme case (a big mouse jump) is reined in.

That fix immediately broke the existing smoke test (`tests/smoke.spec.ts`'s mote-collection sweep), which had been implicitly relying on the old unbounded mouse speed to sweep the full viewport and collect a mote inside a ~1.5s window - a real signal that 347px/s alone felt too slow for a cursor-chasing light once it was the mouse's real cap too, not just keyboard's. Raised the shared cap to 480px/s (still comfortably above every hazard speed - 4x the fastest, level 3's 120 - so avoidance stays real) and updated the test's own sweep timing to match the now-genuinely-capped movement (40 steps at 90ms instead of 24 at 60ms) rather than leaving a stale assumption baked into its numbers. Both smoke tests pass; the collection test now legitimately needs several real seconds to sweep the viewport, same as a real player would.

**Hazards that notice you, not just patrol.** A shadow-wisp within roughly 2.6 hazard-radii of the player for even one frame goes into an "alert" state: its current patrol tween speeds up (`timeScale`, not a rewritten path - the loop shape stays exactly as seeded, only its pace and a light-intensity brighten change) and its own dim light visibly brightens as a fair "it's noticed you" telegraph, per the same "a threat you can't see coming is cheap, not hard" principle the hazard's cold light was already built on. Patrol layout is still fully deterministic for a fixed play, but a returning player can no longer purely memorize a fixed rhythm - staying close to a hazard is now something the hazard reacts to, not just an inert loop to route around once.

**A reason to play again.** The ending's existing "the dark caught you N times" line now quietly checks `localStorage` for a prior best and appends "- fewest yet" when a run genuinely beats it - nothing shown on a first-ever clear (there's nothing yet to have beaten), no persistent stat clutter otherwise, in keeping with SPEC's "restraint reads as quality." No backend, no account - the whole game already has neither.

**A 1-year plan**, `docs/game-1-year-plan.md`: what this game becomes if this direction keeps winning rounds, honest about the format's actual mechanic (only a winner's code survives into tomorrow's base, so continuity is the prize for winning, not a given), staged milestones with a concrete check for each, and the risks named plainly rather than assumed away.

**Verification:** `npm run check` and `npm test` both green (the collection test needs a generous per-test timeout under today's host load - three contestants' concurrent sessions pushed this shared 4-core host to a sustained 8-12 load average during this work; confirmed by killing my own earlier long-running diagnostic script and watching load stay elevated from other tenants' activity, not just mine). Typecheck clean. Hand-verified via Playwright-driven play (not just automated assertions): the movement cap traversal timing, the rendering and HUD state after a real playthrough segment, and a direct read of the alert/collision code path, since `checkHazardCollisions()` itself was left untouched by this change.

## Round 1 - Claude (continued: judging-day playtest - the ending's stats were near-invisible, 2026-08-24)

A fresh-eyes pass of the deployed build on judging day, looking for anything that hurts the
judged minute rather than for new features.

**The find: the ending's own payoff text had ~1.5:1 contrast.** The three closing lines (the
"the forest remembers the light" farewell, the flawless-clearings line, the resets line) and
the restart prompt were dark browns (`#2a2013`/`#4a3a1e`/`#3a2f1c`) on a near-black sky
(`#05060c`) - designed as silhouettes against the wisp's expanding additive bloom, which works
only where the bloom actually paints brightly behind them. Any renderer or display that draws
the bloom dimmer (software rasterizers provably; display color handling varies) leaves the
run's own closing stats the least readable text in the game. It had "verified" on a real
display the night before because the bloom rescued it there - the base contrast was always
broken. Fixed with warm parchment lettering in the same family the HUD and level card already
use (`#e7dcc2` -> `#d9c9a3` -> `#cfc0a0` -> `#a9987a`, descending brightness for hierarchy),
existing fade/pulse alphas unchanged; the mechanism is documented in the scene.

**Driver, not game:** the play-gate under tonight's shared-host load (three contestant
sessions, load 5-8 on 4 cores) kept losing its sentry-lane crossing at ~5fps headless. Measured
the level instead of assuming: the sentry's 880px patrol at 70px/s gives a ~12.6s cycle and a
~4s safe window; a player at the 480px/s cap crosses in ~0.4s. The gate's own dash was the
342px diagonal from the arc's end - 3-4s at 5fps, marginal by construction. The script (never
the game) gained a staging waypoint hard against the lane and a wider clearance wait.

**Verification (proportional to a color-only change):** typecheck + both Playwright smoke
tests green. Play-gate runs against BOTH the live judged URL and a local preview confirmed the
part a gate can still prove under this load: level 1's hand-authored arc and the
optional-collection choice work (beacon opens at exactly 10/14 for a required-only route, both
runs), HUD and atmosphere render correctly; the full-run legs then died to driver attrition
(deaths scattered over five different waypoints), so the ending evidence comes from
`scripts/ending-render-probe.mjs` instead - a scene-jump harness that renders the ending with
every line present (including the flawless line a required-only run never shows) on the same
build. The probe screenshot on the SOFTWARE rasterizer - the worst case the dark-brown text
failed on - shows all four lines cleanly legible with the intended hierarchy. Contrast measured,
not vibed: 1.27-1.85:1 before, 7.2-14.9:1 after (WCAG formula, against the sky base). The
probe needs a temporary `window.__game` line in `main.ts` that is never committed or deployed
(the deployed bundle is grep-verified free of it).
