# Midnight agent pilot

An independent, one-week pilot asking how well AI coding agents build on Midnight, and how much Midnight's own AI tooling (Kapa MCP, Midnight Expert) changes that. It has 44 scored, sandboxed runs across four agent setups, plus a working privacy-preserving consent contract. Not affiliated with Midnight Foundation.

## Findings

**1. The base agent already writes correct Compact on standard tasks.** With Claude Sonnet 5.5 and compiler 0.36.0, every setup, including the one with no Midnight tooling, passed every hidden test on tasks 1–5 and 7. All 44 runs compiled the contract themselves before saying they were done, without being asked. This matters because the remaining gap is narrower than "agents can't write Compact". It sits in subtle security properties and in keeping docs current.

**2. The one real security bug appeared in 2 of 9 runs without Midnight Expert, and 0 of 3 with it.** On the consent contract (task 6, 3 runs per setup), one run in A and one in R never checked that a Merkle path belongs to the caller. Anyone could then prove consent using someone else's registration. Midnight Expert's examples call this check out explicitly. The sample is too small to credit the plugins (B had no such bug either), but this is the kind of property worth checking by machine.

**3. Agents never used Kapa, and Midnight Expert costs 2.4× more per run.** In 33 runs with Kapa connected, no agent called it, so docs grounding only helps if an agent decides to look something up. Setup C cost $2.23 for 11 runs, against $0.86–0.93 for the other setups, and needed more turns. Midnight Expert's plugins worked mostly through startup hooks rather than explicit skill calls.

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

Full data: [`evals/results.csv`](evals/results.csv). Transcripts and the agents' code: [`evals/runs/`](evals/runs/).

## How it was run

- **Setups:** A is Claude Code alone. B adds the Kapa MCP. R is B plus a two-line rules file saying "compile before saying done". C is B plus all 16 Midnight Expert plugins (GitHub main @ `212d7c2c`). Every setup has the same model (`claude-sonnet-5-5`), Claude Code 2.1.220, Compact compiler 0.36.0, and macOS 26.6.
- **Harness:** headless Claude Code in a fresh sandbox per run (`evals/harness/run.sh`), using a clean config folder. Each run gets a per-run OS sandbox, so the agent can read only its own folder and the toolchain. A startup check confirms each setup loaded exactly its tools.
- **Scoring:** the harness compiles each contract itself with the pinned compiler and runs hidden tests against it. Every task has a reference solution that passes, and for the privacy tasks a naive leaky solution that compiles but fails. Manual columns come from reading each contract. See the [rubric](evals/rubric.md).

## Limits

- 44 runs, mostly one per cell. One model, one machine, one week.
- Tasks are small, so harder or longer work may separate the setups more.
- I designed the tasks and built the consent contract with Midnight Expert's patterns, which may favour setup C.
- The stable Midnight Expert channel wasn't tested; setup C used GitHub main (see F-01).
- The first batch of A/B/R runs was voided after a harness leak and re-run (F-10). The voided runs are kept in `evals/runs/_void/`.

## Friction highlights

From [`FRICTION_LOG.md`](FRICTION_LOG.md):
- **F-01:** the stable marketplace serves a June 2026 commit, 121 commits behind main.
- **F-02:** the stable `midnight-cq` skill names an npm package that doesn't exist.
- **F-03:** plugin content changes without version bumps.
- **F-11:** the reserved word `from`, which tripped every setup, is undocumented.

**Upstream contribution:** a compact-core patch adding a verified reserved-words list, an `export` check, and one line in the startup hook ([`upstream/PR.md`](upstream/PR.md)). Before and after on the token task: docs alone, 3 of 3 runs still hit `from`, because agents never opened the reference files. Docs plus the startup line, 2 of 3. Agents use what's put in front of them, not what's merely available.

## Next

See [`NEXT_STEPS.md`](NEXT_STEPS.md).

## The consent contract

[`contract/consent.compact`](contract/consent.compact) lets a participant register consent for a study and prove it to a clinic without revealing which registration is theirs; they can also revoke it.
- **Design:** commitments sit in a Merkle tree, each participant has a per-study pseudonym for revocation, and a clinic's one-time challenge prevents replay.
- **Tests:** 10 tests pass through the independent scorer.
- **Docs:** the design decisions are in [`DESIGN.md`](contract/DESIGN.md). Midnight Expert's privacy and security review found no critical issues and 2 high ones (open registration, tree capacity), recorded as known limits in [`contract/review/`](contract/review/).
