import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error plain-JS module without type declarations
import { compile, KEYS, VIEW } from "../scripts/play-dsl.mjs";

test("wait advances the cursor and emits nothing", () => {
  const { actions, endFrame } = compile("wait 2s", 0);
  assert.equal(endFrame, 120);
  assert.deepEqual(actions, {});
});

test("frame durations work and verbs run sequentially from the start frame", () => {
  const { actions, endFrame } = compile("wait 30f; press Enter", 600);
  assert.equal(endFrame, 636);
  assert.deepEqual(actions["630"], [{ type: "keydown", key: "Enter" }]);
  assert.deepEqual(actions["633"], [{ type: "keyup", key: "Enter" }]);
});

test("hold presses multiple keys for the whole duration", () => {
  const { actions, endFrame } = compile("hold ArrowRight+ArrowUp 1s", 0);
  assert.equal(endFrame, 60);
  assert.deepEqual(
    actions["0"].map((a: { type: string; key: string }) => [a.type, a.key]),
    [
      ["keydown", "ArrowRight"],
      ["keydown", "ArrowUp"],
    ],
  );
  assert.deepEqual(
    actions["60"].map((a: { type: string; key: string }) => [a.type, a.key]),
    [
      ["keyup", "ArrowRight"],
      ["keyup", "ArrowUp"],
    ],
  );
});

test("Space is accepted as a spelling of the space key", () => {
  const { actions } = compile("press Space", 0);
  assert.equal(actions["0"][0].key, " ");
  assert.ok(KEYS.has(" "));
});

test("tap is move, down, up at the same point", () => {
  const { actions, endFrame } = compile("tap 640 360", 0);
  assert.equal(endFrame, 6);
  assert.deepEqual(actions["0"], [{ type: "pointermove", x: 640, y: 360 }]);
  assert.deepEqual(actions["1"], [{ type: "pointerdown", x: 640, y: 360 }]);
  assert.deepEqual(actions["3"], [{ type: "pointerup", x: 640, y: 360 }]);
});

test("drag interpolates between the endpoints and releases at the end", () => {
  const { actions, endFrame } = compile("drag 100 100 200 200 10f", 0);
  assert.equal(endFrame, 10);
  assert.deepEqual(
    actions["0"].map((a: { type: string }) => a.type),
    ["pointermove", "pointerdown"],
  );
  assert.deepEqual(actions["4"], [{ type: "pointermove", x: 140, y: 140 }]);
  const last = actions["10"];
  assert.deepEqual(last[last.length - 1], { type: "pointerup", x: 200, y: 200 });
});

test("bad input is refused with the verb named", () => {
  assert.throws(() => compile("fly 1s", 0), /unknown verb "fly"/);
  assert.throws(() => compile("press CapsLock", 0), /unknown key "CapsLock"/);
  assert.throws(() => compile(`tap ${VIEW.w + 1} 10`, 0), /outside 0\.\.1280/);
  assert.throws(() => compile("hold ArrowLeft 0f", 0), /under one frame/);
  assert.throws(() => compile("", 0), /empty program/);
});
