# Friction log

Every snag, as it happened, including setup. Severity: blocker / major / minor. Details and exact commands are below the table.

| ID | Setup / task | What happened | Repro | Severity | Likely cause | Suggested fix | Filed upstream |
|----|--------------|---------------|-------|----------|--------------|---------------|----------------|
| F-01 | Setup (Midnight Expert) | The stable marketplace (midnightntwrk.expert) pins every plugin to commit `ceca8bfe` of 2026-06-17, 121 commits behind GitHub main on 2026-11-04. The README says stable lags GitHub by 3–5 days. | See F-01 below | major | stale reference (publishing) | Republish stable, or document the real cadence; have `/midnight-expert:doctor` print the pinned commit and its date | not yet |
| F-02 | Setup (midnight-cq) | Stable `midnight-cq` `compact-testing` skill tells agents to use `@openzeppelin-compact/contracts-simulator`, which doesn't exist on npm (404). The real package is `@openzeppelin/compact-simulator`. Fixed on main 2026-09-17, but not on stable (F-01). | See F-02 below | major | stale reference | Publish the fix | not yet |
| F-03 | Setup (plugin versions) | Content changed without version bumps: 12 of 16 plugins have the same version on stable and main (e.g., `midnight-cq` 0.4.0 in both, despite the F-02 fix). After switching the marketplace to GitHub, `claude plugin install` reported those 12 as already installed, and Claude Code's install registry still recorded the old commit. Files on disk matched main only after clearing the plugin cache. Not yet tested whether `claude plugin update` would deliver the fix. | See F-03 below | minor (pending update test) | toolchain / versioning | Bump a plugin's version whenever its content changes (a CI check could enforce it) | not yet |
| F-04 | Setup (testing stack) | Recommended test framework is out of step with the current compiler: `@openzeppelin/compact-simulator` 0.4.1 (latest) depends on `@midnight-ntwrk/compact-runtime` 0.19.0, while code from compiler 0.36.0 calls `checkRuntimeVersion('0.21.0')`. Main's skill says it was verified with simulator 0.3.1 / runtime 0.16.0. The pilot uses its own small helper on runtime 0.21.0 instead; impact on agents not yet tested. | See F-04 below | minor (pending test) | toolchain / stale reference | Note the supported compiler/runtime range in the skill; update when the simulator catches up | not yet |
| F-05 | Setup (installer) | `install.sh` installs all 16 plugins at user scope, with no option for project scope; it also prints a GitHub link to `devrelaicom/midnight-expert`, which redirects to `midnightntwrk/midnight-expert`. | Read `https://midnightntwrk.expert/install.sh` | minor | docs gap | Add a `--scope` option; update the link | not yet |
| F-06 | Setup (local toolchain) | The machine had `compact` CLI 0.2.0 and compiler 0.25.0 (language 0.17.0), too old for examples that require `language_version >= 0.22`. A leftover standalone `compactc` from an older install method no longer ran. `compact self update` + `compact update` fixed it (CLI 0.5.3, compiler 0.36.0). | `compact check`; `compact self check` | minor | toolchain | Check whether `/midnight-tooling:doctor` flags an outdated CLI and stale standalone `compactc` installs | n/a |
| F-08 | Harness / C smoke, 01-counter | Looking for a JS runtime to test its contract, the agent ran `find /` and symlinked `node_modules` from an unrelated local project. Nothing was modified, but an unrestricted agent could also find this repo's reference solutions, hidden tests, and other runs' outputs. | Smoke run before the lockdown | major (eval integrity) | harness design | Per-run access policy: Claude Code's sandbox (`denyRead: ~/` plus a short allow list) and permission rules for its file tools. Verified with probe runs | n/a |
| F-09 | Harness (compiler in a sandbox) | Inside a restricted sandbox the compiler fails with errors that don't name the path it needed. No writable `/tmp`: `Assertion failed: (fd >= 0), function maketempfile, file embed_target.c`. No access to `~/.cache/midnight` (zk params): `Error: Operation not permitted (os error 1)` from `zkir`. | Run `compact compile` with `/tmp` or `~/.cache/midnight` unwritable | minor | toolchain | Include the failing path in these errors; document the directories the compiler needs | not yet |
| F-10 | Harness / A, B, R tier-1 runs | The access policy allowed the pinned Midnight Expert clone in every setup, and Claude Code lists additional working directories in the agent's instructions. Agents in A-05, B-02 and B-05 read Midnight Expert files. All 15 A/B/R tier-1 runs were voided (kept in `evals/runs/_void/`) and re-run. | Allow a directory via `permissions.additionalDirectories`, then check what the agent knows about it | major (eval integrity) | harness design | Clone allowed only for setup C; `parse-run.ts check-contamination` voids any A/B/R run that touches it | n/a |
| F-11 | A, B, C / 02-token | Agents in three setups named a variable `from` (`const from = …`) and got `parse error: found keyword "from" looking for a const binding`. Setup C hit it twice. All fixed it themselves after compiling. Midnight Expert documents `delete` as reserved (`compilation-review.md`) but not `from`. | Declare `const from = 1;` in any circuit | minor | missing skill / docs gap | Add a reserved-words list (including `from`) to compact-core's language reference and compilation review; the compiler message could say the word is reserved | not yet |
| F-07 | Harness | A Claude Code session exports about 15 `CLAUDE_*` variables (including `CLAUDE_EFFORT`) to child processes, so eval runs started from inside a session would inherit its settings. | `env \| grep ^CLAUDE` inside a session | minor | harness design | `run.sh` launches the agent with `env -i` and only `HOME`, `USER`, `PATH`, `LANG`, `TERM`, `SHELL`, `CLAUDE_CONFIG_DIR` | n/a |

## Details

### F-01 — stable marketplace pinned to June
```bash
claude plugin marketplace add --scope project https://midnightntwrk.expert
# the cached manifest lists every plugin with "sha": "ceca8bfeb7c396a65f978e6adc6534de105ca0b8"
gh api repos/midnightntwrk/midnight-expert/commits/ceca8bfeb7c396a65f978e6adc6534de105ca0b8 --jq .commit.author.date
# 2026-06-17T11:37:07Z
gh api repos/midnightntwrk/midnight-expert/compare/ceca8bfeb7c396a65f978e6adc6534de105ca0b8...main --jq .ahead_by
# 121 (on 2026-11-04; main head 212d7c2c, 2026-10-29)
```
Impact: anyone following the official install gets June content. Example: F-02.

### F-02 — non-existent package in stable `midnight-cq`
```bash
# stable midnight-cq 0.4.0, skills/compact-testing/SKILL.md and references/simulator-api.md:
#   import { createSimulator } from '@openzeppelin-compact/contracts-simulator';
npm view @openzeppelin-compact/contracts-simulator   # E404
npm view @openzeppelin/compact-simulator version     # 0.4.1
```
Fixed on main by commit "docs(midnight-cq): fix non-existent packages + wrong compile command" (2026-09-17).

### F-03 — same version, different content
Both stable (`ceca8bfe`) and main (`212d7c2c`) declare `midnight-cq` 0.4.0. After `claude plugin marketplace add --scope project midnightntwrk/midnight-expert` and reinstalling, `~/.claude/plugins/installed_plugins.json` still recorded `gitCommitSha: ceca8bfe` for the 12 unchanged-version plugins. After deleting `~/.claude/plugins/cache/midnight-expert`, the reinstalled `midnight-cq` files were byte-identical to main.

### F-04 — simulator vs compiler runtime
```bash
npm view @openzeppelin/compact-simulator@0.4.1 dependencies   # compact-runtime: 0.19.0
compact compile --runtime-version                              # 0.21.0 (compiler 0.36.0)
```
Compiler 0.36.0 was released on 2026-11-03, one day before this pilot started, so some lag is expected.
