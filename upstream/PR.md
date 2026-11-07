# PR: compact-core — document reserved words; name the common ones at session start

Opened as https://github.com/midnightntwrk/midnight-expert/pull/290 on 2026-11-06.

Target: `midnightntwrk/midnight-expert` `main` (based on `212d7c2c`). Branch: `xena-reserved-words`. Patches: [`0001`](0001-docs-compact-core-document-reserved-words-and-when-l.patch), [`0002`](0002-feat-compact-core-name-common-reserved-words-in-Sess.patch).

## Overview

`from` is a Compact keyword, and agents keep using it as a variable name in transfer circuits:

```
parse error: found keyword "from" looking for a const binding
```

In an independent pilot ([midnight-agent-pilot](https://github.com/xena-z/midnight-agent-pilot)), every Claude Code run of a simple token task (mint / transfer / burn) hit this: 4 of 4 setups, with and without Midnight Expert. All recovered after compiling, but it costs a compile-fix cycle every time. compact-core documents `function` and `delete` as reserved, but not `from` or most other keywords.

This PR:

1. **Adds a "Reserved Words" section** to `compact-language-ref/references/troubleshooting.md`, about 75 words. Each was checked with compiler 0.36.0 by compiling `const <word> = 1;`, with `to`, `sender`, `Counter`, `Map`, `async` and `undefined` as controls (they aren't keywords). It also adds error-table and wrong-to-correct rows.
2. **Adds two `compact-review` checks** in `compilation-review.md`:
   - A keyword used as a name.
   - A ledger field that off-chain code reads but that lacks `export`. It compiles, but it's missing from the generated TypeScript `Ledger` type; I verified this in `contract/index.d.ts` with 0.36.0. In the pilot, one Midnight Expert run declared spec'd "public ledger fields" without `export`, and its tests couldn't read them.
3. **Adds one line to the SessionStart context** naming the 8 keywords most often reused as names, with a pointer to the full list (commit 2).
4. **Bumps compact-core** from 0.12.0 to 0.12.1 and adds a CHANGELOG entry.

## Before / after

Same harness, model (`claude-sonnet-5-5`), compiler (0.36.0) and task. All 16 plugins loaded with `--plugin-dir`, sandboxed, headless. Data: `evals/results.csv`, setups C and P, task `02-token`.

| Plugins | Runs that hit `const from` | Agent opened a compact-core reference |
|---|---|---|
| `212d7c2c` (before) | 1 of 1 | no |
| + docs only (commit 1) | 3 of 3 | 0 of 3 |
| + docs and SessionStart line (commit 2) | 2 of 3 | n/a (line is in context in 3 of 3) |

All runs passed the hidden tests in the end. What this shows:
- **The docs alone changed nothing in short tasks**, because agents didn't open reference files. That's why commit 2 exists.
- **The SessionStart line is weak evidence.** It helped in 1 of 3 runs, but the sample is small. The docs are still useful to `compact-review` and to agents that do look things up.

A stronger fix may belong in the compiler: the error for `function` adds "(which is reserved for future use)", but the error for current keywords like `from` doesn't say the word is reserved.

## Submission checklist

- [x] Useful pull request description
- [x] Tests: `scripts/hooks/tests/test-sessionstart-compiler-advice.sh` passes (24/0); both normal and fallback hook outputs checked with `jq`
- [x] Key commits have useful messages
- [x] All commits are signed off (DCO)
- [ ] All check jobs of the CI have succeeded
- [x] Self-reviewed the diff
- [x] Update documentation (if relevant)
- [x] No new todos introduced
