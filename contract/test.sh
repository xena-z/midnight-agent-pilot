#!/usr/bin/env bash
# Compile contract/consent.compact with the pinned compiler and run its 10 tests.
# The tests live in evals/tasks/06-consent/hidden-tests/ because they double as the hidden tests for eval task 06.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
# The task-06 reference must stay identical to this contract.
diff -q "$REPO/contract/consent.compact" "$REPO/evals/tasks/06-consent/reference/contract/consent.compact"
out="$("$REPO/evals/harness/score.sh" 06-consent "$REPO" consent-contract)"
echo "$out"
echo "$out" | head -1 | grep -q 'tests_pass=true'
