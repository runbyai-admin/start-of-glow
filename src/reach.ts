/**
 * The pull's one resource. A full glow can reach; reaching burns it down.
 * Light carried in by the pull gives a small return, while light the player
 * physically moves through rekindles the glow. That makes "press or travel"
 * a choice instead of letting one successful press immediately buy the next.
 */
export const REACH_MIN = 170;
export const REACH_MAX = 470;
/** The champion's authored opening radius; enough light to pay for one pull. */
export const REACH_READY = 390;
export const REACH_START = REACH_READY;
export const REACH_PER_GATHERED_MOTE = 10;
export const REACH_PER_TOUCHED_MOTE = 36;

export type MoteArrival = "gathered" | "touched";

export function reachReady(reach: number): boolean {
  return reach >= REACH_READY;
}

export function reachReadiness(reach: number): number {
  return Math.max(0, Math.min(1, (reach - REACH_MIN) / (REACH_READY - REACH_MIN)));
}

export function spendReach(_reach: number): number {
  return REACH_MIN;
}

export function restoreReach(reach: number, arrival: MoteArrival): number {
  const restored = arrival === "touched" ? REACH_PER_TOUCHED_MOTE : REACH_PER_GATHERED_MOTE;
  return Math.max(REACH_MIN, Math.min(REACH_MAX, reach + restored));
}
