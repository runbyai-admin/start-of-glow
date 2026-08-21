import Phaser from "phaser";
import { makeGlowTexture, makeSkyTexture } from "../textures";
import type { Ambience } from "../audio";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./dimensions";

interface EndingInitData {
  ambience: Ambience;
  resets: number;
}

/**
 * The payoff for finishing the last level: the thing the whole game has been
 * building - light growing until it fills the frame - happens one final time,
 * at full scale, uninterrupted. Wordless except for one short line, per
 * SPEC.md's "text is a fallback, not a feature."
 */
export class EndingScene extends Phaser.Scene {
  private ambience!: Ambience;
  private resets = 0;

  constructor() {
    super("ending");
  }

  init(data: EndingInitData): void {
    this.ambience = data.ambience;
    this.resets = data.resets ?? 0;
  }

  preload(): void {
    makeSkyTexture(this, "sky", VIEW_WIDTH, VIEW_HEIGHT, 11);
    makeGlowTexture(this, "wisp", 85, "rgba(255,255,255,1)", "rgba(150,214,255,0.55)");
  }

  create(): void {
    this.lights.enable().setAmbientColor(0x0a0d18);
    this.cameras.main.setBackgroundColor(0x05060c);

    this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "sky").setDepth(-100);

    const wisp = this.add
      .image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "wisp")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5)
      .setDepth(10);
    const light = this.lights.addLight(wisp.x, wisp.y, 300, 0xffe6bf, 1.4);

    this.ambience.ending();

    this.tweens.add({
      targets: wisp,
      scale: 5.5,
      duration: 4200,
      ease: "Sine.easeOut",
    });
    this.tweens.add({
      targets: light,
      intensity: 3.4,
      radius: 1400,
      duration: 4200,
      ease: "Sine.easeOut",
    });

    const line = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.8, "the forest remembers the light", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "24px",
        color: "#2a2013",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);
    this.tweens.add({ targets: line, alpha: 0.75, duration: 1400, delay: 2400, ease: "Sine.easeOut" });

    const resetsLine = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.87, this.resets > 0 ? `the dark caught you ${this.resets} time${this.resets === 1 ? "" : "s"} on the way here` : "not once did the dark catch you", {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "14px",
        color: "#3a2f1c",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);
    this.tweens.add({ targets: resetsLine, alpha: 0.6, duration: 1400, delay: 2700, ease: "Sine.easeOut" });

    const prompt = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.94, "press to begin again", {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "13px",
        color: "#3a2f1c",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0.25, to: 0.55 },
      duration: 1600,
      delay: 3600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // A target-less tween is this codebase's "wait N ms" - see LevelScene's
    // `after()` for why this.time.delayedCall is avoided here.
    this.tweens.add({
      targets: {},
      duration: 3600,
      onComplete: () => {
        this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.restart());
        this.input.keyboard!.once("keydown", () => this.restart());
      },
    });

    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      document.body.dataset.gameReady = "true";
      this.reportState(light);
    });
  }

  private restart(): void {
    this.cameras.main.fadeOut(360, 5, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("menu");
    });
  }

  private reportState(light: Phaser.GameObjects.Light): void {
    window.__glow = {
      ready: true,
      scene: "ending",
      collected: 0,
      remaining: 0,
      glowRadius: light.radius,
      lightsActive: this.lights.active,
      level: 0,
      resets: this.resets,
    };
  }
}
