# Midnight agent pilot

An independent, one-week pilot asking how well AI coding agents build on Midnight, and how much Midnight's AI tooling (Kapa MCP, Midnight Expert) changes that. It covers 55 scored, sandboxed runs across five setups, a small compile MCP server that works in any agent, an upstream PR, and a working privacy-preserving consent contract. Not affiliated with Midnight Foundation.

## Findings

**1. The base agent already writes correct Compact on standard tasks.** With Claude Sonnet 5.5 and compiler 0.36.0, every setup passed every hidden test on tasks 1–5 and 7, including the setup with no Midnight tooling. All 55 runs compiled their contract before saying they were done, without being asked. So the remaining gap is narrower than "agents can't write Compact": it's subtle security properties and keeping docs current.

**2. The one real security bug appeared in 2 of 12 runs without Midnight Expert, and 0 of 3 with it.** On the consent contract (task 6), one run in A and one in R never checked that a Merkle path belongs to the caller, so anyone could prove consent with someone else's registration. The sample is too small to credit the plugins (B and M had no such bug either), but it's the kind of property worth checking by machine.

**3. Agents use tools that fit their workflow, and ignore the rest.** In 44 runs with Kapa connected, no agent called it. In setup M, every agent (11 of 11) called the compile MCP server and did all its compiling through it, passing every hidden test for $0.95 in total. Midnight Expert passed fewer tests (10 of 11) at $2.23, and worked mostly through startup hooks rather than skill calls. The upstream patch below found the same pattern: what's put in front of the agent gets used, and what's merely available doesn't.

## Scorecard

Hidden tests passed / runs. One run per cell, except tasks 4 and 6 (3 each).

| Task | A: Claude Code | B: + Kapa | R: + Kapa + "compile first" rule | C: + Kapa + Midnight Expert | M: + Kapa + compile MCP |
|---|---|---|---|---|---|
| 1 Counter | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| 2 Token | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| 3 Private input | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| 4 Disclosure trap | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| 5 Sealed-bid vote | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| 6 Consent attestation | 2/3 (1 soundness bug) | 3/3 | 2/3 (1 soundness bug) | 2/3 (1 missing `export`) | 3/3 |
| 7 Fix-it | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| Kapa calls | — | 0 | 0 | 0 | 0 |
| Cost, 11 runs | $0.93 | $0.92 | $0.86 | $2.23 | $0.95 |

Data: [`evals/results.csv`](evals/results.csv). Transcripts and the agents' code: [`evals/runs/`](evals/runs/).

## Compile MCP server

[`compile-mcp/`](compile-mcp/) is a small, unofficial MCP server: `compile_contract`, `toolchain_info` and `format_contract`, using the developer's own compiler. It's for agents outside Claude Code (Cursor, Copilot, Claude Desktop), which have had no compile tool since `midnight-mcp` was retired. It has 15 tests against the real compiler, including path and shell-injection safety. Setup M is the column above. One caveat: in setup M the agent could also run the compiler from its shell, so M shows the agents chose the tool. It doesn't yet show the gain for agents that have no shell.

## Upstream contribution

[PR #290](https://github.com/midnightntwrk/midnight-expert/pull/290) to Midnight Expert adds a reserved-words list verified against the compiler, an `export` check, and one startup-hook line. It targets `from`, a keyword that 9 of 10 token-task runs used as a variable name. Six extra runs (setup P = C with the patch) measured it: with docs alone, 3 of 3 still hit `from`, because no agent opened the reference files. With the hook line, 2 of 3 did. Draft and patches: [`upstream/`](upstream/).

## How it was run

- **Setups:** A is Claude Code alone. B adds Kapa. R adds a two-line "compile before saying done" rules file to B. C adds all 16 Midnight Expert plugins (GitHub main @ `212d7c2c`) to B. M adds the compile MCP server to B. M ran on 2026-11-11; the others on 2026-11-05. All use `claude-sonnet-5-5`, Claude Code 2.1.220, compiler 0.36.0, macOS 26.6.
- **Harness:** [`evals/harness/run.sh`](evals/harness/run.sh) runs headless Claude Code in a fresh OS-level sandbox per run, with a clean config. The agent can read only its own folder and the toolchain. A startup check voids any run whose loaded tools don't match its setup.
- **Scoring:** the harness compiles each contract with the pinned compiler and runs hidden tests. Every task has a passing reference solution; privacy tasks also have a leaky solution that compiles but fails. See the [rubric](evals/rubric.md).
- **Records:** the local home path in saved records and git history is replaced with `~`. Rebuilt rows match the originals, and [`evals/commit-map.csv`](evals/commit-map.csv) maps old commit IDs to current ones.

## Limits

- 55 runs, mostly one per cell; one model, one machine. Tasks are small, and every setup did well on them.
- I wrote the tasks and built the consent contract with Midnight Expert's patterns, which may favour C. I also wrote the compile server, and its tool description names `from`, which may explain M's clean token run.
- The stable Midnight Expert channel wasn't tested; C used GitHub main (F-01).
- Two harness leaks were caught and the affected runs voided and re-run (F-10, F-13); voided runs are in [`evals/runs/_void/`](evals/runs/_void/).

## Friction highlights

From [`FRICTION_LOG.md`](FRICTION_LOG.md): the stable marketplace serves a June 2026 commit, 121 commits behind main (F-01). Its `midnight-cq` skill names a non-existent npm package (F-02). Plugin content changes without version bumps (F-03).

## The consent contract

[`contract/consent.compact`](contract/consent.compact) lets a participant register consent for a study, prove it to a clinic without revealing which registration is theirs, and revoke it. Commitments sit in a Merkle tree, a per-study pseudonym handles revocation, and a one-time clinic challenge prevents replay. 10 tests pass through the independent scorer. Design decisions: [`DESIGN.md`](contract/DESIGN.md). Midnight Expert's security review found no critical issues and 2 high ones (open registration, tree capacity), recorded as known limits in [`contract/review/`](contract/review/).

Next: [`NEXT_STEPS.md`](NEXT_STEPS.md).
