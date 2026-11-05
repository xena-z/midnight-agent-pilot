#!/usr/bin/env bash
# Every task must have a reference solution that passes its hidden tests. No passing reference, no task.
set -uo pipefail
EVALS="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
for t in "$EVALS"/tasks/*/; do
  id="$(basename "$t")"
  out="$("$EVALS/harness/score.sh" "$id" "$t/reference" "ref-$id")"
  echo "$out"
  echo "$out" | head -1 | grep -q 'tests_pass=true' || fail=1
done
exit $fail
