# Spec

The owner's concept for Start of Glow, and the parts of it that are not up for negotiation.

Read this together with [RULES.md](RULES.md).
The rules say how a round works; this says what you are building.

## The game

You are a small light-being in a dark forest.

The world starts unlit - shapes exist, but you cannot see them.
Collecting light particles grows your glow, and the glow is what reveals the world.
Revealing the world *is* the game's core gesture: light is the character, the reward, and the camera all at once.

The reference is **Ori and the Blind Forest** - not its mechanics, its feeling.
A dark, painterly, wordless place that is beautiful before it is understood.

## What is mandated

These are hard rules.
A build that breaks one has missed the brief, however good it is otherwise.

**The look.**

- Dark palette. The default state of the screen is near-black, and light is scarce enough to be precious.
- Glow and bloom, via Phaser's **Light2D** pipeline. Things that should be lit call `setPipeline("Light2D")`; the light-being is a light *source*, not a lit object.
- A silhouette world. Foreground and background read as shapes against darkness, not as illustrated detail.
- Particles. Light in this game moves, drifts and shimmers - it is never a static circle.

**The hook.** You are a small light-being. You collect light. Your glow grows, and growing glow is what reveals the world. Every round's build must still be recognisably that.

**Everything in the build is made by you.** No downloaded sprite packs, no stock textures, no asset-store music or sound effects, nothing lifted from another game.

How you make it is open. Draw a texture in code at runtime (`src/textures.ts` is the pattern), synthesize a sound with the Web Audio API, or generate the image, the music and the sound effects with an AI model and commit the files - all of it counts, and you can mix them freely inside one build. A generated `.png` or `.ogg` in the repo is a first-class asset, not a shortcut.

What is not allowed is shipping someone else's work as yours. `npm run check` will not catch this for you - it is on your honour and on the diff.

**Fixed design resolution: 1280x720**, letterboxed with `Phaser.Scale.FIT`.
Not negotiable, and not per-build. Deterministic framing is what makes the builds comparable in judging, keeps smoke-test screenshots stable, and gives the recorded judging sessions a clean 720p source that scales to video without an ugly upscale.

**The title stays.** The game is called *Start of Glow*. Do not rename it, do not sub-title it, do not brand it as yours.

## What is yours

Everything else, within 2D.

Genre is explicitly open: precision platformer, free-roam explorer, puzzle piece, score chase, something none of us has named - if it fits the look and the hook, it is fair game.
Mechanics, level design, progression, difficulty, structure, audio, art pipeline, and how much or how little UI to draw are all yours to decide, every round.

Do not ask permission for a direction. Build it and let the round judge it.

## Round 1

**Make it beautiful first.**

Round 1 is an atmosphere round.
The bar is the mood: darkness that feels deliberate, light that feels precious, a world worth revealing.
Mechanics can stay thin - a slice that is gorgeous and shallow beats one that is clever and murky.

Later rounds will pull toward depth on their own, because a beautiful thing with nothing in it stops being interesting on the second play.
That is a problem for round 2 onward. Round 1, make it look like something.

## Feel notes

Not rules - the owner's taste, written down so you are not guessing.

- **Immediately playable.** The first seconds decide whether the owner keeps playing, so a menu wall, a tutorial gate, or a slow load spends the part of the round that matters most. Judging runs as long as the build earns; that is not a reason to plan for a warm-up.
- **Wordless where possible.** The world should teach itself. Text on screen is a fallback, not a feature.
- **Restraint reads as quality.** Fewer colours, fewer effects, better ones. A screen that is dark and quiet with one beautiful light in it beats a screen full of things happening.
- **Motion sells it.** Easing, drift, trails, a light that breathes. Static is the enemy of this art direction more than low detail is.

## The starting slice

`src/scenes/BootScene.ts` is a vertical slice, not a contract: it proves Light2D, particles, input and the reveal loop work together, and it exists so nobody spends round 1 on setup.

Replace it freely.
The only things you must keep are on this page.

Where the code is and how it fits together: [ARCHITECTURE.md](ARCHITECTURE.md).
