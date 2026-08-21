import Phaser from "phaser";
import { makeGlowTexture, makeSkyTexture } from "../textures";
import { Ambience } from "../audio";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./dimensions";

const ambience = new Ambience();

/**
 * The title screen. Deliberately thin - SPEC.md's feel notes warn that a menu
 * wall spends the part of the round that decides it, so this is atmosphere
 * with a title on it, not a menu with buttons: any input at all starts the
 * game. It shares the Ambience instance with LevelScene/EndingScene (module
 * singleton) so unlocking audio here keeps working after the scene changes.
 */
export class MenuScene extends Phaser.Scene {
  private wisp!: Phaser.GameObjects.Image;
  private wispLight!: Phaser.GameObjects.Light;

  constructor() {
    super("menu");
  }

  preload(): void {
    makeSkyTexture(this, "sky", VIEW_WIDTH, VIEW_HEIGHT, 11);
    makeGlowTexture(this, "wisp", 85, "rgba(255,255,255,1)", "rgba(150,214,255,0.55)");
  }

  create(): void {
    this.lights.enable().setAmbientColor(0x0a0d18);
    this.cameras.main.setBackgroundColor(0x05060c);

    this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "sky").setDepth(-100);

    this.wisp = this.add
      .image(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.62, "wisp")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.62)
      .setDepth(10);
    this.wispLight = this.lights.addLight(this.wisp.x, this.wisp.y, 420, 0xbfe4ff, 1.7);

    this.tweens.add({
      targets: this.wisp,
      y: this.wisp.y - 22,
      duration: 3400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const title = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.32, "START OF GLOW", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "58px",
        color: "#f2ead8",
        letterSpacing: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);
    this.tweens.add({ targets: title, alpha: 1, duration: 1400, ease: "Sine.easeOut" });

    const prompt = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.78, "touch, click, or press any key to begin", {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "16px",
        color: "#7e93b8",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0.35, to: 0.85 },
      duration: 1600,
      delay: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.begin());
    this.input.keyboard!.once("keydown", () => this.begin());

    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      document.body.dataset.gameReady = "true";
      this.reportState();
    });
  }

  update(time: number): void {
    const breathe = Math.sin(time * 0.0009) * 0.25;
    this.wispLight.intensity = 1.7 + breathe;
    this.wispLight.setPosition(this.wisp.x, this.wisp.y);
  }

  private begin(): void {
    ambience.unlock();
    this.cameras.main.fadeOut(360, 5, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("level", { levelIndex: 1, ambience });
    });
  }

  private reportState(): void {
    window.__glow = {
      ready: true,
      scene: "menu",
      collected: 0,
      remaining: 0,
      glowRadius: this.wispLight.radius,
      lightsActive: this.lights.active,
      level: 0,
      resets: 0,
    };
  }
}
