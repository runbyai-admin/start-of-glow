export const CHAIN_CAP = 5;
export const CHAIN_WINDOW_MS = 4000;
export const CHAIN_START_LEVEL = 3;

/** Keep the opening pull lesson free of a second resource/timer. */
export function chainActiveForLevel(level: number): boolean {
  return level >= CHAIN_START_LEVEL;
}

export interface ChainState {
  count: number;
  deadline: number;
  rewarded: boolean;
  waves: number;
}

export interface ChainAdvance {
  state: ChainState;
  released: boolean;
}

export function emptyChain(waves = 0): ChainState {
  return { count: 0, deadline: 0, rewarded: false, waves };
}

/** Advance one pickup. A capped live chain can extend, but never rewards twice. */
export function advanceChain(current: ChainState, now: number): ChainAdvance {
  const continuing = current.count > 0 && now <= current.deadline;
  const count = continuing ? Math.min(CHAIN_CAP, current.count + 1) : 1;
  const alreadyRewarded = continuing && current.rewarded;
  const released = count === CHAIN_CAP && !alreadyRewarded;
  return {
    released,
    state: {
      count,
      deadline: now + CHAIN_WINDOW_MS,
      rewarded: alreadyRewarded || released,
      waves: current.waves + (released ? 1 : 0),
    },
  };
}

/** Expiry and damage both clear the live chain without erasing level wave history. */
export function resetChain(current: ChainState): ChainState {
  return emptyChain(current.waves);
}

export function expireChain(current: ChainState, now: number): ChainState {
  return current.count > 0 && now > current.deadline ? resetChain(current) : current;
}
