#!/usr/bin/env bash
# Close a round nobody won: record it, and tag where tomorrow starts.
#
#   scripts/skip-round.sh <round> --verdict "why nobody won" [--dry-run]
#
# There is no merge to bank, but the next round still needs a base tag, and the
# ledger still needs the round on the record - a round nobody won is a result,
# not a gap. This is the no-winner half of bank-round.sh: same refusals, no
# merge, no champion republish (canonical main is unchanged apart from the
# ledger commit).
set -euo pipefail

cd "$(dirname "$0")/.."

ROUND="${1:-}"
shift 1 2>/dev/null || true

VERDICT=""
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --verdict) VERDICT="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$ROUND" in ''|*[!0-9]*) echo "usage: scripts/skip-round.sh <round> --verdict \"...\"" >&2; exit 2 ;; esac
[ -n "$VERDICT" ] || { echo "--verdict is required: one line on why the round went unwon" >&2; exit 2; }

NEXT=$((ROUND + 1))
BASE_TAG="round-$ROUND-base"
WIN_TAG="round-$ROUND-winner"
NEXT_TAG="round-$NEXT-base"

refuse() { echo "REFUSED: $*" >&2; exit 1; }

echo "==> preflight"
[ -z "$(git status --porcelain)" ] || refuse "the working tree is dirty - commit or stash first"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || refuse "not on main"

git fetch --quiet origin --tags

git rev-parse -q --verify "refs/tags/$BASE_TAG" >/dev/null || refuse "$BASE_TAG does not exist - is this the right round?"
! git rev-parse -q --verify "refs/tags/$WIN_TAG" >/dev/null || refuse "$WIN_TAG exists - round $ROUND was won, not skipped"
! git rev-parse -q --verify "refs/tags/$NEXT_TAG" >/dev/null || refuse "$NEXT_TAG already exists - round $ROUND is already closed"
[ "$(git rev-parse main)" = "$(git rev-parse "$BASE_TAG^{commit}")" ] \
  || refuse "main is not at $BASE_TAG - canonical moved since the round opened"

if [ "$DRY_RUN" = 1 ]; then
  node scripts/ledger.mjs record-round --round "$ROUND" --winner none --verdict "$VERDICT"
  git checkout --quiet -- ledger.json LEDGER.md
  echo "dry run ok: round $ROUND would be recorded unwon and $NEXT_TAG tagged at $(git rev-parse --short main) (nothing was written)"
  exit 0
fi

echo "==> ledger"
node scripts/ledger.mjs record-round --round "$ROUND" --winner none --verdict "$VERDICT"
git add ledger.json LEDGER.md
git commit --quiet -m "[round-$ROUND] no winner: $VERDICT" -- ledger.json LEDGER.md

echo "==> tag"
git tag -a "$NEXT_TAG" -m "Base for round $NEXT (round $ROUND went unwon)"

echo "==> push"
git push --quiet origin main "$NEXT_TAG"

node scripts/ledger.mjs status
cat <<EOF

Round $ROUND closed unwon.
  verdict  $VERDICT
  base     $NEXT_TAG at $(git rev-parse --short main) (the ledger commit; the game code is unchanged)
  champion /glow/ still shows the last winner
  next     open round $NEXT: runbyai repo, ops/open-round.sh $NEXT
EOF
