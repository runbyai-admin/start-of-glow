#!/usr/bin/env bash
# The consolidation pass: turn a banked winner into the base the next round
# starts from.
#
#   scripts/consolidate-round.sh <round> --losers          print what the two losers changed
#   scripts/consolidate-round.sh <round> [--dry-run]       check, commit, tag round-(N+1)-base, push
#
# A contestant spends its round on the game, not on documentation - the merge
# gate asks for `npm run check && npm test` and a play narrative, nothing more
# (RULES.md, "Banking the win"). The cost of that is a tree that accumulates
# dead code, retired probes and duplicated gate scripts, and docs that describe
# a codebase three rounds old. This pass pays it, on the owner's side, before
# anyone builds on the result.
#
# It is run by an owner-side operator pane, never by a contestant: the pane is
# neutral, sees all three forks, and is not competing in the next round.
#
# What the operator does by hand, in the working tree, before running this:
#
#   1. prune dead code, retired probes and duplicated gate scripts
#   2. keep one test suite green and honest (unit + smoke + replay personas)
#   3. rewrite ARCHITECTURE.md to describe the tree as it now is
#   4. write the "## Round N" CHANGELOG entry, with a "### What else was tried"
#      subsection folding what the two losing forks did (`--losers` prints them)
#
# What this script does: refuse anything half-done, run the gate, commit the
# pass, tag round-(N+1)-base and push. Round N+1 cannot open before that tag
# exists, which is what keeps the pass from being skipped.
set -euo pipefail

ORIG_PWD="$PWD"
cd "$(dirname "$0")/.."

ROUND="${1:-}"
shift 1 2>/dev/null || true

DRY_RUN=0
RUN_TESTS=1
LOSERS_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --losers) LOSERS_ONLY=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-tests) RUN_TESTS=0; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$ROUND" in ''|*[!0-9]*) echo "usage: scripts/consolidate-round.sh <round> [--losers] [--dry-run]" >&2; exit 2 ;; esac

NEXT=$((ROUND + 1))
WIN_TAG="round-$ROUND-winner"
NEXT_TAG="round-$NEXT-base"
PROVIDERS="claude openai grok"

refuse() { echo "REFUSED: $*" >&2; exit 1; }

WINNER=$(node -e '
const fs = require("node:fs");
const round = Number(process.argv[1]);
const d = JSON.parse(fs.readFileSync("ledger.json", "utf8"));
const r = (d.rounds ?? []).find((r) => r.round === round);
process.stdout.write(r?.winner ?? "");
' "$ROUND")

# --- what the losers tried ------------------------------------------------
if [ "$LOSERS_ONLY" = 1 ]; then
  [ -n "$WINNER" ] || echo "note: round $ROUND has no winner in ledger.json - printing all three forks" >&2
  for ai in $PROVIDERS; do
    [ "$ai" = "$WINNER" ] && continue
    echo "=== $ai ==="
    git fetch --quiet "$ai" 2>/dev/null || { echo "(cannot fetch the $ai remote)"; continue; }
    if git rev-parse -q --verify "$ai/main" >/dev/null; then
      entry=$(git show "$ai/main:CHANGELOG.md" 2>/dev/null \
        | awk -v r="$ROUND" 'BEGIN{IGNORECASE=1} /^## /{p = ($0 ~ "^## +[Rr]ound +" r "([^0-9]|$)")} p' || true)
      if [ -n "$entry" ]; then echo "$entry"; else echo "(no '## Round $ROUND' entry in its CHANGELOG.md)"; fi
      echo
      echo "--- files it touched since $WIN_TAG's base ---"
      git diff --stat "round-$ROUND-base^{commit}" "$ai/main" -- . 2>/dev/null | tail -25 || true
    else
      echo "($ai/main not found)"
    fi
    echo
  done
  exit 0
fi

# --- preflight ------------------------------------------------------------
echo "==> preflight"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || refuse "not on main"

git fetch --quiet origin --tags

git rev-parse -q --verify "refs/tags/$WIN_TAG" >/dev/null \
  || refuse "$WIN_TAG does not exist - bank the round first (scripts/bank-round.sh $ROUND <winner> --verdict ...)"
! git rev-parse -q --verify "refs/tags/$NEXT_TAG" >/dev/null \
  || refuse "$NEXT_TAG already exists - round $ROUND is already consolidated"
git merge-base --is-ancestor "$WIN_TAG^{commit}" main \
  || refuse "main does not descend from $WIN_TAG - consolidate the tree the round was won on"

# The pass is expected to leave changes in the working tree; what it may not
# leave is nothing at all.
CHANGED=$( { git diff --name-only "$WIN_TAG^{commit}" -- .; git status --porcelain | sed 's/^...//'; } | sort -u)
[ -n "$CHANGED" ] || refuse "nothing changed since $WIN_TAG - the pass has not been done yet"

grep -qx 'ARCHITECTURE.md' <<<"$CHANGED" \
  || refuse "ARCHITECTURE.md is untouched - the pass rewrites it to describe the tree as it is"
grep -qx 'CHANGELOG.md' <<<"$CHANGED" \
  || refuse "CHANGELOG.md is untouched - the round needs its entry"
grep -qiE "^## +round +$ROUND([^0-9]|$)" CHANGELOG.md \
  || refuse "CHANGELOG.md has no '## Round $ROUND' entry"
awk -v r="$ROUND" 'BEGIN{IGNORECASE=1} /^## /{p = ($0 ~ "^## +[Rr]ound +" r "([^0-9]|$)")} p' CHANGELOG.md \
  | grep -qiE '^### +what else was tried' \
  || refuse "the '## Round $ROUND' entry has no '### What else was tried' subsection - fold in what the two losing forks did (scripts/consolidate-round.sh $ROUND --losers)"

echo "    winner   ${WINNER:-none recorded}"
echo "    changed since $WIN_TAG:"
echo "$CHANGED" | sed 's/^/      /'

# --- gate -----------------------------------------------------------------
echo "==> check"
npm run --silent check || refuse "npm run check fails - the consolidated tree has to be green"
if [ "$RUN_TESTS" = 1 ]; then
  npm test || refuse "the test suite fails - the consolidated tree has to be green"
fi

if [ "$DRY_RUN" = 1 ]; then
  echo "dry run ok: round $ROUND would be consolidated and $NEXT_TAG tagged (nothing was written)"
  exit 0
fi

# --- commit, tag, push ----------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  echo "==> commit"
  # The pass deletes as much as it writes, so the whole tree is staged - this
  # runs in the owner's canonical clone, which holds nothing else in flight.
  git add -A
  git commit --quiet -m "[round-$ROUND] consolidation pass: prune, retest, rewrite the docs"
fi

echo "==> tag"
git tag -a "$NEXT_TAG" -m "Base for round $NEXT (round $ROUND consolidated)"

echo "==> push"
git push --quiet origin main "$NEXT_TAG"

if [ "${SKIP_DEPLOY:-0}" = 1 ]; then
  echo "SKIP_DEPLOY=1 - /glow/ not republished"
else
  echo "==> republish the champion"
  ./deploy.sh main
fi

cat <<EOF

Round $ROUND consolidated.
  head     $(git rev-parse --short main)
  tag      $NEXT_TAG (where round $NEXT starts)
  next     open round $NEXT: runbyai repo, ops/open-round.sh $NEXT --brief "..."
EOF
