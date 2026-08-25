#!/usr/bin/env bash
# Bank a round: merge the winner into canonical main, tag it, record the win,
# publish the champion build.
#
#   scripts/bank-round.sh <round> <claude|openai|grok> --verdict "one line"
#
# Run it from the owner's canonical clone after judging. It refuses rather than
# repairs: a winner that did not update ARCHITECTURE.md and CHANGELOG.md is not
# merged, because publishing your understanding of the codebase is the price of
# banking the win (RULES.md, "Banking the win").
#
# Flags and environment:
#   --dry-run     run every check and the merge locally, then undo it - no
#                 ledger entry, no tags, no push, no deploy
#   --no-tests    skip `npm test` (the Playwright smoke run)
#   SKIP_DEPLOY=1 merge, tag and push, but do not publish /glow/
#   WINNER_REF    the ref to merge (default <winner>/main)
set -euo pipefail

cd "$(dirname "$0")/.."

ROUND="${1:-}"
WINNER="${2:-}"
shift 2 2>/dev/null || true

VERDICT=""
DRY_RUN=0
RUN_TESTS=1
while [ $# -gt 0 ]; do
  case "$1" in
    --verdict) VERDICT="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-tests) RUN_TESTS=0; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$ROUND" in ''|*[!0-9]*) echo "usage: scripts/bank-round.sh <round> <claude|openai|grok> --verdict \"...\"" >&2; exit 2 ;; esac
case "$WINNER" in claude|openai|grok) ;; *) echo "winner must be claude, openai or grok" >&2; exit 2 ;; esac
[ -n "$VERDICT" ] || { echo "--verdict is required: one line on why this build won" >&2; exit 2; }

NEXT=$((ROUND + 1))
BASE_TAG="round-$ROUND-base"
WIN_TAG="round-$ROUND-winner"
NEXT_TAG="round-$NEXT-base"
REF="${WINNER_REF:-$WINNER/main}"

refuse() { echo "REFUSED: $*" >&2; exit 1; }

echo "==> preflight"
[ -z "$(git status --porcelain)" ] || refuse "the working tree is dirty - commit or stash first"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || refuse "not on main"

git fetch --quiet origin --tags
git fetch --quiet "$WINNER"

git rev-parse -q --verify "refs/tags/$BASE_TAG" >/dev/null || refuse "$BASE_TAG does not exist - is this the right round?"
! git rev-parse -q --verify "refs/tags/$WIN_TAG" >/dev/null || refuse "$WIN_TAG already exists - round $ROUND is already banked"
git merge-base --is-ancestor "$BASE_TAG^{commit}" main \
  || refuse "main is not built on $BASE_TAG - canonical moved since the round opened"
AHEAD=$(git rev-list --count "$BASE_TAG^{commit}..main")
[ "$AHEAD" = 0 ] && echo "    main is at $BASE_TAG" || {
  echo "    main is $AHEAD commit(s) ahead of $BASE_TAG - owner-side work landed after the round opened:"
  git log --oneline "$BASE_TAG^{commit}..main" | sed 's/^/      /'
}

git rev-parse -q --verify "$REF" >/dev/null || refuse "$REF not found"
git merge-base --is-ancestor "$BASE_TAG^{commit}" "$REF" \
  || refuse "$REF does not build on $BASE_TAG - the round is judged from the shared base"

echo "==> banking-the-win check"
CHANGED=$(git diff --name-only "$BASE_TAG^{commit}" "$REF")
grep -qx 'ARCHITECTURE.md' <<<"$CHANGED" || refuse "$REF does not update ARCHITECTURE.md - a win with a stale architecture doc is not banked"
grep -qx 'CHANGELOG.md' <<<"$CHANGED" || refuse "$REF has no CHANGELOG.md entry for the round"
git show "$REF:CHANGELOG.md" | grep -qiE "^## +round +$ROUND\b" \
  || refuse "CHANGELOG.md has no '## Round $ROUND' entry"

echo "==> merge $REF -> main"
SAFETY=$(git rev-parse HEAD)
undo() { git merge --abort 2>/dev/null || true; git reset --hard --quiet "$SAFETY"; }

if ! git merge --no-ff "$REF" -m "[round-$ROUND] $WINNER wins: $VERDICT"; then
  undo
  refuse "the merge conflicts - resolve it by hand, then re-run"
fi
MERGE_SHA=$(git rev-parse HEAD)

echo "==> check"
if ! npm run --silent check; then undo; refuse "npm run check fails on the merged tree"; fi
if [ "$RUN_TESTS" = 1 ]; then
  if ! npm test; then undo; refuse "the smoke tests fail on the merged tree"; fi
fi

if [ "$DRY_RUN" = 1 ]; then
  undo
  echo "dry run ok: round $ROUND would be banked for $WINNER at ${MERGE_SHA:0:7} (nothing was written)"
  exit 0
fi

echo "==> ledger"
node scripts/ledger.mjs record-round --round "$ROUND" --winner "$WINNER" --verdict "$VERDICT" --commit "$MERGE_SHA"
git add ledger.json LEDGER.md
git commit --quiet -m "[round-$ROUND] ledger: $WINNER banks the win" -- ledger.json LEDGER.md

echo "==> tag"
git tag -a "$WIN_TAG" "$MERGE_SHA" -m "Round $ROUND winner: $WINNER - $VERDICT"
git tag -a "$NEXT_TAG" -m "Base for round $NEXT"

echo "==> push"
git push --quiet origin main "$WIN_TAG" "$NEXT_TAG"

if [ "${SKIP_DEPLOY:-0}" = 1 ]; then
  echo "SKIP_DEPLOY=1 - /glow/ not republished"
else
  echo "==> publish the champion"
  ./deploy.sh main
fi

node scripts/ledger.mjs status
cat <<EOF

Round $ROUND banked.
  winner   $WINNER ($REF)
  merge    ${MERGE_SHA:0:7}
  tags     $WIN_TAG (the winning merge), $NEXT_TAG (where round $NEXT starts)
  next     open round $NEXT: runbyai repo, ops/open-round.sh $NEXT
EOF
