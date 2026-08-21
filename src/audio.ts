/**
 * Minimal Web Audio ambience and effects. No samples anywhere - everything
 * here is oscillators and a runtime-generated noise buffer, so it is "made by
 * you" per SPEC.md's synth path, not a downloaded sound effect.
 *
 * Browsers block audio until a user gesture, so the context is created lazily
 * in unlock(). Every entry point is wrapped in try/catch - atmosphere sound
 * must never throw into the game loop, the console, or a headless browser
 * that refuses audio entirely.
 */

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const w = window as WebkitWindow;
      const Ctx = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.startDrone(ctx, master);
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  /** Three detuned sines through a lowpass, breathing via a slow gain LFO. */
  private startDrone(ctx: AudioContext, master: GainNode): void {
    try {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;

      const drone = ctx.createGain();
      drone.gain.value = 0.07;
      drone.connect(filter);
      filter.connect(master);

      const partials: Array<[frequency: number, gain: number]> = [
        [55, 0.5],
        [82.5, 0.24],
        [110, 0.16],
      ];
      for (const [frequency, gain] of partials) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency;
        const g = ctx.createGain();
        g.gain.value = gain;
        osc.connect(g);
        g.connect(drone);
        osc.start();
      }

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.055;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.045;
      lfo.connect(lfoGain);
      lfoGain.connect(drone.gain);
      lfo.start();
    } catch {
      /* the drone is atmosphere, never a requirement */
    }
  }

  /** A short bell, pitch stepping through a small pentatonic set per pickup. */
  chime(step: number): void {
    if (!this.ctx || !this.master) return;
    try {
      const ctx = this.ctx;
      const master = this.master;
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
      const freq = scale[step % scale.length];
      const now = ctx.currentTime;

      const body = ctx.createOscillator();
      body.type = "sine";
      body.frequency.value = freq;
      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      const partial = ctx.createOscillator();
      partial.type = "sine";
      partial.frequency.value = freq * 2;
      const partialGain = ctx.createGain();
      partialGain.gain.setValueAtTime(0.0001, now);
      partialGain.gain.linearRampToValueAtTime(0.05, now + 0.02);
      partialGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      body.connect(bodyGain);
      partial.connect(partialGain);
      bodyGain.connect(master);
      partialGain.connect(master);

      body.start(now);
      body.stop(now + 0.95);
      partial.start(now);
      partial.stop(now + 0.65);
    } catch {
      /* a missed chime is not a game-breaking error */
    }
  }

  /**
   * A snuffed-light thud: a short burst of filtered noise plus a falling,
   * dissonant low interval. The noise is a runtime-generated buffer of
   * random values - synthesized in code, not a downloaded sound effect.
   */
  hit(): void {
    if (!this.ctx || !this.master) return;
    try {
      const ctx = this.ctx;
      const master = this.master;
      const now = ctx.currentTime;

      const bufferSize = Math.floor(ctx.sampleRate * 0.3);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(900, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 0.28);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(now);

      for (const freq of [98, 92.5]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.4);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      /* a missed hit sound is not a game-breaking error */
    }
  }

  /** A quick rising arpeggio - the level-complete payoff. */
  levelComplete(): void {
    if (!this.ctx || !this.master) return;
    try {
      const ctx = this.ctx;
      const master = this.master;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const start = now + i * 0.09;
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.75);
      });
    } catch {
      /* atmosphere only */
    }
  }

  /** A long, warm sustained chord - the ending's arrival. */
  ending(): void {
    if (!this.ctx || !this.master) return;
    try {
      const ctx = this.ctx;
      const master = this.master;
      const now = ctx.currentTime;
      const chord = [261.63, 329.63, 392.0, 523.25];
      for (const freq of chord) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 2.2);
        gain.gain.linearRampToValueAtTime(0, now + 7);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 7.1);
      }
    } catch {
      /* atmosphere only */
    }
  }
}
