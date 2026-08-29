#!/usr/bin/env bash
# Fair render queue for the replay harness.
#
#   scripts/render-queue.sh <command> [args...]
#
# Runs the command holding one of GLOW_REPLAY_SLOTS render slots on this host,
# and at most one slot per account. Exits with the command's own status.
#
# Why a queue and not a mutex: this host has four cores and three contestants
# who each want many short playtests inside a ten-hour round. One global lock
# made a contestant wait behind two other renders - about forty minutes for a
# sixty-second video - so all three learned to bypass the lock instead, and
# three unbounded renders on four cores made every render slower than the queue
# would have been. Two slots keep the box busy without oversubscribing it, and
# the per-account limit stops one pane fanning out renders while another waits.
#
# The slot files live in a shared 0777 directory because the accounts sharing
# them are separate Linux users.
set -euo pipefail

QUEUE_DIR="${GLOW_REPLAY_QUEUE_DIR:-/tmp/glow-replay-queue}"
SLOTS="${GLOW_REPLAY_SLOTS:-2}"
WAIT_SECONDS="${GLOW_REPLAY_WAIT:-7200}"

[ $# -gt 0 ] || { echo "usage: render-queue.sh <command> [args...]" >&2; exit 2; }

mkdir -p "$QUEUE_DIR" 2>/dev/null || true
chmod 0777 "$QUEUE_DIR" 2>/dev/null || true

slot_file() { echo "$QUEUE_DIR/slot-$1"; }
# The account key is the uid; GLOW_REPLAY_ACCOUNT overrides it so the queue can
# be exercised from one login.
acct_file() { echo "$QUEUE_DIR/acct-${GLOW_REPLAY_ACCOUNT:-$(id -u)}"; }

# Create a queue file world-writable; another account's 0666 file is fine as is.
ensure_file() {
    [ -e "$1" ] || { : > "$1" 2>/dev/null || true; }
    chmod 0666 "$1" 2>/dev/null || true
}

ensure_file "$(acct_file)"
for i in $(seq 0 $(( SLOTS - 1 ))); do ensure_file "$(slot_file "$i")"; done

# Hold the account slot for the whole run: one render in flight per account.
exec 8<>"$(acct_file)"
if ! flock -w "$WAIT_SECONDS" -x 8; then
    echo "render-queue: your account already has a render in flight and it did not finish within ${WAIT_SECONDS}s" >&2
    exit 75
fi

# Then take the first free host slot, waiting for one if all are busy.
started=$(date +%s)
announced=0
while :; do
    for i in $(seq 0 $(( SLOTS - 1 ))); do
        exec 9<>"$(slot_file "$i")"
        if flock -n -x 9; then
            waited=$(( $(date +%s) - started ))
            [ "$waited" -gt 0 ] && echo "render-queue: slot $i after ${waited}s" >&2
            "$@"
            exit $?
        fi
        exec 9<&-
    done
    if [ "$announced" = 0 ]; then
        echo "render-queue: all $SLOTS render slots busy, waiting (this is faster than rendering on a loaded box)" >&2
        announced=1
    fi
    if [ $(( $(date +%s) - started )) -ge "$WAIT_SECONDS" ]; then
        echo "render-queue: no slot free after ${WAIT_SECONDS}s" >&2
        exit 75
    fi
    sleep 5
done
