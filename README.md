# Midnight agent pilot

[![CI](https://github.com/xena-z/midnight-agent-pilot/actions/workflows/ci.yml/badge.svg)](https://github.com/xena-z/midnight-agent-pilot/actions/workflows/ci.yml)

An independent, one-week pilot on how well AI coding agents build on Midnight, and how much Midnight's AI tooling (Kapa MCP, Midnight Expert) changes that. It includes 55 scored, sandboxed runs, a compile MCP server for any agent, an upstream PR and a working consent contract. Not affiliated with Midnight Foundation.

## Findings

**1. The base agent already writes correct Compact on standard tasks.** Every setup passed every hidden test on tasks 1–5 and 7, including the one with no Midnight tooling. All 55 runs compiled before saying they were done, unprompted. The remaining gap is subtle security properties and current docs.

**2. The one real security bug appeared in 2 of 12 runs without Midnight Expert, and 0 of 3 with it.** On the consent contract (task 6), one run each in A and R never checked that a Merkle path belongs to the caller, so anyone could prove consent with someone else's registration. Too few runs to credit the plugins, but it's the kind of property worth checking by machine.

**3. Agents use tools that fit their workflow, and ignore the rest.** In 44 runs with Kapa connected, no agent called it. With the compile MCP server (setup M), 11 of 11 agents used it for all their compiling and passed every test, for $0.95. Midnight Expert passed 10 of 11 at $2.23, mostly through startup hooks rather than skill calls.

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

Data: [`evals/results.csv`](evals/results.csv). Transcripts and code: [`evals/runs/`](evals/runs/).

## Compile MCP server

[`compile-mcp/`](compile-mcp/) gives any MCP client (Cursor, Copilot, Claude Desktop) `compile_contract`, `toolchain_info` and `format_contract` using the local compiler. Nothing has filled that gap since `midnight-mcp` was retired. 15 tests run against the real compiler, including path and shell-injection safety. Caveat: M's agents also had a shell, so M shows they chose the tool, not the gain for agents without one.

## Upstream contribution

[PR #290](https://github.com/midnightntwrk/midnight-expert/pull/290) adds a compiler-verified reserved-words list, an `export` check and one startup-hook line. It targets `from`, which 9 of 10 token-task runs used as a variable name. In six extra runs (setup P = C + patch), docs alone left 3 of 3 hitting `from`, since no agent opened them; with the hook line, 2 of 3. Details: [`upstream/`](upstream/).

## How it was run

- **Setups:** A is Claude Code alone; B adds Kapa; R, C and M each add one thing to B: a "compile before done" rules file, all 16 Midnight Expert plugins (GitHub main @ `212d7c2c`), or the compile server. `claude-sonnet-5-5`, Claude Code 2.1.220, compiler 0.36.0, macOS 26.6. Runs on 2026-11-05 (M: 2026-11-11).
- **Harness:** [`run.sh`](evals/harness/run.sh) runs headless Claude Code in a fresh OS-level sandbox with a clean config, and voids any run whose loaded tools don't match its setup.
- **Scoring:** the harness compiles with the pinned compiler and runs hidden tests. Every task has a passing reference; privacy tasks also have a leaky one that must fail. CI re-checks the references on every push. [Rubric](evals/rubric.md).
- **Records:** home paths are replaced with `~`; [`commit-map.csv`](evals/commit-map.csv) maps old commit IDs to current ones.

## Limits

- 55 runs, mostly one per cell; one model, one machine; small tasks.
- I wrote the tasks and built the contract with Midnight Expert's patterns, which may favour C. I wrote the compile server too, and its description names `from`.
- The stable Midnight Expert channel wasn't tested (F-01).
- Two harness leaks were caught and those runs re-run (F-10, F-13); voided runs are in [`evals/runs/_void/`](evals/runs/_void/).

## Friction highlights

From [`FRICTION_LOG.md`](FRICTION_LOG.md): the stable marketplace serves a June 2026 commit, 121 behind main (F-01); its `midnight-cq` skill names a non-existent npm package (F-02); plugin content changes without version bumps (F-03). Filed as [issue #293](https://github.com/midnightntwrk/midnight-expert/issues/293).

## The consent contract

[`contract/consent.compact`](contract/consent.compact) lets a participant register consent for a study, prove it to a clinic without revealing which registration is theirs, and revoke it. It uses a Merkle tree of commitments, a per-study pseudonym for revocation and a one-time clinic challenge against replay. 10 tests pass (`./contract/test.sh`). [Design](contract/DESIGN.md). Midnight Expert's review found 2 high issues (open registration, tree capacity), recorded as known limits in [`contract/review/`](contract/review/).

Next: [`NEXT_STEPS.md`](NEXT_STEPS.md).
