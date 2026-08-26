import assert from "node:assert/strict";
import test from "node:test";
import { advanceChain, CHAIN_CAP, CHAIN_WINDOW_MS, emptyChain, expireChain, resetChain } from "../src/chain.ts";

test("five consecutive pickups release exactly one bounded reward", () => {
  let state = emptyChain();
  for (let index = 0; index < CHAIN_CAP; index += 1) {
    const result = advanceChain(state, index * 500);
    state = result.state;
    assert.equal(result.released, index === CHAIN_CAP - 1);
  }
  assert.equal(state.count, CHAIN_CAP);
  assert.equal(state.waves, 1);

  const extension = advanceChain(state, 2800);
  assert.equal(extension.released, false);
  assert.equal(extension.state.count, CHAIN_CAP);
  assert.equal(extension.state.waves, 1);
});

test("expiry starts a new chain and makes a later cap eligible", () => {
  let state = advanceChain(emptyChain(), 100).state;
  state = advanceChain(state, 400).state;
  state = expireChain(state, 400 + CHAIN_WINDOW_MS + 1);
  assert.deepEqual(state, emptyChain());

  const next = advanceChain(state, 5000);
  assert.equal(next.state.count, 1);
  assert.equal(next.released, false);
});

test("damage clears progress and reward eligibility but preserves wave history", () => {
  let state = emptyChain();
  for (let index = 0; index < CHAIN_CAP; index += 1) state = advanceChain(state, index * 250).state;
  assert.equal(state.waves, 1);

  state = resetChain(state);
  assert.equal(state.count, 0);
  assert.equal(state.rewarded, false);
  assert.equal(state.waves, 1);

  let released = false;
  for (let index = 0; index < CHAIN_CAP; index += 1) {
    const result = advanceChain(state, 3000 + index * 250);
    state = result.state;
    released ||= result.released;
  }
  assert.equal(released, true);
  assert.equal(state.waves, 2);
});
