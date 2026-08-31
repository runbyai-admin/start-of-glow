/**
 * Round notes: the judge-facing "what changed this round" panel.
 *
 * Every build ships `round-notes.json` (in `public/`) with its round number and
 * 4-5 one-liners saying what this round changed. A small badge sits in the
 * corner of the page; clicking it (or pressing N) opens the list. The owner
 * reads it before playing, so a round's work never has to be guessed at from
 * the diff or the feel alone.
 *
 * Owner-maintained judging infrastructure, like replay.ts - contestants own
 * the JSON, not this module. It is DOM-only, outside the Phaser canvas, so it
 * never appears in replay captures or smoke screenshots, and every failure
 * path is silent: a missing or malformed file just means no badge.
 * `npm run check` is what enforces the file's shape.
 */

interface RoundNotes {
  round: number;
  notes: string[];
}

const BADGE_ID = "round-notes-badge";

function parse(raw: unknown): RoundNotes | null {
  if (typeof raw !== "object" || raw === null) return null;
  const round = (raw as { round?: unknown }).round;
  const notes = (raw as { notes?: unknown }).notes;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 1) return null;
  if (!Array.isArray(notes)) return null;
  const clean = notes.filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  if (clean.length === 0) return null;
  return { round, notes: clean };
}

export async function installRoundNotes(): Promise<void> {
  if (document.getElementById(BADGE_ID)) return;

  let data: RoundNotes | null = null;
  try {
    // Relative to the page URL, so the same build works at /glow/, /glow/<ai>/
    // and a local preview alike.
    const res = await fetch("round-notes.json", { cache: "no-cache" });
    if (!res.ok) return;
    data = parse(await res.json());
  } catch {
    return;
  }
  if (!data) return;

  const badge = document.createElement("button");
  badge.id = BADGE_ID;
  badge.type = "button";
  badge.textContent = `round ${data.round} · what changed`;
  badge.setAttribute("aria-expanded", "false");
  badge.style.cssText = [
    "position:fixed",
    "right:12px",
    "bottom:10px",
    "z-index:40",
    "font:12px/1 system-ui,sans-serif",
    "letter-spacing:0.04em",
    "color:rgba(255,221,163,0.55)",
    "background:rgba(5,6,12,0.72)",
    "border:1px solid rgba(255,221,163,0.18)",
    "border-radius:6px",
    "padding:6px 10px",
    "cursor:pointer",
  ].join(";");

  const panel = document.createElement("div");
  panel.hidden = true;
  panel.style.cssText = [
    "position:fixed",
    "right:12px",
    "bottom:42px",
    "z-index:40",
    "max-width:min(440px,calc(100vw - 24px))",
    "font:13px/1.55 system-ui,sans-serif",
    "color:rgba(255,232,196,0.92)",
    "background:rgba(5,6,12,0.92)",
    "border:1px solid rgba(255,221,163,0.22)",
    "border-radius:8px",
    "padding:12px 16px",
  ].join(";");
  const list = document.createElement("ul");
  list.style.cssText = "margin:0;padding-left:18px";
  for (const note of data.notes) {
    const li = document.createElement("li");
    li.textContent = note;
    li.style.marginBottom = "4px";
    list.append(li);
  }
  panel.append(list);

  const toggle = (): void => {
    panel.hidden = !panel.hidden;
    badge.setAttribute("aria-expanded", String(!panel.hidden));
  };
  badge.addEventListener("click", toggle);
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "n" && !e.repeat) toggle();
  });

  document.body.append(badge, panel);
}
