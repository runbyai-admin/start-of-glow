import assert from "node:assert/strict";
import test from "node:test";
import { LEVEL_2_LAYOUT } from "../src/levels.ts";

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

test("level 2 has a thirteen-mote safe corridor and five shadow-pocket choices", () => {
  assert.equal(LEVEL_2_LAYOUT.motes.length, 18);
  assert.equal(LEVEL_2_LAYOUT.hazards.length, 4);

  for (const [index, mote] of LEVEL_2_LAYOUT.motes.slice(0, 13).entries()) {
    const clearance = Math.min(
      ...LEVEL_2_LAYOUT.hazards.flatMap((loop) =>
        loop.map((start, waypoint) => distanceToSegment(mote, start, loop[(waypoint + 1) % loop.length])),
      ),
    );
    assert.ok(clearance >= 200, `safe mote ${index + 1} has only ${clearance.toFixed(1)}px clearance`);
  }

  const risky = LEVEL_2_LAYOUT.motes.slice(13).filter((mote) =>
    LEVEL_2_LAYOUT.hazards.some((loop) =>
      loop.some((start, waypoint) => distanceToSegment(mote, start, loop[(waypoint + 1) % loop.length]) < 90),
    ),
  );
  assert.equal(risky.length, 5);
});
