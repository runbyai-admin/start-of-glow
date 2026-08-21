import Phaser from "phaser";
import {
  makeGlowTexture,
  makeGroundTexture,
  makeHazardTexture,
  makeHillsTexture,
  makeSkyTexture,
  makeTreeTexture,
} from "../textures";
import type { Ambience } from "../audio";
import { levelFor, LEVELS, type LevelConfig } from "../levels";
import { VIEW_HEIGHT, VIEW_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from "./dimensions";

const COLLECT_RADIUS = 45;
const HAZARD_RADIUS = 34;
const BEACON_RADIUS = 90;
const BEACON_X = WORLD_WIDTH * 0.86;
const BEACON_Y = WORLD_HEIGHT * 0.34;
const START_X = 220;
const START_Y = WORLD_HEIGHT * 0.62;
const RESPAWN_GRACE_MS = 1100;
const TREE_COUNT = 14;
const FIREFLY_COUNT = 11;

interface LevelInitData {
  levelIndex: number;
  ambience: Ambience;
  resets?: number;
}

/** Cosmetic per-mood tint - purely a palette shift between stages, same shapes. */
const MOOD_TINT: Record<LevelConfig["mood"], { tree: number[]; ground: number; hillsTint: number }> = {
  dusk: { tree: [0x1b2438, 0x161d2e, 0x141a2a], ground: 0x10151f, hillsTint: 0x0d1526 },
  "deep-night": { tree: [0x141a2c, 0x101624, 0x0e1220], ground: 0x0b0f18, hillsTint: 0x0a0f1e },
  "storm-dark": { tree: [0x171226, 0x120e1e, 0x0f0c1a], ground: 0x0d0a16, hillsTint: 0x120c22 },
};

/**
 * The reusable stage. One scene, driven entirely by LevelConfig data (see
 * src/levels.ts) - three levels means three configs, not three classes.
 * Everything from BootScene's original slice (Light2D, parallax, the
 * breathing light, ambience) lives here, plus the structure the game was
 * missing after round 1: a real goal (the beacon), a real threat (hazards),
 * and a fail state that costs the player something (this level's progress).
 */
export class LevelScene extends Phaser.Scene {
  private config!: LevelConfig;
  private ambience!: Ambience;
  private resets = 0;

  private wisp!: Phaser.GameObjects.Image;
  private wispLight!: Phaser.GameObjects.Light;
  private beacon!: Phaser.GameObjects.Image;
  private beaconLight!: Phaser.GameObjects.Light;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hazardTrail!: Phaser.GameObjects.Particles.ParticleEmitter;

  private moteConfigs: Array<{ x: number; y: number }> = [];
  private motes: Phaser.GameObjects.Image[] = [];
  private hazards: Array<{ img: Phaser.GameObjects.Image; light: Phaser.GameObjects.Light }> = [];

  private hud!: Phaser.GameObjects.Text;
  private levelCard!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private target = new Phaser.Math.Vector2(START_X, START_Y);

  private collected = 0;
  private pulseBoost = 0;
  private levelClear = false;
  private locked = false;
  private graceUntil = 0;

  constructor() {
    super("level");
  }

  init(data: LevelInitData): void {
    this.config = levelFor(data.levelIndex) ?? LEVELS[0];
    this.ambience = data.ambience;
    this.resets = data.resets ?? 0;
    this.collected = 0;
    this.pulseBoost = 0;
    this.levelClear = false;
    this.locked = false;
    this.moteConfigs = [];
    this.motes = [];
    this.hazards = [];
    this.target.set(START_X, START_Y);
  }

  preload(): void {
    makeGlowTexture(this, "wisp", 85, "rgba(255,255,255,1)", "rgba(150,214,255,0.55)");
    makeGlowTexture(this, "mote", 27, "rgba(255,244,214,1)", "rgba(255,196,92,0.5)");
    makeGlowTexture(this, "spark", 16, "rgba(255,255,255,0.9)", "rgba(190,226,255,0.35)");
    makeGlowTexture(this, "firefly", 12, "rgba(226,255,196,1)", "rgba(198,255,130,0.4)");
    makeGlowTexture(this, "beacon", 170, "rgba(255,226,168,1)", "rgba(255,182,102,0.4)");
    makeGlowTexture(this, "shadow-spark", 10, "rgba(150,110,220,0.85)", "rgba(90,50,150,0.3)");
    makeHazardTexture(this, "hazard", 30, this.config.index * 97);
    makeSkyTexture(this, "sky", VIEW_WIDTH, VIEW_HEIGHT, 11);
    makeHillsTexture(this, "hills", 1760, 260, 3);
    makeGroundTexture(this, "ground", WORLD_WIDTH, 240, 7);
    for (let i = 0; i < 4; i += 1) {
      makeTreeTexture(this, `tree-${i}`, 240, 560, i + 1);
    }
  }

  create(): void {
    this.lights.enable().setAmbientColor(0x0a0d18);
    this.cameras.main.setBackgroundColor(0x05060c);

    this.buildSky();
    this.buildHills();
    this.buildForest();
    this.buildBeacon();
    this.buildFireflies();
    this.buildMotes();
    this.buildWisp();
    this.buildHazards();
    this.buildCamera();
    this.buildVignette();
    this.buildHud();
    this.bindInput();

    this.graceUntil = this.time.now + RESPAWN_GRACE_MS;
    this.cameras.main.fadeIn(420, 5, 6, 12);
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => this.announceReady());
  }

  private buildSky(): void {
    this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "sky").setScrollFactor(0).setDepth(-100);
  }

  private buildHills(): void {
    const tint = MOOD_TINT[this.config.mood].hillsTint;
    this.add.image(0, WORLD_HEIGHT - 150, "hills").setOrigin(0, 1).setTint(tint).setScrollFactor(0.25).setDepth(-40);
  }

  private buildForest(): void {
    const rng = new Phaser.Math.RandomDataGenerator([`start-of-glow-trees-${this.config.index}`]);
    const tints = MOOD_TINT[this.config.mood].tree;
    for (let i = 0; i < TREE_COUNT; i += 1) {
      const x = 60 + (i / (TREE_COUNT - 1)) * (WORLD_WIDTH - 120) + rng.between(-45, 45);
      const tree = this.add
        .image(x, WORLD_HEIGHT - 120 + rng.between(-8, 8), `tree-${i % 4}`)
        .setOrigin(0.5, 1)
        .setScale(rng.realInRange(0.75, 1.3))
        .setTint(tints[rng.between(0, tints.length - 1)])
        .setDepth(-30);
      tree.setPipeline("Light2D");
    }

    const ground = this.add
      .image(0, WORLD_HEIGHT, "ground")
      .setOrigin(0, 1)
      .setTint(MOOD_TINT[this.config.mood].ground)
      .setDepth(-10);
    ground.setPipeline("Light2D");
  }

  /** Dark until every mote in the level is found - then it lights, and pulls the player in for the arrival. */
  private buildBeacon(): void {
    this.beacon = this.add.image(BEACON_X, BEACON_Y, "beacon").setBlendMode(Phaser.BlendModes.ADD).setDepth(-35).setAlpha(0.05);
    this.beaconLight = this.lights.addLight(BEACON_X, BEACON_Y, 260, 0xffcf8a, 0);
  }

  private buildFireflies(): void {
    const rng = new Phaser.Math.RandomDataGenerator([`start-of-glow-fireflies-${this.config.index}`]);
    for (let i = 0; i < FIREFLY_COUNT; i += 1) {
      const startX = rng.between(60, WORLD_WIDTH - 60);
      const startY = rng.between(180, WORLD_HEIGHT - 100);
      const firefly = this.add
        .image(startX, startY, "firefly")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0.75)
        .setScale(rng.realInRange(0.5, 1))
        .setAlpha(rng.realInRange(0.35, 0.8))
        .setDepth(-5);

      this.tweens.add({
        targets: firefly,
        x: startX + rng.between(-70, 70),
        y: startY + rng.between(-50, 50),
        duration: rng.between(3600, 6200),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: firefly,
        alpha: { from: firefly.alpha * 0.4, to: firefly.alpha },
        duration: rng.between(900, 1700),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: rng.between(0, 800),
      });
    }
  }

  private buildMotes(): void {
    const rng = new Phaser.Math.RandomDataGenerator([`start-of-glow-${this.config.index}`]);
    const near = Math.ceil(this.config.moteCount / 2);
    for (let i = 0; i < this.config.moteCount; i += 1) {
      const x = i < near ? rng.between(80, VIEW_WIDTH - 80) : rng.between(VIEW_WIDTH + 40, WORLD_WIDTH - 80);
      this.moteConfigs.push({ x, y: rng.between(140, WORLD_HEIGHT - 160) });
    }
    this.spawnMotes();
  }

  private spawnMotes(): void {
    for (const m of this.motes) {
      this.tweens.killTweensOf(m);
      m.destroy();
    }
    this.motes = [];
    const rng = new Phaser.Math.RandomDataGenerator([`start-of-glow-motes-${this.config.index}`]);
    for (const cfg of this.moteConfigs) {
      const mote = this.add.image(cfg.x, cfg.y, "mote").setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setDepth(5);
      this.tweens.add({
        targets: mote,
        y: cfg.y - rng.between(8, 21),
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
      emitZone: { type: "random", source: new Phaser.Geom.Circle(0, 0, 19), quantity: 1 },
    });
    this.trail.setDepth(9);

    this.wisp = this.add.image(this.target.x, this.target.y, "wisp").setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(10);
    this.wispLight = this.lights.addLight(this.wisp.x, this.wisp.y, 347, 0xbfe4ff, 1.6);
    this.trail.startFollow(this.wisp);
  }

  /**
   * Shadow-wisps: the thing the light is not. Each patrols a small loop of
   * waypoints (deterministic per level+index) at the level's hazardSpeed.
   * Touching one snuffs the player's light and resets the level's progress -
   * see fail(). They carry a dim cold light of their own, not because a real
   * shadow would, but because a threat the player cannot see coming in a
   * game about darkness is cheap, not hard.
   */
  private buildHazards(): void {
    const trailEmitter = this.add.particles(0, 0, "shadow-spark", {
      speed: { min: 4, max: 16 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.5, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      frequency: 70,
      quantity: 1,
    });
    trailEmitter.setDepth(8);
    this.hazardTrail = trailEmitter;

    const rng = new Phaser.Math.RandomDataGenerator([`start-of-glow-hazards-${this.config.index}`]);
    for (let i = 0; i < this.config.hazardCount; i += 1) {
      const img = this.add.image(0, 0, "hazard").setDepth(6).setScale(rng.realInRange(0.85, 1.15));
      const light = this.lights.addLight(0, 0, 130, 0x9a6efa, 0.9);
      this.hazards.push({ img, light });

      const waypoints: Phaser.Math.Vector2[] = [];
      const legs = 3;
      for (let w = 0; w < legs; w += 1) {
        waypoints.push(
          new Phaser.Math.Vector2(rng.between(340, WORLD_WIDTH - 100), rng.between(120, WORLD_HEIGHT - 140)),
        );
      }
      img.setPosition(waypoints[0].x, waypoints[0].y);
      light.setPosition(waypoints[0].x, waypoints[0].y);
      this.patrol(img, light, waypoints, 0);
    }
  }

  private patrol(
    img: Phaser.GameObjects.Image,
    light: Phaser.GameObjects.Light,
    waypoints: Phaser.Math.Vector2[],
    index: number,
  ): void {
    const next = waypoints[(index + 1) % waypoints.length];
    const dist = Phaser.Math.Distance.Between(img.x, img.y, next.x, next.y);
    const duration = (dist / this.config.hazardSpeed) * 1000;
    this.tweens.add({
      targets: img,
      x: next.x,
      y: next.y,
      duration,
      ease: "Sine.easeInOut",
      onUpdate: () => light.setPosition(img.x, img.y),
      onComplete: () => {
        if (!img.active) return;
        this.patrol(img, light, waypoints, index + 1);
      },
    });
  }

  private buildCamera(): void {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.wisp, false, 0.09, 0.09);
  }

  private buildVignette(): void {
    const width = VIEW_WIDTH;
    const height = VIEW_HEIGHT;
    const key = "vignette";
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, width, height);
      const ctx = texture!.getContext();
      const cx = width / 2;
      const cy = height / 2;
      const gradient = ctx.createRadialGradient(cx, cy, Math.min(width, height) * 0.32, cx, cy, Math.max(width, height) * 0.72);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.78)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      texture!.refresh();
    }
    this.add.image(width / 2, height / 2, key).setScrollFactor(0).setDepth(90);
  }

  private buildHud(): void {
    this.hud = this.add
      .text(27, 24, "", {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "17px",
        color: "#7e93b8",
      })
      .setAlpha(0.85)
      .setDepth(100)
      .setScrollFactor(0);

    this.levelCard = this.add
      .text(VIEW_WIDTH / 2, 46, `${this.config.index} · ${this.config.name}`, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "20px",
        color: "#e7dcc2",
      })
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setDepth(100)
      .setScrollFactor(0);
    this.tweens.add({
      targets: this.levelCard,
      alpha: { from: 0, to: 0.9 },
      duration: 900,
      yoyo: true,
      hold: 1400,
      ease: "Sine.easeInOut",
    });

    this.updateHud();
  }

  private bindInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.locked) return;
      this.target.set(pointer.worldX, pointer.worldY);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.ambience.unlock();
      if (this.locked) return;
      this.target.set(pointer.worldX, pointer.worldY);
      this.pulse();
    });
    this.cursors = this.input.keyboard!.createCursorKeys();
  }

  private pulse(): void {
    this.pulseBoost = 1.6;
    this.trail.explode(24, this.wisp.x, this.wisp.y);
  }

  private baseIntensity(): number {
    return 1.6 + this.collected * 0.06;
  }

  update(time: number, delta: number): void {
    if (this.locked) return;

    const step = (delta / 1000) * 347;
    if (this.cursors.left.isDown) this.target.x -= step;
    if (this.cursors.right.isDown) this.target.x += step;
    if (this.cursors.up.isDown) this.target.y -= step;
    if (this.cursors.down.isDown) this.target.y += step;
    this.target.x = Phaser.Math.Clamp(this.target.x, 27, WORLD_WIDTH - 27);
    this.target.y = Phaser.Math.Clamp(this.target.y, 27, WORLD_HEIGHT - 27);

    const t = 1 - Math.pow(0.002, delta / 1000);
    this.wisp.x = Phaser.Math.Linear(this.wisp.x, this.target.x, t);
    this.wisp.y = Phaser.Math.Linear(this.wisp.y, this.target.y, t);
    this.wispLight.setPosition(this.wisp.x, this.wisp.y);
    this.hazardTrail.setPosition(0, 0);

    const breathe = Math.sin(time * 0.0007) * 0.12;
    this.pulseBoost = Phaser.Math.Linear(this.pulseBoost, 0, 1 - Math.pow(0.001, delta / 1000));
    this.wispLight.intensity = this.baseIntensity() + breathe + this.pulseBoost;

    for (const h of this.hazards) {
      this.hazardTrail.emitParticleAt(h.img.x, h.img.y, 1);
    }

    if (time > this.graceUntil) {
      this.checkHazardCollisions();
    }
    this.collectNearbyMotes();
    if (this.levelClear) {
      this.checkBeaconArrival();
    }
  }

  private checkHazardCollisions(): void {
    for (const h of this.hazards) {
      if (Phaser.Math.Distance.Between(h.img.x, h.img.y, this.wisp.x, this.wisp.y) <= HAZARD_RADIUS) {
        this.fail();
        return;
      }
    }
  }

  private collectNearbyMotes(): void {
    for (let i = this.motes.length - 1; i >= 0; i -= 1) {
      const mote = this.motes[i];
      if (Phaser.Math.Distance.Between(mote.x, mote.y, this.wisp.x, this.wisp.y) > COLLECT_RADIUS) continue;
      this.motes.splice(i, 1);
      this.tweens.killTweensOf(mote);
      this.trail.explode(18, mote.x, mote.y);
      mote.destroy();
      this.collected += 1;
      this.ambience.chime(this.collected);
      this.grow();
    }
  }

  private grow(): void {
    this.wispLight.radius = 347 + this.collected * 20;
    this.wisp.setScale(0.5 + this.collected * 0.018);

    const progress = Phaser.Math.Clamp(this.collected / this.config.moteCount, 0, 1);
    this.beacon.setAlpha(0.05 + progress * 0.8);
    this.beaconLight.intensity = progress * 1.4;

    if (this.collected >= this.config.moteCount && !this.levelClear) {
      this.levelClear = true;
      this.tweens.add({
        targets: [this.beacon],
        scale: { from: 1, to: 1.12 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    this.updateHud();
    this.reportState();
  }

  private checkBeaconArrival(): void {
    if (this.locked) return;
    if (Phaser.Math.Distance.Between(this.wisp.x, this.wisp.y, BEACON_X, BEACON_Y) <= BEACON_RADIUS) {
      this.completeLevel();
    }
  }

  /** The player touched a shadow-wisp: snuff the light, lose this level's progress, try again. */
  /**
   * A tween with no real target is Phaser's reliable way to run "wait N ms,
   * then do X" inside a scene - this.time.delayedCall shares the Scene's
   * Clock with everything else here and, empirically, doesn't fire
   * reliably under every host this build runs on, where tween onComplete
   * always does. Every other timed handoff in this scene (fail's reset,
   * the settle before a hit registers again) goes through this helper
   * instead, for the same reason.
   */
  private after(ms: number, onComplete: () => void): void {
    this.tweens.add({ targets: {}, duration: ms, onComplete });
  }

  private fail(): void {
    this.locked = true;
    this.resets += 1;
    this.ambience.hit();
    this.cameras.main.flash(220, 40, 10, 60);
    this.cameras.main.shake(220, 0.006);

    this.tweens.add({
      targets: this.wispLight,
      intensity: 0.05,
      radius: 90,
      duration: 260,
      ease: "Quad.easeIn",
    });
    this.wisp.setScale(0.2);

    this.after(560, () => {
      this.target.set(START_X, START_Y);
      this.wisp.setPosition(START_X, START_Y);
      this.wispLight.setPosition(START_X, START_Y);
      this.wisp.setScale(0.5);
      this.collected = 0;
      this.levelClear = false;
      this.beacon.setAlpha(0.05);
      this.beaconLight.intensity = 0;
      this.tweens.killTweensOf(this.beacon);
      this.beacon.setScale(1);
      this.spawnMotes();
      this.updateHud();
      this.reportState();
      this.graceUntil = this.time.now + RESPAWN_GRACE_MS;
      this.locked = false;
    });
  }

  private completeLevel(): void {
    this.locked = true;
    this.ambience.levelComplete();
    this.cameras.main.flash(280, 255, 232, 190);
    this.cameras.main.fadeOut(520, 8, 7, 14);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const next = this.config.index + 1;
      if (levelFor(next)) {
        this.scene.start("level", { levelIndex: next, ambience: this.ambience, resets: this.resets });
      } else {
        this.scene.start("ending", { ambience: this.ambience, resets: this.resets });
      }
    });
  }

  private updateHud(): void {
    this.hud.setText(
      `LEVEL ${this.config.index}/${LEVELS.length}   motes ${this.collected}/${this.config.moteCount}   resets ${this.resets}`,
    );
  }

  private announceReady(): void {
    document.body.dataset.gameReady = "true";
    this.reportState();
  }

  private reportState(): void {
    window.__glow = {
      ready: true,
      scene: "level",
      collected: this.collected,
      remaining: this.motes.length,
      glowRadius: this.wispLight.radius,
      lightsActive: this.lights.active,
      level: this.config.index,
      resets: this.resets,
    };
  }
}
