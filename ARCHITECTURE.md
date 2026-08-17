# Architecture

The winner of each round updates this file. It is the shared map of the codebase, and keeping it honest is what lets the other two contestants pick the game up the next morning.

## Stack

- **Phaser 3** (WebGL) for rendering, input, tweens, particles and the Light2D pipeline.
- **TypeScript**, strict, no emit - Vite does the transform, `tsc` only typechecks.
- **Vite 7** for dev server and production build. `base` is relative (`./`) so one build serves from four different URL prefixes.
- **Playwright** for smoke tests, driving a real production build in Chromium.

No game framework beyond Phaser, no asset pipeline, no backend. The game is a static bundle.

## Layout

```
index.html            page shell, canvas mount, analytics beacon
src/main.ts           Phaser game config (960x540, FIT scaling) and scene list
src/scenes/BootScene.ts   the whole game so far
src/textures.ts       runtime-generated textures (no downloaded art)
src/global.d.ts       the window.__glow test hook contract
tests/smoke.spec.ts   the smoke tests every build must pass
scripts/check-workspace.mjs   repo hygiene guard behind `npm run check`
deploy.sh             publish a build to one of the four slots
```

## How the scene works

`BootScene` is a vertical slice, not a contract - replace it freely, as long as `npm test` still passes.

- **Lighting.** `this.lights.enable().setAmbientColor(0x0a0d18)` makes the world nearly black. Anything that should be lit calls `setPipeline("Light2D")`; the trees and the ground do. The light-being is *not* lit - it is a light *source*, drawn with `ADD` blending, with a `Phaser.GameObjects.Light` following it.
- **Reveal loop.** Collecting a mote raises `collected`, which grows the light's `radius` and `intensity` and the sprite's scale. The world is revealed by the light, not by unhiding objects - that is the whole art direction in one mechanic.
- **Textures.** Everything is drawn into canvas textures at `preload()` time from `src/textures.ts`: radial gradients for the glowing things, silhouette shapes for the trees and ground. Seeded `RandomDataGenerator` keeps them identical run to run, which keeps screenshots comparable.
- **Input.** Pointer move and pointer down set a target the wisp eases toward; arrow keys move the same target. Pointer down also pulses the light.
- **Test hook.** `reportState()` publishes `window.__glow` and `create()` sets `document.body.dataset.gameReady` after the first rendered frame. The smoke tests wait on that attribute. If you change the scene's state, keep the hook meaningful - it is the only thing standing between a broken build and a wasted judging round.

## Fixed resolution

The game runs at a 960x540 design resolution with `Phaser.Scale.FIT`, letterboxed. Deterministic layout is deliberate: it makes screenshots comparable between machines, and it means the owner plays the same framing on every build.

## Constraints worth knowing before you refactor

- The production bundle serves from four URL prefixes, so never hardcode an absolute asset path or set `base` to `/`.
- No downloaded sprite packs, ever. Generate art, or draw it in code.
- Private notes, journals and durable agent state live in your own workspace, never here. `npm run check` will stop you.
