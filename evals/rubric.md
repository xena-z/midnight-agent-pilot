# Scoring rubric

One row in `results.csv` per run. `harness/run.sh` fills the automated columns. A person fills the manual ones after reading the transcript in `runs/<setup>-<task>-r<n>/`.

## Automated

| Column | Definition |
|---|---|
| `date` | Date the run started (local). |
| `setup` | A, B, R or C (see CLAUDE.md, "Setups"). |
| `task` / `run` | Task id and run number. |
| `model` | Model id passed with `--model`. |
| `compact_version` | Compiler used by the independent scorer (always pinned; `compact compile +0.36.0`). |
| `harness_commit` | Repo commit when the run started; `-dirty` if `evals/tasks` or `evals/harness` had uncommitted changes. Scored runs should never be dirty. |
| `compiled_first` | The independent scorer compiled the agent's contract after phase 1. The agent's own claims don't count. |
| `compiled_final` | Same, after phase 2 (up to 3 compiler-error pastes). Equals `compiled_first` when no phase 2 was needed. |
| `tests_pass_first` / `tests_pass_final` | All hidden tests passed. False if the contract didn't compile. |
| `verified_before_claiming_done` | In phase 1, the agent ran the compiler (`compact compile` or `compactc`, including inside subagents) after its last edit to a `.compact` file. |
| `interventions` | Number of compiler-error pastes in phase 2 (0–3). The one standard reply to a clarifying question doesn't count. |
| `agent_turns` | Sum of `num_turns` across all phases. |
| `minutes` | Wall-clock minutes for the whole run, including scoring. |
| `cost_usd` | Sum of `total_cost_usd` reported by Claude Code (an estimate on subscription plans). |
| `web_lookups` | `WebSearch` + `WebFetch` calls, all phases. |
| `mcp_calls` | Calls to any `mcp__` tool (only Kapa exists in B, R, C). |
| `skill_calls` | `Skill` tool calls (built-in or plugin skills). |
| `hook_outputs` | Hook events (e.g., plugin `SessionStart` hooks) that returned output. Plugins can steer the agent this way without any tool call, so read it alongside `skill_calls`. |

## Manual

| Column | How to fill it |
|---|---|
| `hallucinated_apis` | Count of distinct non-existent syntax, stdlib or SDK names the agent used, in any phase. Start from unknown-identifier and parse errors in `score-first.json`, then read the final `.compact` file. |
| `privacy_errors` | Count of unintended disclosures (a witness-derived value reaching the ledger or a return value without being required), plus disclosure-related compile errors. For tasks without witnesses this is usually 0. |
| `failure_tags` | Space-separated, only from: `invented-syntax`, `stale-syntax`, `disclosure`, `sdk-mismatch`, `toolchain`, `false-success`, `loop-or-gave-up`, `docs-gap`, `tool-not-used`. |
| `notes` | The harness pre-fills facts (timeouts, clarifying questions, interface gaps). Append a short human note. |

### Tag guide
- `invented-syntax`: syntax or functions that never existed in Compact.
- `stale-syntax`: syntax that existed in an older Compact version (e.g., a `ledger { }` block).
- `disclosure`: missing, misplaced or excessive `disclose()`.
- `sdk-mismatch`: wrong package names or versions in TypeScript (witnesses, tests).
- `toolchain`: problems invoking the compiler or installing packages.
- `false-success`: the agent said it was done or that it compiled, but the independent compile failed.
- `loop-or-gave-up`: repeated the same failing fix, or stopped without a working contract.
- `docs-gap`: the agent looked for the answer (Kapa, docs, skills) and the source was missing or wrong.
- `tool-not-used`: the setup had a relevant tool (Kapa, a plugin skill, the compiler) and the agent never used it.

## Worked example

Setup B, task 01-counter, run 1: the agent writes `ledger { round: Counter; }` (old syntax), says "Done!" without compiling, and the independent compile fails. One error paste later it fixes the syntax, and the hidden tests pass.

`compiled_first=false, compiled_final=true, tests_pass_first=false, tests_pass_final=true, verified_before_claiming_done=false, interventions=1, hallucinated_apis=0, privacy_errors=0, failure_tags="stale-syntax false-success"`
