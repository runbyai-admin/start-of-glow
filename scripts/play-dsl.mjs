/**
 * The play driver's input DSL: small human verbs compiled to the frame-indexed
 * ReplayAction lists src/replay.ts consumes. Agents write "hold ArrowRight 2s;
 * tap 620 400", never hand-authored frame numbers.
 *
 * A program is verbs separated by ";" or newlines, executed sequentially from
 * a start frame. Coordinates are view coordinates (0..1280 x 0..720). A
 * duration is "2s" (seconds) or "30f" (frames); one frame is 1/60 s.
 *
 *   wait <dur>                       do nothing
 *   press <key>                      key down, up 3 frames later
 *   hold <key>[+<key>...] <dur>      keys down for the duration
 *   tap <x> <y>                      pointer move, down, up
 *   move <x> <y>                     pointer move only
 *   drag <x1> <y1> <x2> <y2> <dur>   pointer down, interpolated moves, up
 *
 * Pure module - no I/O - so tests/play-dsl.test.ts can cover it directly.
 */

export const VIEW = { w: 1280, h: 720 };

/** The keys src/replay.ts knows how to dispatch. "Space" is accepted for " ". */
export const KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " ", "w", "a", "s", "d"]);

const PRESS_HOLD_FRAMES = 3;
const PRESS_TOTAL_FRAMES = 6;
const TAP_TOTAL_FRAMES = 6;
const DRAG_MOVE_EVERY = 2;

function fail(verb, message) {
  throw new Error(`play dsl: ${message} (in "${verb}")`);
}

function parseDuration(raw, verb) {
  const m = /^(\d+(?:\.\d+)?)(s|f)$/.exec(raw ?? "");
  if (!m) fail(verb, `duration must be like "2s" or "30f", got "${raw}"`);
  const frames = m[2] === "s" ? Math.round(Number.parseFloat(m[1]) * 60) : Math.round(Number.parseFloat(m[1]));
  if (frames < 1) fail(verb, `duration "${raw}" is under one frame`);
  if (frames > 60 * 600) fail(verb, `duration "${raw}" is over ten minutes - split the session up`);
  return frames;
}

function parseKey(raw, verb) {
  const key = raw === "Space" ? " " : raw;
  if (!KEYS.has(key)) {
    fail(verb, `unknown key "${raw}" - have: ${[...KEYS].map((k) => (k === " " ? "Space" : k)).join(", ")}`);
  }
  return key;
}

function parseCoord(raw, max, verb) {
  const n = Number.parseFloat(raw ?? "");
  if (!Number.isFinite(n) || n < 0 || n > max) fail(verb, `coordinate "${raw}" is outside 0..${max}`);
  return Math.round(n);
}

/**
 * Compile a DSL program into { actions, endFrame }: a map of absolute frame
 * number -> ReplayAction[] starting at startFrame, and the frame the program
 * ends on (the session's next cursor).
 */
export function compile(program, startFrame = 0) {
  if (!Number.isInteger(startFrame) || startFrame < 0) throw new Error(`play dsl: bad start frame ${startFrame}`);
  const actions = {};
  const at = (frame, act) => {
    (actions[frame] ??= []).push(act);
  };
  let cursor = startFrame;

  const verbs = String(program)
    .split(/[;\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (verbs.length === 0) throw new Error("play dsl: empty program");

  for (const verb of verbs) {
    const parts = verb.split(/\s+/);
    const name = parts[0].toLowerCase();

    if (name === "wait") {
      if (parts.length !== 2) fail(verb, "wait takes one duration");
      cursor += parseDuration(parts[1], verb);
    } else if (name === "press") {
      if (parts.length !== 2) fail(verb, "press takes one key");
      const key = parseKey(parts[1], verb);
      at(cursor, { type: "keydown", key });
      at(cursor + PRESS_HOLD_FRAMES, { type: "keyup", key });
      cursor += PRESS_TOTAL_FRAMES;
    } else if (name === "hold") {
      if (parts.length !== 3) fail(verb, "hold takes keys and a duration");
      const keys = parts[1].split("+").map((k) => parseKey(k, verb));
      const frames = parseDuration(parts[2], verb);
      for (const key of keys) at(cursor, { type: "keydown", key });
      for (const key of keys) at(cursor + frames, { type: "keyup", key });
      cursor += frames;
    } else if (name === "tap") {
      if (parts.length !== 3) fail(verb, "tap takes x and y");
      const x = parseCoord(parts[1], VIEW.w, verb);
      const y = parseCoord(parts[2], VIEW.h, verb);
      at(cursor, { type: "pointermove", x, y });
      at(cursor + 1, { type: "pointerdown", x, y });
      at(cursor + 3, { type: "pointerup", x, y });
      cursor += TAP_TOTAL_FRAMES;
    } else if (name === "move") {
      if (parts.length !== 3) fail(verb, "move takes x and y");
      const x = parseCoord(parts[1], VIEW.w, verb);
      const y = parseCoord(parts[2], VIEW.h, verb);
      at(cursor, { type: "pointermove", x, y });
      cursor += 1;
    } else if (name === "drag") {
      if (parts.length !== 6) fail(verb, "drag takes x1 y1 x2 y2 and a duration");
      const x1 = parseCoord(parts[1], VIEW.w, verb);
      const y1 = parseCoord(parts[2], VIEW.h, verb);
      const x2 = parseCoord(parts[3], VIEW.w, verb);
      const y2 = parseCoord(parts[4], VIEW.h, verb);
      const frames = parseDuration(parts[5], verb);
      at(cursor, { type: "pointermove", x: x1, y: y1 });
      at(cursor, { type: "pointerdown", x: x1, y: y1 });
      for (let f = DRAG_MOVE_EVERY; f < frames; f += DRAG_MOVE_EVERY) {
        const t = f / frames;
        at(cursor + f, {
          type: "pointermove",
          x: Math.round(x1 + (x2 - x1) * t),
          y: Math.round(y1 + (y2 - y1) * t),
        });
      }
      at(cursor + frames, { type: "pointermove", x: x2, y: y2 });
      at(cursor + frames, { type: "pointerup", x: x2, y: y2 });
      cursor += frames;
    } else {
      fail(verb, `unknown verb "${name}" - have: wait, press, hold, tap, move, drag`);
    }
  }

  return { actions, endFrame: cursor };
}
