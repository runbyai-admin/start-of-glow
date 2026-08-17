/** State the scene publishes for the smoke tests. See BootScene.reportState(). */
interface GlowTestState {
  ready: boolean;
  collected: number;
  remaining: number;
  glowRadius: number;
  lightsActive: boolean;
}

interface Window {
  __glow?: GlowTestState;
}
