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
src/scenes/dimensions.ts   VIEW_WIDTH/VIEW_HEIGHT (fixed) and WORLD_WIDTH/WORLD_HEIGHT (a level's scroll bounds)
src/scenes/MenuScene.ts    title screen - atmosphere plus the game's name, any input starts level 1
src/scenes/LevelScene.ts   the whole game loop, reused for all three levels via LevelConfig
src/scenes/EndingScene.ts  the payoff after level 3, then loops back to the menu
src/levels.ts              the three LevelConfig entries - what actually changes between stages
src/textures.ts            runtime-generated textures, including the hazard's silhouette
src/audio.ts               Web Audio: drone, chime, hit, level-complete arpeggio, ending chord
public/assets/             committed assets you generated (images, audio) - copied verbatim into dist/
src/global.d.ts            the window.__glow test hook contract
tests/smoke.spec.ts        the smoke tests every build must pass
scripts/check-workspace.mjs   repo hygiene guard behind `npm run check`
deploy.sh                  publish a build to one of the four slots
```

## Scene flow

`Menu -> Level (x3, index 1-3) -> Ending -> Menu`, via `this.scene.start(key, data)`. Phaser only keeps one scene of each type running at a time here (no scene stacking), so each scene's `create()` rebuilds everything it needs from `init(data)` - nothing is assumed to survive a scene swap except the shared `Ambience` instance, passed forward explicitly in the `data` object at every `scene.start()` call so the drone doesn't restart and audio stays unlocked across scene changes. `resets` (see below) rides along the same way.

- **MenuScene.** Deliberately thin, per SPEC.md's feel notes ("a menu wall... spends the part of the round that decides it"): the title, a drifting wisp for atmosphere, and a prompt. Any pointer-down or keydown calls `begin()`, which unlocks audio and starts `LevelScene` at `levelIndex: 1`.
- **LevelScene.** One reusable scene, not one class per level - see "Levels are data" below. Everything from the original slice (Light2D, parallax, the breathing light, the mote/glow loop, ambience) lives here, plus what round 1 was missing: hazards, a fail state, and a real goal.
- **EndingScene.** Receives the run's total `resets` and reports it back to the player as one line, then the wisp's light expands to fill the frame - the same reveal gesture the whole game is built on, played once at full scale with nothing left to interrupt it. Any input after a short beat restarts from the menu. `recordBest()` checks `localStorage` (key `start-of-glow-best-resets`, wrapped in try/catch so a blocked or unavailable store can never break the ending) against this run's `resets`; only a run that beats a *prior* clear appends "- fewest yet" to the existing line - a first-ever clear quietly sets the baseline rather than announcing a "best" with nothing to compare against, and every other non-best run is left exactly as it always was, per SPEC's "restraint reads as quality."

## Levels are data, not code

`src/levels.ts` exports `LEVELS: LevelConfig[]` - `index`, `name`, `moteCount`, `hazardCount`, `hazardSpeed`, `mood`. `LevelScene.init(data)` reads the config for `data.levelIndex` and everything downstream (mote count, hazard count and speed, the forest's colour tint via `MOOD_TINT`) follows from that one object. Adding a fourth level is adding one entry to the array; it does not touch `LevelScene.ts`. World layout inside a level (mote and hazard positions, tree placement) is seeded off `` `start-of-glow-<thing>-${config.index}` ``, so a level's layout is identical every time you play it, but distinct from every other level.

## The goal: the beacon

Unchanged in spirit from the base slice, extended into an actual win condition. The beacon sits at a fixed point near the far edge of the level, invisible at the start. Its alpha and its own dim `Light2D` light both track `collected / moteCount`, so it visibly brightens as the player finds motes - a second, slower payoff tied to the same variable that grows the wisp. Once every mote in the level is collected, `levelClear` goes true, the beacon starts a slow pulse (an invitation, wordlessly), and `update()` begins checking the player's distance to it. Arriving within `BEACON_RADIUS` calls `completeLevel()`: a level-complete chime, a warm camera flash, a fade to black, then the next level (or `EndingScene`, after level 3).

## The threat: hazards

Shadow-wisps - the thing the light is not. `makeHazardTexture` draws an irregular dark blob (not a circle; the wisp already owns "perfect radial glow", so the hazard needed to read as a different *kind* of thing at a glance) with a thin cold-violet rim, and each carries a small, dim `Light2D` light of its own (`0x9a6efa`, radius 130) - not because a real shadow would glow, but because a threat the player cannot see coming in a game about darkness is cheap, not hard. Each hazard patrols a loop of three deterministic waypoints via chained tweens (`LevelScene.patrol()`), at the level's `hazardSpeed`. Touching one (`HAZARD_RADIUS`, checked every frame once the level's opening grace period has passed) calls `fail()`.

**Hazards notice proximity.** `checkHazardAlerts()` runs every frame: a hazard within `ALERT_RADIUS` (2.6x `HAZARD_RADIUS`) of the wisp for even one frame flips into an "alert" state - its *currently running* patrol tween gets `timeScale = ALERT_TIME_SCALE` (faster playback of the same eased path, not a different path) and its light's intensity rises from `CALM_LIGHT_INTENSITY` toward `ALERT_LIGHT_INTENSITY` as a fair telegraph. `patrol()` now stores the live tween on the hazard object (`hazard.tween`) specifically so this can reach in and adjust it; the last line of `patrol()` re-applies the current alert `timeScale` to a freshly created next-leg tween, so the boost doesn't silently reset to calm at a waypoint if the player is still close. The patrol *shape* stays exactly as seeded and fully deterministic for a fixed play - only pace and visibility change - so builds stay comparable in judging the way "Deterministic layout" below already requires, while a returning player still has to stay reactive rather than purely memorize a fixed rhythm.

`fail()` is the cost: it snuffs the wisp's light (a hard tween down, not a fade), plays a burst of filtered noise plus a falling dissonant interval, then - after a beat - resets the *level's* progress: position back to the start, `collected` back to 0, every mote respawned, the beacon dark again. It does not reset which level you are on or send you back to level 1; only this attempt's progress is lost, which is what makes avoiding a hazard worth doing without making one mistake cost the whole run. `resets` accumulates across the whole playthrough and is the only number `EndingScene` reports back.

## A `this.time.delayedCall` gotcha

`fail()` and `EndingScene`'s "wait before the restart prompt is live" both need a plain "wait N ms, then run this" - the obvious tool is `this.time.delayedCall`. In this build's actual runtime environment it did not fire reliably: `fail()` would lock input, play its sound and light-snuff tween, and then never unlock, because the delayed callback that does the unlocking silently never ran. Confirmed by adding a log at the top of the callback and inside `fail()` itself - the second log never printed, no error anywhere, the game just soft-locked on the first hazard touch. Root cause not fully chased down (plausibly something about how this host's environment steps the Scene `Clock` between frames), but the fix was straightforward: `LevelScene.after(ms, onComplete)` runs a target-less `this.tweens.add({ duration: ms, onComplete })` instead, and tween `onComplete` fired every time in the same environment where `delayedCall` didn't. Every timed handoff in this build (`fail`'s reset, `EndingScene`'s restart-prompt delay) goes through a tween now, not the Clock. If you need a delayed one-shot anywhere in this codebase, use a tween, not `delayedCall`, until someone chases the root cause down - and test it with something slower than a glance, the failure mode is silent, not an error.

## Menu-to-level transition cost is real, and it isn't the textures

Clicking through from the menu to level 1 takes close to two seconds
(measured locally, quiet host, three runs: ~1.9-2.0s from click to
`window.__glow.scene === "level"`) - long enough that it can read as a
stall rather than a fade. The obvious suspect is `LevelScene.preload()`
drawing its ~11 canvas textures (`makeGroundTexture` at 2560x240 and
`makeHillsTexture` at 1760x260 are the two genuinely expensive draws) cold,
on the player's own click. That suspicion was tested properly: `preload()`'s
texture calls were pulled into an exported `levelTextureTasks()` list so
`MenuScene` could drain it one texture per frame during idle menu time
(never `this.time.delayedCall` - see the gotcha above; `update()` is what
already runs the wisp-breathing effect, so it's the scheduling mechanism
already proven reliable on this screen), dedup-guarded so a fast click
before the queue drains just falls back to today's behavior for whatever's
still missing. Measured **with the full prewarm confirmed drained
before clicking**: 1.89-1.95s. Measured cold, same host, same conditions:
1.93-2.02s. The difference is inside the noise of a three-run sample -
texture generation is not the bottleneck, or at most a small fraction of
one. (The change was reverted rather than shipped - `git stash` on this
branch has the diff if the shared-task-list refactor is worth resurrecting
on its own merits later; it should not be resubmitted as a performance fix
without new evidence.)

What's actually eating the time is more likely `LevelScene.create()`
itself: it builds 40+ game objects (14 trees, 11 fireflies, up to 22 motes,
2+ hazards, the wisp, its particle trail, the beacon) and registers 25+
tweens in one synchronous pass, several of them through the `Light2D`
pipeline - and pipeline/shader setup on a GameObject's first `Light2D` use
is itself a plausible one-time GPU cost, distinct from and untested here.
Neither has been profiled - this is a lead for whoever has time to chase
it next, not a diagnosis. Don't re-reach for texture prewarming as the fix
without measuring create() itself first.

## How the scene works (LevelScene specifics)

- **Lighting.** `this.lights.enable().setAmbientColor(0x0a0d18)` makes the world nearly black. Anything that should be lit calls `setPipeline("Light2D")` - the trees and the ground do. The wisp is *not* lit - it is a light *source*, drawn with `ADD` blending, with a `Phaser.GameObjects.Light` following it. A second, dimmer light sits at the beacon; hazards each carry their own cold one.
- **World vs. viewport.** The rendered viewport is fixed at `VIEW_WIDTH`/`VIEW_HEIGHT` (1280x720, mandated) but a level's *world* is wider: `WORLD_WIDTH` (2560) x `WORLD_HEIGHT` (720), both in `src/scenes/dimensions.ts`. The camera has `setBounds` and `startFollow(wisp, false, 0.09, 0.09)`.
- **Parallax.** The sky is `scrollFactor(0)` (fixed to the screen), the distant hill ridge `0.25`, background fireflies `0.75`. Anything Light2D-piped (trees, ground) or anything that carries its own `Light` (the beacon, hazards) stays at the default `1` - a `Light`'s world position cannot itself be parallaxed, so a reduced scroll factor on a lit or light-emitting object would visibly drift out of register with its own light as the camera scrolls.
- **Reveal loop.** Collecting a mote raises `collected`, which grows the wisp light's `radius`/`intensity` and the sprite's scale, and feeds the beacon's brightening (see "The goal" above). The world is revealed by the light, not by unhiding objects.
- **Breathing light.** `update()` adds a slow sine on top of the wisp light's base intensity, plus a `pulseBoost` that jumps on pointer-down and decays toward 0 every frame - both modulate the same `intensity` value per frame rather than fighting over a Phaser tween.
- **Ambience audio.** `src/audio.ts`'s `Ambience` class is oscillator- and noise-buffer-only (a breathing drone, a pentatonic collect chime, a filtered-noise-plus-falling-interval hit, a rising arpeggio for level-complete, a long warm chord for the ending) - no samples, per SPEC.md's synth path. `unlock()` runs inside a pointer-down handler (browsers block `AudioContext` until a user gesture); every method is wrapped in try/catch so audio can never throw into the game loop.
- **Textures.** Everything is drawn into canvas textures at `preload()` from `src/textures.ts`: radial gradients for the glowing things (wisp, motes, sparks, fireflies, the beacon, the hazard trail's sparks), the hazard's own irregular-blob-with-rim shape, silhouette trees and ground, the sky (gradient + seeded stars) and hills. Seeded `RandomDataGenerator` keeps every layer identical run to run.
- **Input.** Pointer move and pointer down set a target the wisp eases toward; arrow keys move the same target. Both are ignored while `this.locked` is true (mid-fail, mid-level-complete) so the player cannot interrupt either transition.
- **Movement is speed-capped, identically for both input methods.** `update()` eases the wisp toward `target` (the trailing, gliding feel), then clamps the *actual per-frame displacement* to `WISP_MAX_SPEED` (480px/s). This matters because pointer input sets `target` straight to the cursor's world position with no distance limit of its own - unclamped, the exponential ease covers more ground the farther the target is, so a single mouse flick could out-run the keyboard's own step-based cap by a wide margin. Clamping the *displacement* rather than the target preserves the eased feel for ordinary small movements (almost always already under the cap) and only reins in the extreme case. `WISP_MAX_SPEED` was raised from keyboard's original 347 to 480 after capping mouse input to 347 made ordinary repositioning feel sluggish, not just hazard-avoidance fair - see `tests/smoke.spec.ts`'s mote-collection test for the corresponding timing update (a full-viewport sweep now takes several real seconds, not the near-instant catch-up unbounded mouse input used to allow).
- **Test hook.** `reportState()` publishes `window.__glow` (now carrying `scene`, `level` and `resets` alongside the original fields) and each scene's `create()` sets `document.body.dataset.gameReady` after its first rendered frame. The smoke tests wait on that attribute, then drive a click through the menu before asserting on level state. If you change a scene's reported shape, keep `src/global.d.ts` in sync - it is the contract the tests type-check against.

## Fixed resolution

The rendered viewport runs at a **1280x720** design resolution with `Phaser.Scale.FIT`, letterboxed. `VIEW_WIDTH`/`VIEW_HEIGHT` in `src/scenes/dimensions.ts` are the single source of truth - `main.ts` imports them for the Phaser scale config, every scene imports them for layout. `WORLD_WIDTH`/`WORLD_HEIGHT` are a separate, larger pair used only inside `LevelScene` for camera bounds and content placement - the canvas itself never changes size regardless of how wide a level's world is.

Deterministic layout is deliberate: it makes screenshots comparable between machines, it means the owner plays the same framing on every build, and 720p is a clean source for the recorded judging sessions. The resolution is mandated by [SPEC.md](SPEC.md) - do not change it.

## Constraints worth knowing before you refactor

- The production bundle serves from four URL prefixes, so never hardcode an absolute asset path or set `base` to `/`.
- Everything in the build is made by you: draw or synthesize it in code, or generate it with an AI model and commit it under `public/assets/`. Never a downloaded sprite pack, stock texture or asset-store sound.
- Private notes, journals and durable agent state live in your own workspace, never here. `npm run check` will stop you.
- Prefer a target-less tween over `this.time.delayedCall` for anything timed - see the gotcha above.
