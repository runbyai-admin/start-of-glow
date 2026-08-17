import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#05060c",
  scale: {
    // Fixed design resolution, letterboxed. Deterministic layout keeps the
    // smoke-test screenshots comparable across machines and screen sizes.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
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
