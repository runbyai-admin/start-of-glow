import Phaser from "phaser";

/**
 * Every texture in this repo is generated at runtime.
 * The spec forbids downloaded sprite packs, so shapes are drawn with the
 * canvas API into Phaser textures at boot.
 */

function makeCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`could not create canvas texture "${key}"`);
  const ctx = texture.getContext();
  draw(ctx);
  texture.refresh();
}

/** Soft radial glow - the light-being itself, and its motes. */
export function makeGlowTexture(
  scene: Phaser.Scene,
  key: string,
  radius: number,
  core: string,
  edge: string,
): void {
  const size = radius * 2;
  makeCanvasTexture(scene, key, size, size, (ctx) => {
    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, core);
    gradient.addColorStop(0.35, edge);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * A tree silhouette: a tapering trunk with a few branches. Drawn white so the
 * Light2D pipeline can tint and light it; the scene applies the dark tint.
 */
export function makeTreeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  seed: number,
): void {
  makeCanvasTexture(scene, key, width, height, (ctx) => {
    const rng = new Phaser.Math.RandomDataGenerator([String(seed)]);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";

    const baseX = width / 2;
    ctx.beginPath();
    ctx.moveTo(baseX - width * 0.16, height);
    ctx.quadraticCurveTo(baseX - width * 0.06, height * 0.4, baseX - width * 0.04, 0);
    ctx.lineTo(baseX + width * 0.04, 0);
    ctx.quadraticCurveTo(baseX + width * 0.06, height * 0.4, baseX + width * 0.16, height);
    ctx.closePath();
    ctx.fill();

    const branches = rng.between(3, 5);
    for (let i = 0; i < branches; i += 1) {
      const y = height * (0.15 + 0.6 * (i / branches));
      const dir = i % 2 === 0 ? -1 : 1;
      const len = width * rng.realInRange(0.25, 0.45);
      ctx.lineWidth = Math.max(2, width * 0.05 * (1 - i / branches));
      ctx.beginPath();
      ctx.moveTo(baseX, y);
      ctx.quadraticCurveTo(baseX + dir * len * 0.6, y - len * 0.25, baseX + dir * len, y - len * 0.7);
      ctx.stroke();
    }
  });
}

/** A lumpy ground ridge, used as the foreground silhouette band. */
export function makeGroundTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  seed: number,
): void {
  makeCanvasTexture(scene, key, width, height, (ctx) => {
    const rng = new Phaser.Math.RandomDataGenerator([String(seed)]);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height * 0.6);
    const steps = 12;
    for (let i = 1; i <= steps; i += 1) {
      const x = (width / steps) * i;
      const y = height * rng.realInRange(0.35, 0.75);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  });
}
