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

/**
 * The night sky: a near-black vertical gradient with a faint indigo lift near
 * the horizon, scattered with still stars. Drawn once at full viewport size
 * and held fixed on screen (scrollFactor 0) - real skies don't parallax.
 */
export function makeSkyTexture(scene: Phaser.Scene, key: string, width: number, height: number, seed: number): void {
  makeCanvasTexture(scene, key, width, height, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#05060c");
    gradient.addColorStop(0.55, "#070a14");
    gradient.addColorStop(1, "#0d1526");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const rng = new Phaser.Math.RandomDataGenerator([String(seed)]);
    const starCount = Math.round((width * height) / 5200);
    for (let i = 0; i < starCount; i += 1) {
      const x = rng.between(0, width);
      const y = rng.between(0, height * 0.75);
      const r = rng.realInRange(0.4, 1.5);
      ctx.globalAlpha = rng.realInRange(0.18, 0.75);
      ctx.fillStyle = i % 5 === 0 ? "#bfe4ff" : "#f2f6ff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

/** A distant, gently rolling silhouette ridge - sits behind the trees. */
export function makeHillsTexture(scene: Phaser.Scene, key: string, width: number, height: number, seed: number): void {
  makeCanvasTexture(scene, key, width, height, (ctx) => {
    const rng = new Phaser.Math.RandomDataGenerator([String(seed)]);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height * 0.6);
    const steps = 9;
    let prevY = height * 0.6;
    for (let i = 1; i <= steps; i += 1) {
      const x = (width / steps) * i;
      // Small deltas from the previous point keep the ridge gentle and
      // rolling instead of the jagged silhouette the ground uses.
      const y = Phaser.Math.Clamp(prevY + rng.realInRange(-height * 0.14, height * 0.14), height * 0.25, height * 0.65);
      const midX = x - width / steps / 2;
      ctx.quadraticCurveTo(midX, prevY, x, y);
      prevY = y;
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  });
}

/**
 * A shadow-creature: an irregular dark blob (not a circle - the wisp already
 * owns "perfect radial glow", so the hazard needs to read as a different kind
 * of thing at a glance) with a thin cold rim light. The rim is what the
 * player actually sees coming in the dark; the fill is near-black so it never
 * competes with the wisp's warmth for attention.
 */
export function makeHazardTexture(scene: Phaser.Scene, key: string, radius: number, seed: number): void {
  const size = radius * 2;
  makeCanvasTexture(scene, key, size, size, (ctx) => {
    const rng = new Phaser.Math.RandomDataGenerator([String(seed)]);
    const cx = radius;
    const cy = radius;

    // Irregular blob outline: a ring of points at varying radii, splined.
    const points = 9;
    const coords: Array<[number, number]> = [];
    for (let i = 0; i < points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      const r = radius * rng.realInRange(0.62, 0.98);
      coords.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }

    const rim = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
    rim.addColorStop(0, "rgba(30,16,46,0.92)");
    rim.addColorStop(0.75, "rgba(64,34,96,0.55)");
    rim.addColorStop(1, "rgba(120,80,190,0)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.moveTo(coords[0][0], coords[0][1]);
    for (let i = 1; i <= points; i += 1) {
      const [x, y] = coords[i % points];
      const [px, py] = coords[i - 1];
      ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(150,110,220,0.5)";
    ctx.lineWidth = Math.max(1, radius * 0.05);
    ctx.stroke();
  });
}
