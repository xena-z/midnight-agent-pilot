#!/usr/bin/env bash
# One scored eval run: fresh sandbox -> headless Claude Code -> independent score -> CSV row.
#
# Usage: evals/harness/run.sh <A|B|R|C> <task-id> <run-number> [--smoke]
#   --smoke  writes to evals/runs/_smoke/ and does not touch results.csv
#
# Start it from a plain terminal. The agent is launched with a scrubbed environment (env -i),
# so CLAUDE_* variables from any surrounding Claude Code session can't leak in.
# Compatible with macOS bash 3.2.
set -euo pipefail

SETUP="${1:?setup A|B|R|C}"; TASK="${2:?task id}"; RUN="${3:?run number}"; MODE="${4:-}"
EVALS="$(cd "$(dirname "$0")/.." && pwd)"; REPO="$(cd "$EVALS/.." && pwd)"; H="$EVALS/harness"

# ---- pinned configuration (record any change in CLAUDE.md's environment record) ----
MODEL="${EVAL_MODEL:-claude-sonnet-5-5}"
EVAL_CONFIG="${EVAL_CONFIG_DIR:-$HOME/.claude-eval}"
COMPILER_PIN="0.36.0"
PLUGIN_ROOT="${PLUGIN_ROOT:-$HOME/midnight-eval-sandboxes/_tooling/midnight-expert}"
PLUGIN_SHA="212d7c2cdadef9a52d84cbd0c83c81bc79930b6b"
SANDBOX_ROOT="${SANDBOX_ROOT:-$HOME/midnight-eval-sandboxes}"
MAX_TURNS=50
PHASE1_TIMEOUT=1200   # 20 minutes
PHASE2_TIMEOUT=600    # 10 minutes per error paste
MAX_INTERVENTIONS=3
CLARIFY_REPLY="Please use your best judgment and complete the task without further questions."

case "$SETUP" in
  A) MCP="$H/setups/none.mcp.json" ;;
  B|R|C) MCP="$H/setups/kapa.mcp.json" ;;
  *) echo "unknown setup $SETUP" >&2; exit 2 ;;
esac

TASK_DIR="$EVALS/tasks/$TASK"
[ -f "$TASK_DIR/prompt.md" ] || { echo "no task $TASK" >&2; exit 2; }
RUN_ID="$SETUP-$TASK-r$RUN"
if [ "$MODE" = "--smoke" ]; then OUT="$EVALS/runs/_smoke/$RUN_ID"; SANDBOX="$SANDBOX_ROOT/_smoke/$SETUP/$TASK-r$RUN"; rm -rf "$OUT" "$SANDBOX"
else OUT="$EVALS/runs/$RUN_ID"; SANDBOX="$SANDBOX_ROOT/$SETUP/$TASK-r$RUN"; fi
[ -e "$OUT" ] && { echo "$OUT exists; never overwrite a scored run" >&2; exit 1; }
[ -e "$SANDBOX" ] && { echo "$SANDBOX exists; sandboxes must be fresh" >&2; exit 1; }

# ---- preflight ----
compact compile --version | grep -q "^$COMPILER_PIN" || { echo "default compiler is not $COMPILER_PIN" >&2; exit 1; }
if [ "$SETUP" = "C" ]; then
  [ "$(git -C "$PLUGIN_ROOT" rev-parse HEAD)" = "$PLUGIN_SHA" ] || { echo "plugin clone not at $PLUGIN_SHA" >&2; exit 1; }
fi
HARNESS_COMMIT="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo none)"
[ -n "$(git -C "$REPO" status --porcelain -- evals/tasks evals/harness 2>/dev/null)" ] && HARNESS_COMMIT="$HARNESS_COMMIT-dirty"

mkdir -p "$OUT" "$SANDBOX"
cp -R "$TASK_DIR/starter/." "$SANDBOX/"
find "$SANDBOX" -name .gitkeep -delete
[ "$SETUP" = "R" ] && cp "$H/setups/R.CLAUDE.md" "$SANDBOX/CLAUDE.md"
PROMPT="$(cat "$TASK_DIR/prompt.md")"

PLUGIN_FLAGS=(); PLUGIN_SHA_USED=""
if [ "$SETUP" = "C" ]; then
  for d in "$PLUGIN_ROOT"/plugins/*/; do PLUGIN_FLAGS+=(--plugin-dir "${d%/}"); done
  PLUGIN_SHA_USED="$PLUGIN_SHA"
fi

agent() { # agent <timeout-seconds> <out.jsonl> <claude args...>
  local t="$1" f="$2"; shift 2
  ( cd "$SANDBOX" && env -i HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" PATH="$PATH" \
      LANG="${LANG:-en_US.UTF-8}" TERM=xterm-256color SHELL="${SHELL:-/bin/zsh}" CLAUDE_CONFIG_DIR="$EVAL_CONFIG" \
      gtimeout "$t" claude "$@" \
        --model "$MODEL" --output-format stream-json --verbose --max-turns "$MAX_TURNS" \
        --mcp-config "$MCP" --strict-mcp-config \
        --permission-mode bypassPermissions \
        --disallowedTools "Bash(compact update *)" "Bash(compact self *)" "Bash(compact clean *)" \
        ${PLUGIN_FLAGS[@]+"${PLUGIN_FLAGS[@]}"} \
      < /dev/null > "$f" 2> "${f%.jsonl}.stderr" ) || echo $?
}

NOTES=()
START=$(date +%s)
echo "[$RUN_ID] phase 1 (sandbox: $SANDBOX)"
rc="$(agent "$PHASE1_TIMEOUT" "$OUT/phase1.jsonl" -p "$PROMPT")"
[ "$rc" = "124" ] && NOTES+=("phase 1 timed out")

if ! INIT="$(cd "$EVALS" && npx --no tsx harness/parse-run.ts check-init "$SETUP" "$OUT/phase1.jsonl")"; then
  echo "$INIT" | tee "$OUT/VOID"; exit 1
fi

LAST="$(cd "$EVALS" && npx --no tsx harness/parse-run.ts last-result "$OUT/phase1.jsonl")"
SID="$(echo "$LAST" | python3 -I -c 'import sys,json; print(json.load(sys.stdin)["session_id"])')"
if echo "$LAST" | grep -q '"asks_question":true'; then
  echo "[$RUN_ID] agent asked a question; sending the standard reply (not an intervention)"
  NOTES+=("asked a clarifying question")
  agent "$PHASE1_TIMEOUT" "$OUT/phase1b.jsonl" -p "$CLARIFY_REPLY" --resume "$SID" >/dev/null
fi

score() { (cd "$EVALS" && npx --no tsx harness/score.ts --task "$TASK" --src "$SANDBOX" --work ".work/$RUN_ID/$1" --json "$OUT/score-$1.json"); }
echo "[$RUN_ID] scoring first attempt"; score first
cp "$OUT/score-first.json" "$OUT/score-final.json"

INTERVENTIONS=0
while [ "$INTERVENTIONS" -lt "$MAX_INTERVENTIONS" ] && grep -q '"compiled": false' "$OUT/score-final.json" && grep -q '"found": true' "$OUT/score-final.json"; do
  INTERVENTIONS=$((INTERVENTIONS + 1))
  ERR="$(python3 -I -c 'import sys,json; print("\n".join(json.load(open(sys.argv[1]))["compile_output"].splitlines()[:80]))' "$OUT/score-final.json")"
  MSG="$(printf 'The contract does not compile. Compiler output:\n\n```\n%s\n```' "$ERR")"
  echo "[$RUN_ID] phase 2, intervention $INTERVENTIONS"
  agent "$PHASE2_TIMEOUT" "$OUT/phase2-$INTERVENTIONS.jsonl" -p "$MSG" --resume "$SID" >/dev/null
  score "final-$INTERVENTIONS"; cp "$OUT/score-final-$INTERVENTIONS.json" "$OUT/score-final.json"
done

MINUTES=$(python3 -I -c "print(round(($(date +%s) - $START) / 60, 1))")
compact compile --version | grep -q "^$COMPILER_PIN" || NOTES+=("WARNING default compiler changed during run")

# Keep the agent's work for review (no dependencies or compiled output).
rsync -a --exclude node_modules --exclude .git --exclude managed "$SANDBOX/" "$OUT/sandbox/"

python3 -I - "$OUT/meta.json" <<EOF
import json, sys
json.dump({
  "date": "$(date +%Y-%m-%d)", "setup": "$SETUP", "task": "$TASK", "run": $RUN, "model": "$MODEL",
  "harness_commit": "$HARNESS_COMMIT", "interventions": $INTERVENTIONS, "minutes": $MINUTES,
  "plugin_sha": "$PLUGIN_SHA_USED", "session_id": "$SID",
  "notes": json.loads('''$(python3 -I -c 'import json,sys; print(json.dumps(sys.argv[1:]))' ${NOTES[@]+"${NOTES[@]}"})'''),
}, open(sys.argv[1], "w"), indent=2)
EOF

ROW="$(cd "$EVALS" && npx --no tsx harness/parse-run.ts row "$OUT")"
if [ "$MODE" = "--smoke" ]; then echo "$ROW" > "$OUT/row.csv"; else echo "$ROW" >> "$EVALS/results.csv"; fi
echo "[$RUN_ID] done in ${MINUTES} min"
echo "$ROW"
