import assert from "node:assert/strict";
import test from "node:test";
import { LEVEL_2_LAYOUT, LEVEL_3_LAYOUT, type LevelLayout } from "../src/levels.ts";

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function orientation(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function distanceBetweenSegments(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): number {
  const crosses = orientation(a, b, c) * orientation(a, b, d) <= 0
    && orientation(c, d, a) * orientation(c, d, b) <= 0;
  if (crosses) return 0;
  return Math.min(
    distanceToSegment(a, c, d),
    distanceToSegment(b, c, d),
    distanceToSegment(c, a, b),
    distanceToSegment(d, a, b),
  );
}

function assertRouteContract(
  layout: LevelLayout,
  safeCount: number,
  riskyCount: number,
  hazardCount: number,
): void {
  assert.equal(layout.motes.length, safeCount + riskyCount);
  assert.equal(layout.hazards.length, hazardCount);

  const safe = layout.motes.slice(0, safeCount);
  for (const [index, start] of safe.slice(0, -1).entries()) {
    const end = safe[index + 1];
    const clearance = Math.min(
      ...layout.hazards.flatMap((loop) =>
        loop.map((hazardStart, waypoint) =>
          distanceBetweenSegments(start, end, hazardStart, loop[(waypoint + 1) % loop.length]),
        ),
      ),
    );
    assert.ok(clearance >= 200, `safe link ${index + 1}-${index + 2} has only ${clearance.toFixed(1)}px clearance`);
  }

  const risky = layout.motes.slice(safeCount).filter((mote) =>
    layout.hazards.some((loop) =>
      loop.some((start, waypoint) => distanceToSegment(mote, start, loop[(waypoint + 1) % loop.length]) < 90),
    ),
  );
  assert.equal(risky.length, riskyCount);
}

test("level 2 has a thirteen-mote safe corridor and five shadow-pocket choices", () => {
  assertRouteContract(LEVEL_2_LAYOUT, 13, 5, 4);
});

test("level 3 has a sixteen-mote safe clearing and six storm-pocket choices", () => {
  assertRouteContract(LEVEL_3_LAYOUT, 16, 6, 6);
});
