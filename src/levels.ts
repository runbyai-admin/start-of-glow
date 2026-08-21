/**
 * Level configuration: what changes between the three stages. Kept as plain
 * data so LevelScene stays one reusable scene instead of one class per level -
 * difficulty is a curve over these numbers, not new code per stage.
 */

export interface LevelConfig {
  /** 1-based, also the RNG seed so layouts are stable run to run. */
  index: number;
  name: string;
  moteCount: number;
  hazardCount: number;
  /** CSS px/second along each hazard's patrol path. */
  hazardSpeed: number;
  /** How ambitious the sky's star seed and forest tint should feel - purely cosmetic variation between stages. */
  mood: "dusk" | "deep-night" | "storm-dark";
}

export const LEVELS: LevelConfig[] = [
  { index: 1, name: "The Edge of the Dark", moteCount: 14, hazardCount: 2, hazardSpeed: 70, mood: "dusk" },
  { index: 2, name: "Where the Trees Close In", moteCount: 18, hazardCount: 4, hazardSpeed: 95, mood: "deep-night" },
  { index: 3, name: "The Last Clearing", moteCount: 22, hazardCount: 6, hazardSpeed: 120, mood: "storm-dark" },
];

export function levelFor(index: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.index === index);
}
