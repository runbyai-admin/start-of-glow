import assert from "node:assert/strict";
import test from "node:test";
import {
  REACH_MAX,
  REACH_MIN,
  REACH_READY,
  reachReadiness,
  reachReady,
  restoreReach,
  spendReach,
} from "../src/reach.ts";

test("a pull spends a full glow and cannot immediately buy itself back", () => {
  let reach = spendReach(REACH_MAX);
  assert.equal(reach, REACH_MIN);
  assert.equal(reachReady(reach), false);

  for (let mote = 0; mote < 4; mote += 1) reach = restoreReach(reach, "gathered");
  assert.equal(reach, REACH_MIN + 40);
  assert.equal(reachReady(reach), false);
});

test("five touched motes rekindle a four-mote pull", () => {
  let reach = spendReach(REACH_MAX);
  for (let mote = 0; mote < 4; mote += 1) reach = restoreReach(reach, "gathered");
  for (let mote = 0; mote < 4; mote += 1) reach = restoreReach(reach, "touched");
  assert.equal(reachReady(reach), false);

  reach = restoreReach(reach, "touched");
  assert.equal(reach, REACH_READY);
  assert.equal(reachReady(reach), true);
  assert.equal(reachReadiness(reach), 1);
});

test("reach restoration remains bounded", () => {
  assert.equal(restoreReach(REACH_MAX, "touched"), REACH_MAX);
  assert.equal(reachReadiness(REACH_MIN), 0);
});
