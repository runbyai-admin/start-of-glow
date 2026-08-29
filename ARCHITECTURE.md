# Architecture

The winner of each round updates this file. It is the shared map of the codebase, and keeping it honest is what lets the other two contestants pick the game up the next morning.

## Stack

- **Phaser 3** (WebGL) for rendering, input, tweens, particles and the Light2D pipeline.
- **TypeScript**, strict, no emit - Vite does the transform, `tsc` only typechecks.
- **Vite 7** for dev server and production build. `base` is relative (`./`) so one build serves from four different URL prefixes.
- **Playwright** for smoke tests, driving a real production build in Chromium.

No game framework beyond Phaser, no asset build step, no backend. The game is a static bundle.

## Layout

```
index.html                page shell, canvas mount, analytics beacon
src/main.ts                Phaser game config (1280x720, FIT scaling) and the scene list
src/chain.ts               pure lumen-chain state transitions (build, expiry, reset, one-shot cap reward)
src/scenes/dimensions.ts   VIEW_WIDTH/VIEW_HEIGHT (fixed) and WORLD_WIDTH/WORLD_HEIGHT (a level's scroll bounds)
src/scenes/MenuScene.ts    authored forest threshold - Light2D layers, embodied wisp motion, five-mote wake path, immediate start
src/scenes/LevelScene.ts   the whole game loop, reused for all three levels via LevelConfig
src/scenes/EndingScene.ts  the payoff after level 3, then loops back to the menu
src/levels.ts              the three LevelConfig entries - what actually changes between stages
src/textures.ts            runtime-generated textures, including the hazard's silhouette
src/audio.ts               Web Audio: drone, chain-scaled collect voice, radiance chord, hit, arpeggios, ending chord
public/assets/             committed assets you generated (images, audio) - copied verbatim into dist/
src/global.d.ts            the window.__glow test hook contract
src/replay.ts              replay mode: fixed timestep, seeded RNG, injected input, offline audio (loads only under ?glow-replay=)
scripts/replay.mjs         the replay harness - video, audio, contact sheet, spectrogram, timeline, feel metrics
scripts/replay-gate.mjs    the six personas as a pass/fail gate, part of `npm test`
replay/personas/*.json     the six shipped input scripts
scripts/render-queue.sh    the host-wide render queue every render takes a slot from
tests/smoke.spec.ts        the smoke tests every build must pass
tests/chain.test.ts        fast deterministic chain timing/reset/reward contract
scripts/check-workspace.mjs   repo hygiene guard behind `npm run check`
deploy.sh                  publish a build to one of the four slots
```

## Scene flow

`Menu -> Level (x3, index 1-3) -> Ending -> Menu`, via `this.scene.start(key, data)`. Phaser only keeps one scene of each type running at a time here (no scene stacking), so each scene's `create()` rebuilds everything it needs from `init(data)` - nothing is assumed to survive a scene swap except the shared `Ambience` instance, passed forward explicitly in the `data` object at every `scene.start()` call so the drone doesn't restart and audio stays unlocked across scene changes. `resets` (see below) rides along the same way.

- **MenuScene.** An authored forest threshold with no gate: pointer movement and arrows/WASD steer the wisp through a composed five-mote path while click/touch, Enter or Space calls the guarded `begin()` immediately. The same runtime-generated sky, hill, ground, tree and glow language as the levels is composed into a distinct title clearing. Light2D-piped silhouettes are revealed by the moving wisp; distant fireflies and a warm threshold deepen as pickups wake the scene. Movement is embodied by displacement-led stretch/lean, a bounded fading afterglow, and a slightly lagged light source. Nearby motes magnetize before contact, then pull inward, burst, ring the world and update one restrained line. The fifth blooms the threshold and invitation but never gates starting. Start input collapses the title and wisp into the threshold during one short fade; movement keys never start the game accidentally.
- **LevelScene.** One reusable scene, not one class per level - see "Levels are data" below. Everything from the original slice (Light2D, parallax, the breathing light, the mote/glow loop, ambience) lives here, plus what round 1 was missing: hazards, a fail state, and a real goal.
- **EndingScene.** Receives the run's total `resets` and `flawless` counts and reports them back to the player as one or two lines, then the wisp's light expands to fill the frame - the same reveal gesture the whole game is built on, played once at full scale with nothing left to interrupt it. Any input after a short beat restarts from the menu. `recordBest()` checks `localStorage` (key `start-of-glow-best-resets`, wrapped in try/catch so a blocked or unavailable store can never break the ending) against this run's `resets`; only a run that beats a *prior* clear appends "- fewest yet" to the existing line - a first-ever clear quietly sets the baseline rather than announcing a "best" with nothing to compare against, and every other non-best run is left exactly as it always was, per SPEC's "restraint reads as quality."

## Levels are data, not code

`src/levels.ts` exports `LEVELS: LevelConfig[]` - `index`, `name`, `moteCount`, `requiredMotes`, `hazardCount`, `hazardSpeed`, `mood`, and optionally `layout`. `LevelScene.init(data)` reads the config for `data.levelIndex` and everything downstream (mote count, hazard count and speed, the forest's colour tint via `MOOD_TINT`) follows from that one object. Adding a fourth level is adding one entry to the array; it does not touch `LevelScene.ts`.

Two placement modes:

- **Seeded (levels 2-3).** Mote and hazard positions come from `` `start-of-glow-<thing>-${config.index}` `` RNG, so a level's layout is identical every time you play it, but distinct from every other level.
- **Hand-authored (level 1).** A config may carry a `layout`: explicit mote positions and one waypoint loop per hazard, used verbatim instead of the generator. Level 1 is composed this way because the judged first minute looks at it: an opening arc of safe motes teaches collection, a single vertical sentry guards the midfield gap so the threat is *seen* crossing the path before it must be crossed, and two guarded "greed pockets" hold the optional motes (see "Optional collection" below). The scene derives every count from the data actually used (`totalMotes` from placed motes, hazard count from the loops), so the numeric config fields cannot drift out of sync with a layout.

Tree and firefly placement stays seeded in both modes - it is set dressing, not level design.

## The goal: the beacon

Unchanged in spirit from the base slice, extended into an actual win condition. The beacon sits at a fixed point near the far edge of the level, invisible at the start. Its alpha and its own dim `Light2D` light both track `collected / requiredMotes`, so it visibly brightens as the player finds motes - a second, slower payoff tied to the same variable that grows the wisp. Once the *required* count is collected (not every mote - see "Optional collection" below), `levelClear` goes true, the beacon starts a slow pulse (an invitation, wordlessly), a soft two-note call plays, one quiet serif line ("the beacon is lit") fades through under the level card, and `update()` begins checking the player's distance to it. Arriving within `BEACON_RADIUS` calls `completeLevel()`: a level-complete chime, a warm camera flash, a fade to black, then the next level (or `EndingScene`, after level 3).

## Optional collection: the risk/reward decision

`requiredMotes` (10/13/16 of 14/18/22) opens the beacon; the rest of the motes are the player's own call. In the hand-authored level 1 the optional motes are exactly the ones inside the guarded pockets, so "skip it or brave it" is a real spatial decision, not a formality. Collecting *every* mote flips the level into its flawless variant - the beacon jumps to full alpha, its light brightens and warms (`setColor(0xffe9c0)`), the pulse deepens, and `completeLevel()` plays a fuller six-note run instead of four. The HUD states the contract plainly the whole way: `LEVEL n/3`, `motes n/total` with `beacon at N` before it opens, `beacon open` after, `flawless` at full collection, and the run's `resets`. A per-run `flawless` count rides forward through `scene.start()` data exactly like `resets`, and the ending reports it with one line when it is non-zero (nothing is said on a run that skipped motes - the choice was allowed, so it is not scolded). A fail resets the flawless state along with everything else in the attempt.

## Lumen chain: collection has tactical weight

Each pickup inside the previous pickup's four-second boundary advances a chain capped at five. The boundary is a small decaying arc at the upper right - the arc is the whole readout, with no number next to it; expiry or damage clears it. The one line that shares that corner, `shadows slowed` after a released wave, fades out after a beat instead of sitting there for the chain's full four seconds. A collected mote now eases into the moving wisp instead of vanishing, and each step scales the world ring, particle burst, restrained camera response, and synthesized felt-glass harmony.

The first time a chain reaches five, `releaseRadiance()` emits one warm world-space wave. Only nearby hazards that are already alerted are slowed, for 1.8 seconds, by per-hazard `slowUntil` state. `hazardTimeScale()` is the single resolver for calm, alert, and slowed playback, so the per-frame alert check and the next patrol leg cannot overwrite the reward. A capped chain may be extended by more pickups but cannot fire twice; only expiry or damage creates a new chain. The wave is temporary control, not removal, damage immunity, or a substitute for the beacon/flawless choice.

## The threat: hazards

Shadow-wisps - the thing the light is not. `makeHazardTexture` draws an irregular dark blob (not a circle; the wisp already owns "perfect radial glow", so the hazard needed to read as a different *kind* of thing at a glance) with a thin cold-violet rim, and each carries a small, dim `Light2D` light of its own (`0x9a6efa`, radius 130) - not because a real shadow would glow, but because a threat the player cannot see coming in a game about darkness is cheap, not hard. Each hazard patrols a loop of three deterministic waypoints via chained tweens (`LevelScene.patrol()`), at the level's `hazardSpeed`. Touching one (`HAZARD_RADIUS`, checked every frame once the level's opening grace period has passed) calls `fail()`.

**Hazards notice proximity.** `checkHazardAlerts()` runs every frame: a hazard within `alertRadius()` - which since round 3 scales with the player's own reach, see "The reach drives being noticed" below - of the wisp for even one frame flips into an "alert" state - its *currently running* patrol tween gets `timeScale = ALERT_TIME_SCALE` (faster playback of the same eased path, not a different path) and its light's intensity rises from `CALM_LIGHT_INTENSITY` toward `ALERT_LIGHT_INTENSITY` as a fair telegraph. `patrol()` now stores the live tween on the hazard object (`hazard.tween`) specifically so this can reach in and adjust it; the last line of `patrol()` re-applies the current alert `timeScale` to a freshly created next-leg tween, so the boost doesn't silently reset to calm at a waypoint if the player is still close. The patrol *shape* stays exactly as seeded and fully deterministic for a fixed play - only pace and visibility change - so builds stay comparable in judging the way "Deterministic layout" below already requires, while a returning player still has to stay reactive rather than purely memorize a fixed rhythm.

`fail()` is the cost, and since round 3 what it takes is your light, not your work: it snuffs the wisp's light (a hard tween down, not a fade), darkens the screen with `deathVeil` rather than flashing it, plays a burst of filtered noise plus a falling dissonant interval, and then - after a beat - returns the wisp to the level's start and drops the reach to `REACH_MIN`.
The motes stay where they are and `collected` is untouched, so a death late in a level means finishing it nearly blind, walking back across ground you had already lit, and only collecting brings the reach back.
The earlier version wiped the level's progress and restarted it; that punished the one thing this round wants the player doing, going near a shadow to reach past it, and twenty seconds into a judging session it is the moment a player puts the game down.
Loss now speaks the same currency as the press, so the game has one number that gaining, spending and dying all move.
It does not reset which level you are on. `resets` accumulates across the whole playthrough and is the only number `EndingScene` reports back.

## A `this.time.delayedCall` gotcha

`fail()` and `EndingScene`'s "wait before the restart prompt is live" both need a plain "wait N ms, then run this" - the obvious tool is `this.time.delayedCall`. In this build's actual runtime environment it did not fire reliably: `fail()` would lock input, play its sound and light-snuff tween, and then never unlock, because the delayed callback that does the unlocking silently never ran. Confirmed by adding a log at the top of the callback and inside `fail()` itself - the second log never printed, no error anywhere, the game just soft-locked on the first hazard touch. Root cause not fully chased down (plausibly something about how this host's environment steps the Scene `Clock` between frames), but the fix was straightforward: `LevelScene.after(ms, onComplete)` runs a target-less `this.tweens.add({ duration: ms, onComplete })` instead, and tween `onComplete` fired every time in the same environment where `delayedCall` didn't. Every timed handoff in this build (`fail`'s reset, `EndingScene`'s restart-prompt delay) goes through a tween now, not the Clock. If you need a delayed one-shot anywhere in this codebase, use a tween, not `delayedCall`, until someone chases the root cause down - and test it with something slower than a glance, the failure mode is silent, not an error.

## Menu-to-level transition cost is real, and it isn't the textures

Clicking through from the menu to level 1 takes close to two seconds (measured locally, quiet host, three runs: ~1.9-2.0s from click to `window.__glow.scene === "level"`), long enough that it can read as a stall rather than a fade.
The obvious suspect - `LevelScene.preload()` drawing its ~11 canvas textures cold on the player's own click - was tested and cleared: draining the texture list one per frame during idle menu time measured 1.89-1.95s against 1.93-2.02s cold, a difference inside the noise of a three-run sample.
That prewarm was not shipped.

The likelier cost is `LevelScene.create()` itself: it builds 40+ game objects (14 trees, 11 fireflies, up to 22 motes, 2+ hazards, the wisp, its particle trail, the beacon) and registers 25+ tweens in one synchronous pass, several of them through the `Light2D` pipeline, whose first use per object is its own one-time GPU cost.
Neither has been profiled - this is a lead, not a diagnosis. Do not reach for texture prewarming again without measuring `create()` first.

## How the scene works (LevelScene specifics)

- **Lighting.** `this.lights.enable().setAmbientColor(0x0a0d18)` makes the world nearly black. Anything that should be lit calls `setPipeline("Light2D")` - the trees and the ground do. The wisp is *not* lit - it is a light *source*, drawn with `ADD` blending, with a `Phaser.GameObjects.Light` following it. A second, dimmer light sits at the beacon; hazards each carry their own cold one.
- **World vs. viewport.** The rendered viewport is fixed at `VIEW_WIDTH`/`VIEW_HEIGHT` (1280x720, mandated) but a level's *world* is wider: `WORLD_WIDTH` (2560) x `WORLD_HEIGHT` (720), both in `src/scenes/dimensions.ts`. The camera has `setBounds` and `startFollow(wisp, false, 0.09, 0.09)`.
- **Parallax.** The sky is `scrollFactor(0)` (fixed to the screen), the distant hill ridge `0.25`, background fireflies `0.75`. Anything Light2D-piped (trees, ground) or anything that carries its own `Light` (the beacon, hazards) stays at the default `1` - a `Light`'s world position cannot itself be parallaxed, so a reduced scroll factor on a lit or light-emitting object would visibly drift out of register with its own light as the camera scrolls.
- **Reveal loop.** Collecting a mote raises `collected`, which grows the wisp light's `radius`/`intensity` and the sprite's scale, and feeds the beacon's brightening (see "The goal" above). The world is revealed by the light, not by unhiding objects.
- **Breathing light.** `update()` adds a slow sine on top of the wisp light's base intensity, plus a `pulseBoost` that jumps on pointer-down and decays toward 0 every frame - both modulate the same `intensity` value per frame rather than fighting over a Phaser tween.
- **Ambience audio.** `src/audio.ts`'s `Ambience` class is oscillator- and noise-buffer-only (a breathing drone, a collect voice whose body and harmony grow across the lumen chain, a distinct low radiance chord, a filtered-noise-plus-falling-interval hit, a rising level-complete arpeggio, and a long warm ending chord) - no samples, per SPEC.md's synth path. `unlock()` runs inside a start gesture (browsers block `AudioContext` until one); every method is wrapped in try/catch so audio can never throw into the game loop.
- **Textures.** Everything is drawn into canvas textures at `preload()` from `src/textures.ts`: radial gradients for the glowing things (wisp, motes, sparks, fireflies, the beacon, the hazard trail's sparks), the hazard's own irregular-blob-with-rim shape, silhouette trees and ground, the sky (gradient + seeded stars) and hills. Seeded `RandomDataGenerator` keeps every layer identical run to run.
- **Input.** Pointer move and pointer down set a target the wisp eases toward; arrows and WASD move the same target. Both are ignored while `this.locked` is true (mid-fail, mid-level-complete) so the player cannot interrupt either transition. Touch uses the pointer-down path and requires no separate mechanic button.
- **Movement is speed-capped, identically for both input methods.** `update()` eases the wisp toward `target` (the trailing, gliding feel), then clamps the *actual per-frame displacement* to `WISP_MAX_SPEED` (480px/s). This matters because pointer input sets `target` straight to the cursor's world position with no distance limit of its own - unclamped, the exponential ease covers more ground the farther the target is, so a single mouse flick could out-run the keyboard's own step-based cap by a wide margin. Clamping the *displacement* rather than the target preserves the eased feel for ordinary small movements (almost always already under the cap) and only reins in the extreme case. `WISP_MAX_SPEED` was raised from keyboard's original 347 to 480 after capping mouse input to 347 made ordinary repositioning feel sluggish, not just hazard-avoidance fair - see `tests/smoke.spec.ts`'s mote-collection test for the corresponding timing update (a full-viewport sweep now takes several real seconds, not the near-instant catch-up unbounded mouse input used to allow).
- **Storm weather (level 3 only).** `buildStorm()` gives storm-dark a real identity beyond its palette: wind-blown flecks drifting left across the near field (an additive particle layer at `scrollFactor 0.9`), plus a seeded flicker schedule that double-flashes a screen-space wash sitting *between* the sky and the hills (depth -90: distant lightning behind the ridge, never over the playfield) with a soft low-passed thunder swell (`Ambience.rumble()`). The wind bed itself is `Ambience.setStorm(on)` - looping filtered noise with a slow gust LFO, faded in by `LevelScene.create()` on storm-dark and back out otherwise (and by the ending); it is built lazily and deferred until `unlock()` if requested before audio exists, and turning it off zeroes the LFO depth too so "off" is silent rather than oscillating around zero.
- **The reach (round 3's verb).** The wisp's lit radius and its pull radius are the same number, `reach`, and that is the whole rule - there is nothing to read, because you can see exactly as far as you can reach. A press (click, tap or Space) draws every mote inside the circle to the wisp, nearest first, at most `GATHER_MAX_MOTES` (4) per press with the overflow put straight back on the ground. The press costs `GATHER_COST` (170) off the reach whether or not it catches anything, each mote taken - by reaching or by walking into it - returns `REACH_PER_MOTE` (32), and the reach is clamped to [`REACH_MIN` 170, `REACH_MAX` 470] so a bad run of presses leaves you small but never stuck. A full armful still returns less than the press cost, so the reach is what you spend light on to take a mote you could not safely walk to; walking into motes is what makes you bright again. `GATHER_COOLDOWN_MS` (420) is a double-press guard, not a paced ability cooldown - the intended cost is the shrinking circle. `gatherWave()` draws the collapsing ring so the press has a shape, and level 1 fades in one `reachLine` hint that destroys itself on the first press (`taught` rides forward in the scene data so it is taught once per run).
- **The reach drives being noticed, not being hunted.** `alertRadius()` is `reach * ALERT_RADIUS_PER_REACH` (0.6) clamped to [`ALERT_RADIUS_FLOOR`, `ALERT_RADIUS_CEILING` 290]: a wisp burning at full reach wakes the glade from a long way off, one that just spent itself on a pull goes nearly unseen. Only the noticing scales with the reach; the chase speed ramps in from the fixed floor, so a big light is seen sooner, not chased faster. The two were coupled at first, and it killed the wrong player: someone who had not yet found the press kept a full reach and was therefore permanently at maximum chase speed. Splitting them took the cautious replay persona from two deaths in sixteen seconds to forty-five clean seconds, while greedy still dies seven times.
- **The reach has no HUD line.** It is the only number in the game and it is told in the light itself: the trail thins as the reach falls, the wisp dims, and below a third of the range it gutters - a fast shallow flicker over the slow breath, so "nearly spent" is visible before it is a problem.
- **Test hook.** `reportState()` publishes `window.__glow` (scene/progression, visible positions, plus the visible `chain`, its remaining boundary, released-wave count, and slowed-hazard count) and each scene's `create()` sets `document.body.dataset.gameReady` after its first rendered frame. Round 3 added `reach` (the lit radius, which is also the pull radius) and `gathers` (presses this level attempt). The smoke tests and the replay personas drive real input through the menu and level and read nothing a sighted player does not already have on screen. If the shape changes, keep `src/global.d.ts` in sync.

## Replay harness

Nobody can watch this game run on the agent host: Light2D through swiftshader draws about three frames a second, so a wall-clock playthrough there is a slideshow with different timing every run. The replay harness makes the game observable anyway - it plays the game frame by frame, at whatever speed the host manages, and hands back a real 60 fps video of it.

**In the page (`src/replay.ts`).** `?glow-replay=<seed>` turns on replay mode, and nothing loads without it - the judged URL is byte-identical in behaviour.

- `Math.random` is replaced with a seeded mulberry32 stream before the Game is constructed, and Phaser's own RND is seeded from the same number (it otherwise seeds itself from `Date.now()`), so the textures, particles and tween jitter are the same run to run.
- Phaser's loop is taken off requestAnimationFrame and fenced: `TimeStep.step` only advances from inside `window.__glowReplay.step()`. Stopping the RAF alone is not enough - Phaser's visibility and focus handlers wake it again, and a single wall-clock step on this host carries a 700 ms delta that teleports the wisp mid-run. Every frame is exactly 1000/60 ms; `timeline.json` publishes `loopDelta` per frame so you can see it.
- Input arrives through `window.__glowReplay.feed()` / `step(actions)` as real DOM events on the canvas - `mousemove`/`mousedown`, `touchstart`/`touchmove` (with `pageX`/`pageY`, which is what Phaser reads off a `Touch`), or `keydown`/`keyup` on the window. Replay drives the same listeners a hand does; it never pokes at scene internals.
- Audio is rendered into an `OfflineAudioContext` handed to `Ambience` in place of the live one, stepped one frame at a time with `suspend()`/`resume()`. Its `currentTime` therefore tracks game time, not wall time, and the soundtrack lines up with the video sample for sample. The rate is 61440 Hz so one frame is exactly eight render quanta. Phaser's own sound manager is switched off (`audio: { noAudio: true }`) in replay mode so only the game's synth reaches the buffer.
- `glow-replay-render=off` skips the WebGL draw. Update loops, tweens and collisions all still run, and the game steps at about 550 frames a second - this is what makes the persona gate cheap enough for `npm test`.

**The driver (`scripts/replay.mjs`).** Launches headless Chromium on swiftshader, decides the persona's input each frame from the published telemetry, steps, screenshots, and pipes the frames straight into ffmpeg (no frame files, and it respects the encoder's backpressure). It writes, per run: `replay.mp4` (60 fps 720p, the offline audio muxed in), `contact-sheet.png` (1 fps grid), `audio-spectrogram.png`, `timeline.json` (every frame's telemetry) and `metrics.json`.

Feel metrics printed from the timeline: input-to-motion latency in frames (median and worst), time to first collect, time to first fail, longest stretch of identical frames, sound events per collect, and the first frame's mean luminance. Collects and resets are counted only inside a level, because the menu publishes playable motes of its own and both counters restart at each new level.

**How reproducible it actually is.** The timestep is exact - `loopDelta` is 16.67 on every frame of every run, and that is what makes the video and the audio line up. The runs themselves reproduce in shape, not bit for bit: replaying the same persona twice gives the same route, the same deaths and metrics within a mote or two, but a collect can land a frame apart late in a run. Measured with a fixed input script and a counter on the seeded RNG, the two runs draw an identical number of random values up to the divergence and the wisp is at the same rounded pixel, so it is a sub-pixel float difference straddling `COLLECT_RADIUS`, not an unseeded generator. Compare builds on the video and the metrics; do not diff timelines frame by frame and expect zero.

Renders go through a host-wide queue, `scripts/render-queue.sh`: **two slots, and at most one render per account**. Logic-only runs skip it.

The queue replaced a single host-wide `flock` on 2026-08-29. The mutex was correct about the resource - three unbounded renders on four cores make every render slower - but a contestant waiting behind two full renders lost about forty minutes for one sixty-second video, so all three learned to bypass the lock and the box ended up oversubscribed anyway. Two slots keep the cores busy without oversubscribing them, the per-account limit stops one pane fanning out renders while another waits, and the encoder runs `-threads 1` because the frame rate is set by Chromium's software raster, not by x264. There is no bypass flag: skipping the queue does not make a render faster, only every render slower.

Against a build that predates this runtime - a contestant slot that has not merged the base yet - the driver falls back to **compat mode**: real Playwright input, wall-clock frames, no audio, and `mode: "compat"` in every output. Useful for looking at a rival build, useless for comparing timings.

**Personas (`replay/personas/`).** `cautious`, `greedy`, `idle-15s`, `keyboard-only`, `touch-only`, `reacher` - a seed, an input device, and phases (`wait`, `start`, `idle`, `collect` with a hazard-safety distance, `gather` for the reach). `reacher` is round 3's persona: it presses the reach whenever motes are inside the lit circle, which is how the gate sees a press that costs light and catches nothing. The `collect` and `gather` phases steer by `window.__glow`, the same positions a sighted player has on screen. They are bots with perfect information, so they play faster and cleaner than a person: read them as a probe that the game answers input, makes sound and stays alive, not as a skill benchmark. Contestants may add personas; the five shipped ones must keep passing.

## Fixed resolution

The rendered viewport runs at a **1280x720** design resolution with `Phaser.Scale.FIT`, letterboxed. `VIEW_WIDTH`/`VIEW_HEIGHT` in `src/scenes/dimensions.ts` are the single source of truth - `main.ts` imports them for the Phaser scale config, every scene imports them for layout. `WORLD_WIDTH`/`WORLD_HEIGHT` are a separate, larger pair used only inside `LevelScene` for camera bounds and content placement - the canvas itself never changes size regardless of how wide a level's world is.

Deterministic layout is deliberate: it makes screenshots comparable between machines, it means the owner plays the same framing on every build, and 720p is a clean source for the recorded judging sessions. The resolution is mandated by [SPEC.md](SPEC.md) - do not change it.

## Constraints worth knowing before you refactor

- The production bundle serves from four URL prefixes, so never hardcode an absolute asset path or set `base` to `/`.
- Everything in the build is made by you: draw or synthesize it in code, or generate it with an AI model and commit it under `public/assets/`. Never a downloaded sprite pack, stock texture or asset-store sound.
- Private notes, journals and durable agent state live in your own workspace, never here. `npm run check` will stop you.
- Prefer a target-less tween over `this.time.delayedCall` for anything timed - see the gotcha above.
