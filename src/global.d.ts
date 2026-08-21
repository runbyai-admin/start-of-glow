/** State the active scene publishes for the smoke tests. See each scene's reportState(). */
interface GlowTestState {
  ready: boolean;
  scene: "menu" | "level" | "ending";
  collected: number;
  remaining: number;
  glowRadius: number;
  lightsActive: boolean;
  /** 0 outside a level (menu/ending), otherwise the 1-based level index. */
  level: number;
  /** How many times a hazard has snuffed the player's light this run. */
  resets: number;
}

interface Window {
  __glow?: GlowTestState;
}
