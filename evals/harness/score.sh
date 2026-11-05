#!/usr/bin/env bash
# Independent compile + hidden tests for one task.
# Usage: score.sh <task-id> <src-dir> [work-label]
#   e.g. score.sh 01-counter evals/tasks/01-counter/reference
set -euo pipefail
EVALS="$(cd "$(dirname "$0")/.." && pwd)"
TASK="$1"; SRC="$(cd "$2" && pwd)"; LABEL="${3:-manual-$TASK}"
cd "$EVALS"
exec npx tsx harness/score.ts --task "$TASK" --src "$SRC" --work ".work/$LABEL" --json ".work/$LABEL.score.json"
