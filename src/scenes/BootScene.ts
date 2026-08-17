import Phaser from "phaser";
import { makeGlowTexture, makeGroundTexture, makeTreeTexture } from "../textures";

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;

const MOTE_COUNT = 12;
const COLLECT_RADIUS = 34;

/**
 * BootScene is the vertical slice the game-off starts from: it proves the
 * Light2D pipeline, the particle layer, and pointer/keyboard input all work
 * together. Replace or extend it - it is a starting point, not a contract.
 */
export class BootScene extends Phaser.Scene {
  private wisp!: Phaser.GameObjects.Image;
  private wispLight!: Phaser.GameObjects.Light;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes: Phaser.GameObjects.Image[] = [];
  private hud!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private target = new Phaser.Math.Vector2(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.6);
  private collected = 0;

  constructor() {
    super("boot");
  }

  preload(): void {
    makeGlowTexture(this, "wisp", 64, "rgba(255,255,255,1)", "rgba(150,214,255,0.55)");
    makeGlowTexture(this, "mote", 20, "rgba(255,244,214,1)", "rgba(255,196,92,0.5)");
    makeGlowTexture(this, "spark", 12, "rgba(255,255,255,0.9)", "rgba(190,226,255,0.35)");
    makeGroundTexture(this, "ground", WORLD_WIDTH, 180, 7);
    for (let i = 0; i < 4; i += 1) {
      makeTreeTexture(this, `tree-${i}`, 180, 420, i + 1);
    }
  }

  create(): void {
    this.lights.enable().setAmbientColor(0x0a0d18);

    this.buildBackdrop();
    this.buildMotes();
    this.buildWisp();
    this.buildHud();
    this.bindInput();

    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => this.announceReady());
  }

  /** Silhouette forest, lit only by the wisp. Everything here is Light2D. */
  private buildBackdrop(): void {
    const layers: Array<{ key: string; x: number; scale: number; tint: number; depth: number }> = [
      { key: "tree-0", x: 120, scale: 1.1, tint: 0x1b2438, depth: -30 },
      { key: "tree-1", x: 360, scale: 0.85, tint: 0x161d2e, depth: -30 },
      { key: "tree-2", x: 640, scale: 1.25, tint: 0x1b2438, depth: -30 },
      { key: "tree-3", x: 870, scale: 0.95, tint: 0x141a2a, depth: -30 },
    ];

    for (const layer of layers) {
      const tree = this.add
        .image(layer.x, WORLD_HEIGHT - 90, layer.key)
        .setOrigin(0.5, 1)
        .setScale(layer.scale)
        .setTint(layer.tint)
        .setDepth(layer.depth);
      tree.setPipeline("Light2D");
    }

    const ground = this.add
      .image(0, WORLD_HEIGHT, "ground")
      .setOrigin(0, 1)
      .setTint(0x10151f)
      .setDepth(-10);
    ground.setPipeline("Light2D");
  }

  private buildMotes(): void {
    const rng = new Phaser.Math.RandomDataGenerator(["start-of-glow"]);
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const mote = this.add
        .image(rng.between(60, WORLD_WIDTH - 60), rng.between(90, WORLD_HEIGHT - 120), "mote")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.55)
        .setDepth(5);
      this.tweens.add({
        targets: mote,
        y: mote.y - rng.between(6, 16),
        alpha: { from: 0.55, to: 1 },
        duration: rng.between(1200, 2200),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.motes.push(mote);
    }
  }

  private buildWisp(): void {
    this.trail = this.add.particles(0, 0, "spark", {
      speed: { min: 6, max: 30 },
      lifespan: { min: 500, max: 1100 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.55, end: 0 },
      tint: [0xffffff, 0x9fd8ff, 0xffe6a8],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 40,
      quantity: 1,
      // Emit around the wisp rather than dead centre, so the trail reads as a
      // shimmer instead of piling into one saturated blob.
      emitZone: {
        type: "random",
        source: new Phaser.Geom.Circle(0, 0, 14),
        quantity: 1,
      },
    });
    this.trail.setDepth(9);

    this.wisp = this.add
      .image(this.target.x, this.target.y, "wisp")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5)
      .setDepth(10);

    this.wispLight = this.lights.addLight(this.wisp.x, this.wisp.y, 260, 0xbfe4ff, 1.6);
    this.trail.startFollow(this.wisp);
  }

  private buildHud(): void {
    this.hud = this.add
      .text(20, 18, "", {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "14px",
        color: "#7e93b8",
      })
      .setDepth(100)
      .setScrollFactor(0);
    this.updateHud();
  }

  private bindInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.target.set(pointer.worldX, pointer.worldY);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.target.set(pointer.worldX, pointer.worldY);
      this.pulse();
    });
    this.cursors = this.input.keyboard!.createCursorKeys();
  }

  /** A double-bright flash - the "I am here" gesture, and an input smoke signal. */
  private pulse(): void {
    this.tweens.add({
      targets: this.wispLight,
      intensity: { from: 3.2, to: this.baseIntensity() },
      duration: 420,
      ease: "Quad.easeOut",
    });
    this.trail.explode(24, this.wisp.x, this.wisp.y);
  }

  private baseIntensity(): number {
    return 1.6 + this.collected * 0.08;
  }

  update(_time: number, delta: number): void {
    const step = (delta / 1000) * 260;
    if (this.cursors.left.isDown) this.target.x -= step;
    if (this.cursors.right.isDown) this.target.x += step;
    if (this.cursors.up.isDown) this.target.y -= step;
    if (this.cursors.down.isDown) this.target.y += step;
    this.target.x = Phaser.Math.Clamp(this.target.x, 20, WORLD_WIDTH - 20);
    this.target.y = Phaser.Math.Clamp(this.target.y, 20, WORLD_HEIGHT - 20);

    const t = 1 - Math.pow(0.002, delta / 1000);
    this.wisp.x = Phaser.Math.Linear(this.wisp.x, this.target.x, t);
    this.wisp.y = Phaser.Math.Linear(this.wisp.y, this.target.y, t);
    this.wispLight.setPosition(this.wisp.x, this.wisp.y);

    this.collectNearbyMotes();
  }

  private collectNearbyMotes(): void {
    for (let i = this.motes.length - 1; i >= 0; i -= 1) {
      const mote = this.motes[i];
      if (Phaser.Math.Distance.Between(mote.x, mote.y, this.wisp.x, this.wisp.y) > COLLECT_RADIUS) {
        continue;
      }
      this.motes.splice(i, 1);
      this.tweens.killTweensOf(mote);
      this.trail.explode(18, mote.x, mote.y);
      mote.destroy();
      this.collected += 1;
      this.grow();
    }
  }

  /** The world reveals as the glow grows: bigger radius, brighter light. */
  private grow(): void {
    this.wispLight.radius = 260 + this.collected * 26;
    this.wispLight.intensity = this.baseIntensity();
    this.wisp.setScale(0.5 + this.collected * 0.025);
    this.updateHud();
    this.reportState();
  }

  private updateHud(): void {
    const total = MOTE_COUNT;
    this.hud.setText(
      `START OF GLOW   motes ${this.collected}/${total}   glow ${Math.round(this.wispLight?.radius ?? 260)}`,
    );
  }

  private announceReady(): void {
    document.body.dataset.gameReady = "true";
    this.reportState();
  }

  /** Test hook. Keep it in sync when the scene's state changes shape. */
  private reportState(): void {
    window.__glow = {
      ready: true,
      collected: this.collected,
      remaining: this.motes.length,
      glowRadius: this.wispLight.radius,
      lightsActive: this.lights.active,
    };
  }
}
