/**
 * Level configuration: what changes between the three stages. Kept as plain
 * data so LevelScene stays one reusable scene instead of one class per level -
 * difficulty is a curve over these numbers, not new code per stage.
 *
 * A level may also carry a hand-authored `layout`. When present, mote
 * positions and hazard patrol loops come from it verbatim instead of the
 * seeded generator - the layout IS the level design, and the scene derives
 * every count from the data actually used (see LevelScene.buildMotes /
 * buildHazards), so the numeric fields can never drift out of sync with it.
 */

export interface LevelLayout {
  motes: Array<{ x: number; y: number }>;
  /** One waypoint loop per hazard; patrols cycle the loop at hazardSpeed. */
  hazards: Array<Array<{ x: number; y: number }>>;
}

export interface LevelConfig {
  /** 1-based, also the RNG seed so layouts are stable run to run. */
  index: number;
  name: string;
  moteCount: number;
  /**
   * How many motes open the beacon. The rest are optional: collecting every
   * last one earns the flawless variant (warmer beacon, fuller completion
   * run) instead of gating progress - the game's risk/reward decision.
   */
  requiredMotes: number;
  hazardCount: number;
  /** CSS px/second along each hazard's patrol path. */
  hazardSpeed: number;
  /** Sky seed, forest tint, and - for storm-dark - a real weather layer (see LevelScene.buildStorm). */
  mood: "dusk" | "deep-night" | "storm-dark";
  layout?: LevelLayout;
}

/**
 * Level 1, hand-composed rather than seeded: the judged first minute looks at
 * this space. Reading left to right (start x=220, beacon x=2202):
 * - an opening arc of four safe motes teaches collection in the first seconds;
 * - a lone vertical sentry patrols the midfield gap at x=900, so the player
 *   *sees* the threat crossing their path before they must cross it;
 * - one greedy mote sits just below the sentry's turnaround - the first
 *   optional risk;
 * - a calm mid-glade breathes, then a second hazard circles the beacon
 *   approach with two greedy motes inside its circuit and a safe low road
 *   under it.
 * Nine motes are safely reachable, two more need one timed lane-crossing,
 * three sit in guarded pockets; ten open the beacon, so a careful player
 * clears without ever braving a pocket and a flawless run braves both.
 */
const LEVEL_1_LAYOUT: LevelLayout = {
  motes: [
    // opening arc - safe, rising toward the first treeline
    { x: 330, y: 430 },
    { x: 430, y: 355 },
    { x: 545, y: 305 },
    { x: 665, y: 290 },
    // a dip toward the sentry lane - still safe, sets up the crossing
    { x: 780, y: 510 },
    // just past the lane, high and low - crossing the patrol is the lesson
    { x: 990, y: 240 },
    { x: 1010, y: 540 },
    // greed pocket A - just below the sentry's lowest turnaround
    { x: 900, y: 635 },
    // mid glade - safe breathers along a gentle S
    { x: 1160, y: 380 },
    { x: 1320, y: 300 },
    { x: 1520, y: 430 },
    // greed pocket B - inside the beacon-approach circuit
    { x: 1985, y: 415 },
    { x: 2090, y: 295 },
    // the safe low road under the beacon
    { x: 2280, y: 585 },
  ],
  hazards: [
    // the sentry: a pure vertical lane guarding the midfield gap
    [
      { x: 900, y: 160 },
      { x: 900, y: 600 },
      { x: 900, y: 380 },
    ],
    // the circuit: a broad triangle in front of the beacon approach
    [
      { x: 1880, y: 240 },
      { x: 2120, y: 480 },
      { x: 1760, y: 490 },
    ],
  ],
};

/**
 * Level 2 is the first place a careful route should become deliberate, not
 * arbitrary. The old seeded layout sometimes sent the cautious path through a
 * shadow near world (955, 241) on a repeat loop. This composed layout keeps a
 * broad S of thirteen motes at least 200px from every patrol segment, ending at
 * the beacon, while five optional motes sit inside the four shadow pockets.
 * The safe route teaches reading lanes; the pockets keep greed dangerous.
 */
export const LEVEL_2_LAYOUT: LevelLayout = {
  motes: [
    // Safe corridor: low through the first half, then rising toward the beacon.
    { x: 340, y: 450 },
    { x: 480, y: 500 },
    { x: 620, y: 520 },
    { x: 780, y: 490 },
    { x: 900, y: 400 },
    { x: 1040, y: 340 },
    { x: 1180, y: 300 },
    { x: 1320, y: 320 },
    { x: 1480, y: 380 },
    { x: 1640, y: 420 },
    { x: 1800, y: 380 },
    { x: 1980, y: 290 },
    { x: 2180, y: 270 },
    // Optional pockets: one or two pieces of light inside each patrol.
    { x: 640, y: 150 },
    { x: 1120, y: 600 },
    { x: 1550, y: 145 },
    { x: 1710, y: 150 },
    { x: 2100, y: 580 },
  ],
  hazards: [
    [
      { x: 480, y: 110 },
      { x: 800, y: 120 },
      { x: 640, y: 220 },
    ],
    [
      { x: 980, y: 630 },
      { x: 1340, y: 630 },
      { x: 1150, y: 560 },
    ],
    [
      { x: 1430, y: 90 },
      { x: 1820, y: 100 },
      { x: 1620, y: 205 },
    ],
    [
      { x: 1840, y: 630 },
      { x: 2310, y: 620 },
      { x: 2100, y: 510 },
    ],
  ],
};

/**
 * Level 3 turns the reach economy into terrain. Three pairs of fast shadows
 * close the middle of the forest. The first sixteen motes take the long safe
 * route below, above, then below those gates; six shortcut motes sit directly
 * inside them. A full reach can buy dangerous light across a gate and shorten
 * the trip. A spent reach has to take the visible way around.
 */
export const LEVEL_3_LAYOUT: LevelLayout = {
  motes: [
    // Required detour: below gate one, above gate two, below gate three.
    { x: 280, y: 600 },
    { x: 420, y: 620 },
    { x: 580, y: 600 },
    { x: 700, y: 600 },
    { x: 800, y: 600 },
    { x: 800, y: 120 },
    { x: 900, y: 120 },
    { x: 1020, y: 120 },
    { x: 1150, y: 100 },
    { x: 1280, y: 120 },
    { x: 1400, y: 120 },
    { x: 1500, y: 120 },
    { x: 1500, y: 600 },
    { x: 1600, y: 600 },
    { x: 1800, y: 620 },
    { x: 2180, y: 600 },
    // Paid shortcuts: visible inside the paired patrols, safe only at range.
    { x: 420, y: 340 },
    { x: 500, y: 380 },
    { x: 1120, y: 340 },
    { x: 1200, y: 380 },
    { x: 1820, y: 340 },
    { x: 1900, y: 380 },
  ],
  hazards: [
    [
      { x: 300, y: 320 },
      { x: 600, y: 320 },
      { x: 450, y: 390 },
    ],
    [
      { x: 320, y: 400 },
      { x: 580, y: 400 },
      { x: 450, y: 330 },
    ],
    [
      { x: 1000, y: 320 },
      { x: 1300, y: 320 },
      { x: 1150, y: 390 },
    ],
    [
      { x: 1020, y: 400 },
      { x: 1280, y: 400 },
      { x: 1150, y: 330 },
    ],
    [
      { x: 1700, y: 320 },
      { x: 1990, y: 320 },
      { x: 1850, y: 390 },
    ],
    [
      { x: 1720, y: 400 },
      { x: 1970, y: 400 },
      { x: 1850, y: 330 },
    ],
  ],
};

export const LEVELS: LevelConfig[] = [
  {
    index: 1,
    name: "The Edge of the Dark",
    moteCount: 14,
    requiredMotes: 10,
    hazardCount: 2,
    hazardSpeed: 70,
    mood: "dusk",
    layout: LEVEL_1_LAYOUT,
  },
  {
    index: 2,
    name: "Where the Trees Close In",
    moteCount: 18,
    requiredMotes: 13,
    hazardCount: 4,
    hazardSpeed: 95,
    mood: "deep-night",
    layout: LEVEL_2_LAYOUT,
  },
  {
    index: 3,
    name: "The Last Clearing",
    moteCount: 22,
    requiredMotes: 16,
    hazardCount: 6,
    hazardSpeed: 120,
    mood: "storm-dark",
    layout: LEVEL_3_LAYOUT,
  },
];

export function levelFor(index: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.index === index);
}
