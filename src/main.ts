import Phaser from "phaser";
import { BootScene, WORLD_HEIGHT, WORLD_WIDTH } from "./scenes/BootScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#05060c",
  scale: {
    // Fixed 1280x720 design resolution, letterboxed - mandated by SPEC.md.
    // Deterministic layout keeps the smoke-test screenshots comparable across
    // machines, and 720p is a clean source for the recorded judging sessions.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  },
  render: {
    antialias: true,
    // Light2D needs WebGL; Phaser.AUTO falls back to Canvas on machines
    // without it, where the scene degrades to flat silhouettes rather than
    // failing outright.
    pixelArt: false,
  },
  scene: [BootScene],
};

new Phaser.Game(config);
