import Phaser from "phaser";
import { MenuScene } from "./scenes/MenuScene";
import { LevelScene } from "./scenes/LevelScene";
import { EndingScene } from "./scenes/EndingScene";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./scenes/dimensions";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#05060c",
  scale: {
    // Fixed 1280x720 design resolution, letterboxed - mandated by SPEC.md.
    // Deterministic layout keeps the smoke-test screenshots comparable across
    // machines, and 720p is a clean source for the recorded judging sessions.
    // A level's own WORLD can be wider than this and scroll under a camera -
    // see dimensions.ts - but the rendered viewport never changes size.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  },
  render: {
    antialias: true,
    // Light2D needs WebGL; Phaser.AUTO falls back to Canvas on machines
    // without it, where the scene degrades to flat silhouettes rather than
    // failing outright.
    pixelArt: false,
  },
  scene: [MenuScene, LevelScene, EndingScene],
};

new Phaser.Game(config);
