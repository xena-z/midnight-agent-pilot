# Midnight agent pilot

An independent, one-week pilot asking how well AI coding agents build on Midnight, and how much Midnight's AI tooling (Kapa MCP, Midnight Expert) changes that. It covers 44 scored, sandboxed runs across four setups, plus a working privacy-preserving consent contract. Not affiliated with Midnight Foundation.

## Findings

**1. The base agent already writes correct Compact on standard tasks.** With Claude Sonnet 5.5 and compiler 0.36.0, every setup passed every hidden test on tasks 1–5 and 7, including the setup with no Midnight tooling. All 44 runs compiled their contract before saying they were done, without being asked. So the remaining gap is narrower than "agents can't write Compact": it's subtle security properties and keeping docs current.

**2. The one real security bug appeared in 2 of 9 runs without Midnight Expert, and 0 of 3 with it.** On the consent contract (task 6), one run in A and one in R never checked that a Merkle path belongs to the caller, so anyone could prove consent with someone else's registration. The sample is too small to credit the plugins (B had no such bug either), but it's the kind of property worth checking by machine.

**3. Agents never called Kapa, and Midnight Expert cost 2.4× more.** In 33 runs with Kapa connected, no agent used it. Setup C cost $2.23 for 11 runs, against $0.86–0.93 for the others. Midnight Expert worked mostly through startup hooks, not skill calls. The upstream patch below found the same thing: agents use what's put in front of them, not what's merely available.

## Scorecard

Hidden tests passed / runs. One run per cell, except tasks 4 and 6 (3 each).

| Task | A: Claude Code | B: + Kapa | R: + Kapa + "compile first" rule | C: + Kapa + Midnight Expert |
|---|---|---|---|---|
| 1 Counter | 1/1 | 1/1 | 1/1 | 1/1 |
| 2 Token | 1/1 | 1/1 | 1/1 | 1/1 |
| 3 Private input | 1/1 | 1/1 | 1/1 | 1/1 |
| 4 Disclosure trap | 3/3 | 3/3 | 3/3 | 3/3 |
| 5 Sealed-bid vote | 1/1 | 1/1 | 1/1 | 1/1 |
| 6 Consent attestation | 2/3 (1 soundness bug) | 3/3 | 2/3 (1 soundness bug) | 2/3 (1 missing `export`) |
| 7 Fix-it | 1/1 | 1/1 | 1/1 | 1/1 |
| Kapa calls | — | 0 | 0 | 0 |
| Cost, 11 runs | $0.93 | $0.92 | $0.86 | $2.23 |

Data: [`evals/results.csv`](evals/results.csv). Transcripts and the agents' code: [`evals/runs/`](evals/runs/).

## Upstream contribution

[PR #290](https://github.com/midnightntwrk/midnight-expert/pull/290) to Midnight Expert adds a reserved-words list verified against the compiler, an `export` check, and one startup-hook line. It targets `from`, a keyword that 9 of 10 token-task runs used as a variable name. Six extra runs (setup P = C with the patch) measured it: with docs alone, 3 of 3 still hit `from`, because no agent opened the reference files. With the hook line, 2 of 3 did. Draft and patches: [`upstream/`](upstream/).

## How it was run

- **Setups:** A is Claude Code alone. B adds Kapa. R adds a two-line "compile before saying done" rules file to B. C adds all 16 Midnight Expert plugins (GitHub main @ `212d7c2c`) to B. All use `claude-sonnet-5-5`, Claude Code 2.1.220, compiler 0.36.0, macOS 26.6.
- **Harness:** [`evals/harness/run.sh`](evals/harness/run.sh) runs headless Claude Code in a fresh OS-level sandbox per run, with a clean config. The agent can read only its own folder and the toolchain. A startup check voids any run whose loaded tools don't match its setup.
- **Scoring:** the harness compiles each contract with the pinned compiler and runs hidden tests. Every task has a passing reference solution; privacy tasks also have a leaky solution that compiles but fails. See the [rubric](evals/rubric.md).
- **Records:** the local home path in saved records and git history is replaced with `~`. Rebuilt rows match the originals, and [`evals/commit-map.csv`](evals/commit-map.csv) maps old commit IDs to current ones.

## Limits

- 44 runs, mostly one per cell; one model, one machine, one week. Tasks are small.
- I wrote the tasks and built the consent contract with Midnight Expert's patterns, which may favour C.
- The stable Midnight Expert channel wasn't tested; C used GitHub main (F-01).
- Two harness leaks were caught and the affected runs voided and re-run (F-10, F-13); voided runs are in [`evals/runs/_void/`](evals/runs/_void/).

## Friction highlights

From [`FRICTION_LOG.md`](FRICTION_LOG.md): the stable marketplace serves a June 2026 commit, 121 commits behind main (F-01). Its `midnight-cq` skill names a non-existent npm package (F-02). Plugin content changes without version bumps (F-03).

## The consent contract

[`contract/consent.compact`](contract/consent.compact) lets a participant register consent for a study, prove it to a clinic without revealing which registration is theirs, and revoke it. Commitments sit in a Merkle tree, a per-study pseudonym handles revocation, and a one-time clinic challenge prevents replay. 10 tests pass through the independent scorer. Design decisions: [`DESIGN.md`](contract/DESIGN.md). Midnight Expert's security review found no critical issues and 2 high ones (open registration, tree capacity), recorded as known limits in [`contract/review/`](contract/review/).

Next: [`NEXT_STEPS.md`](NEXT_STEPS.md).
