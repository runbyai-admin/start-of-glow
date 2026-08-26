import Phaser from "phaser";
import { makeGlowTexture, makeSkyTexture } from "../textures";
import { Ambience } from "../audio";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./dimensions";

const ambience = new Ambience();
const MENU_SPEED = 360;
const MENU_COLLECT_RADIUS = 42;

/**
 * The title screen is the first small clearing, not a wall before the game.
 * Moving the pointer or using arrows/WASD steers the wisp through five motes;
 * click/touch, Enter or Space begins immediately. The preview uses the same
 * gather -> chain -> radiance language as the level without delaying play.
 */
export class MenuScene extends Phaser.Scene {
  private wisp!: Phaser.GameObjects.Image;
  private wispLight!: Phaser.GameObjects.Light;
  private target = new Phaser.Math.Vector2(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.62);
  private motes: Phaser.GameObjects.Image[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private mechanicLine!: Phaser.GameObjects.Text;
  private collected = 0;
  private begun = false;

  constructor() {
    super("menu");
  }

  preload(): void {
    makeSkyTexture(this, "sky", VIEW_WIDTH, VIEW_HEIGHT, 11);
    makeGlowTexture(this, "wisp", 85, "rgba(255,255,255,1)", "rgba(150,214,255,0.55)");
    makeGlowTexture(this, "mote", 27, "rgba(255,244,214,1)", "rgba(255,196,92,0.5)");
    makeGlowTexture(this, "spark", 16, "rgba(255,255,255,0.9)", "rgba(190,226,255,0.35)");
  }

  create(): void {
    this.begun = false;
    this.collected = 0;
    this.motes = [];
    this.target.set(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.62);
    this.lights.enable().setAmbientColor(0x0a0d18);
    this.cameras.main.setBackgroundColor(0x05060c);
    this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "sky").setDepth(-100);

    const positions = [
      [390, 430], [500, 390], [640, 420], [780, 380], [890, 430],
    ];
    positions.forEach(([x, y], index) => {
      const mote = this.add.image(x, y, "mote").setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(5);
      this.tweens.add({
        targets: mote,
        y: y - 10 - index * 2,
        alpha: { from: 0.5, to: 0.95 },
        duration: 1450 + index * 120,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.motes.push(mote);
    });

    this.wisp = this.add.image(this.target.x, this.target.y, "wisp")
      .setBlendMode(Phaser.BlendModes.ADD).setScale(0.62).setDepth(10);
    this.wispLight = this.lights.addLight(this.wisp.x, this.wisp.y, 420, 0xbfe4ff, 1.7);

    const title = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.27, "START OF GLOW", {
      fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "58px", color: "#f2ead8", letterSpacing: 6,
    }).setOrigin(0.5).setAlpha(0).setDepth(20);
    this.tweens.add({ targets: title, alpha: 1, duration: 1100, ease: "Sine.easeOut" });

    this.mechanicLine = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.72, "gather light", {
      fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "18px", color: "#b8c8df", letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.38).setDepth(20);

    const begin = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.82, "BEGIN", {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "18px", color: "#e7dcc2", letterSpacing: 4,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: begin, alpha: { from: 0.55, to: 1 }, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.begun) this.target.set(pointer.x, pointer.y);
    });
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.begin());
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.input.keyboard!.on("keydown-ENTER", () => this.begin());
    this.input.keyboard!.on("keydown-SPACE", () => this.begin());

    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      document.body.dataset.gameReady = "true";
      this.reportState();
    });
  }

  update(time: number, delta: number): void {
    if (this.begun) return;
    const step = MENU_SPEED * delta / 1000;
    if (this.cursors.left.isDown || this.wasd.left.isDown) this.target.x -= step;
    if (this.cursors.right.isDown || this.wasd.right.isDown) this.target.x += step;
    if (this.cursors.up.isDown || this.wasd.up.isDown) this.target.y -= step;
    if (this.cursors.down.isDown || this.wasd.down.isDown) this.target.y += step;
    this.target.x = Phaser.Math.Clamp(this.target.x, 80, VIEW_WIDTH - 80);
    this.target.y = Phaser.Math.Clamp(this.target.y, 350, VIEW_HEIGHT - 120);
    const ease = 1 - Math.pow(0.002, delta / 1000);
    this.wisp.x = Phaser.Math.Linear(this.wisp.x, this.target.x, ease);
    this.wisp.y = Phaser.Math.Linear(this.wisp.y, this.target.y, ease);
    this.wispLight.setPosition(this.wisp.x, this.wisp.y);
    this.wispLight.intensity = 1.7 + Math.sin(time * 0.0009) * 0.22 + this.collected * 0.08;
    this.collectNearbyMotes();
    this.reportState();
  }

  private collectNearbyMotes(): void {
    for (let index = this.motes.length - 1; index >= 0; index -= 1) {
      const mote = this.motes[index];
      if (Phaser.Math.Distance.Between(mote.x, mote.y, this.wisp.x, this.wisp.y) > MENU_COLLECT_RADIUS) continue;
      this.motes.splice(index, 1);
      this.tweens.killTweensOf(mote);
      this.collected += 1;
      ambience.chime(this.collected, this.collected);
      this.cameras.main.shake(70, 0.0012);
      this.tweens.add({
        targets: mote, x: this.wisp.x, y: this.wisp.y, scale: 0.08, alpha: 0, duration: 180,
        ease: "Quad.easeIn", onComplete: () => mote.destroy(),
      });
      this.wispLight.radius = 420 + this.collected * 24;
      const lines = ["gather light", "keep the chain", "wake the beacon"];
      this.mechanicLine.setText(lines[Math.min(2, Math.floor(this.collected / 2))]);
      this.tweens.add({ targets: this.mechanicLine, alpha: { from: 0.95, to: 0.38 }, duration: 850 });
      const ring = this.add.circle(this.wisp.x, this.wisp.y, 24, 0xffdfa0, 0).setStrokeStyle(3, 0xffdfa0, 0.8).setDepth(9);
      this.tweens.add({ targets: ring, radius: 55 + this.collected * 7, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    }
  }

  private begin(): void {
    if (this.begun) return;
    this.begun = true;
    ambience.unlock();
    this.cameras.main.fadeOut(280, 5, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("level", { levelIndex: 1, ambience });
    });
  }

  private reportState(): void {
    window.__glow = {
      ready: true, scene: "menu", collected: this.collected, remaining: this.motes.length,
      glowRadius: this.wispLight.radius, lightsActive: this.lights.active, level: 0, resets: 0,
      required: 0, beaconOpen: false, flawless: 0, wispX: Math.round(this.wisp.x), wispY: Math.round(this.wisp.y),
      motes: this.motes.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y) })), hazards: [],
      chain: this.collected, chainRemainingMs: 0, radianceWaves: 0, slowedHazards: 0,
    };
  }
}
