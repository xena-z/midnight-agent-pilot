# Midnight agent pilot — project brief

> Context file for Claude Code. Save it as `CLAUDE.md` at the repo root; Claude Code loads it automatically every session.
> Written to be safe in a public repo. Keep personal notes out of it.

## What this project is

An independent, one-week pilot answering one question:

**How well do AI coding agents build on Midnight, and how much does Midnight's own AI tooling change that?**

Three outputs:

1. A small, working Compact contract (a privacy-preserving consent attestation), built with Claude Code + Midnight Expert. It doubles as the reference solution for eval task 6.
2. A reproducible scorecard: a scripted harness that runs four agent setups on the same Compact tasks, plus a friction log and recommendations.
3. One upstream contribution for the most important gap found: a pull request to Midnight Expert with a before/after measurement, or a detailed issue with repro steps and a proposed fix.

Audience: Midnight's product and developer-relations teams. Tone: collaborative and specific. Credit what works. Report failures as data with repro steps, not as criticism.

Not affiliated with Midnight Foundation. No real health or personal data anywhere in this repo.

## How to work with me

- I'm a technical PM, strong in TypeScript/Next.js and Claude Code, and new to Compact and zero-knowledge proofs.
- Explain Compact-specific decisions in one or two lines (code comments or chat) so I can defend them later. Don't over-explain general programming.
- I want to understand the code, not just have it. When there's a real design choice (especially what goes on the public ledger), surface it and let me decide.
- Git: never add a Claude co-author line to commits, and don't change my git author settings. Never push unless I ask.

## Hard rules

1. Never say Compact code compiles or tests pass unless you ran the compiler/tests in this session and saw the result. Show the command you ran.
2. Never invent results. `evals/results.csv` gets rows only from the harness, plus my manual review of real transcripts. Unknown values stay blank.
3. Only the harness writes into eval sandboxes. Never edit a sandbox by hand or from this session, and never put this file or other Midnight-specific context in one. (Setup R's rules file is the one deliberate exception, and the harness copies it.)
4. Prefer verified patterns from Midnight Expert (`compact-examples`, `compact-core`) and the docs over memory. Compact changes often and is barely present in model training data.
5. Target `pragma language_version >= 0.22` unless the installed compiler says otherwise. Record the actual version.
6. Tasks freeze (tagged commit) before their first scored run. Changing a frozen task means re-running it in every setup and logging why.
7. Keep scope to one week. If something is a stretch goal, say so and park it in `NEXT_STEPS.md`.

## Background facts

**Midnight**: a privacy-focused ("data protection") blockchain. Smart contracts are written in **Compact**. Contracts have public ledger state, circuits, and witnesses (private inputs). Revealing witness-derived data requires explicit disclosure; the compiler rejects implicit disclosure ("Implicit disclosure of witness value").

**Midnight Expert**: github.com/midnightntwrk/midnight-expert, site midnightntwrk.expert
- A marketplace of 16 Claude Code plugins. Claude Code only. macOS/Linux only (Windows → run everything inside WSL2).
  - Smart contracts: `compact-core`, `compact-examples`, `compact-cli-dev`
  - DApps: `midnight-dapp-dev`
  - Testing and quality: `midnight-cq`, `midnight-verify`, `midnight-fact-check`
  - Toolchain: `midnight-tooling`, `midnight-wallet`, `midnight-status-codes`
  - Knowledge: `core-concepts`
  - References: `proof-server`, `midnight-indexer`, `midnight-node`
  - Meta: `midnight-expert` (diagnostics), `midnight-plugin-utils`
- Each plugin is versioned separately (in Nov 2026 the site listed e.g. compact-core v0.11.0, midnight-verify v0.13.0). Record every installed plugin's version, not one "Midnight Expert version".
- Useful commands:
  - `/midnight-expert:doctor`: ecosystem health check
  - `/midnight-tooling:doctor`: Compact CLI health check
  - `/midnight-verify:verify "<claim>"`: check a claim/snippet against the real compiler and runtime
  - `/midnight-tooling:devnet start`: local devnet
  - `/midnight-status-codes:lookup <code>`: decode an error code
  - `/midnight-fact-check:check <path>`: fact-check content against the toolchain
  - `/midnight-expert:feedback`: file a bug or request
- The official install paths (`install.sh`, and the README's CLI instructions) install at **user** scope. That's fine for a normal developer but would leak into every eval run, so this project never installs at user scope. Log it as friction.
- Slash commands from a plugin installed mid-session need a Claude Code restart. Skills and agents activate immediately.
- The docs say the stable marketplace (midnightntwrk.expert) lags GitHub by 3–5 days. On 2026-11-04 it was pinned to a 2026-06-17 commit (FRICTION_LOG F-01), so this pilot uses **GitHub main pinned to commit `212d7c2c`** (2026-10-28), for both the Part 1 build and setup C.

**Kapa MCP**: docs Q&A over Midnight docs, core repos (ledger, midnight.js, node), and the whitepaper. Works in any MCP client (Cursor, VS Code, Copilot, etc.).

```bash
claude mcp add --transport http midnight https://midnight.mcp.kapa.ai
```

- Requires sign-in: it returns HTTP 401 until you authenticate. Confirm auth works in every setup that uses it, including headless runs.
- The community `midnight-mcp` server was deprecated on 25 June 2026 in favor of Kapa + Midnight Expert (migration guide: docs.midnight.network/blog/migrating-to-kapa-and-midnight-expert). It was also registered as `midnight`, so check `claude mcp list` and make sure it's gone. Its `compile-contract` tool has no replacement outside Claude Code.

**Division of labour, per Midnight**: Kapa = knowing (answers questions). Midnight Expert = doing (writes, verifies, runs code). Outside Claude Code, developers only get Kapa.

**Compact toolchain**: use the current `compact` CLI and pin one compiler version for the whole week. Replace any older standalone `compactc` install. The test runtime (`@midnight-ntwrk/compact-runtime`) must be compatible with the compiler; confirm the pairing on Day 1 and record both.

## Repo layout

```
midnight-agent-pilot/
├── CLAUDE.md
├── README.md             # written last, findings first
├── FRICTION_LOG.md
├── NEXT_STEPS.md         # recommendations, grounded in the data
├── contract/             # consent attestation: .compact source, witnesses, tests, DESIGN.md
└── evals/
    ├── rubric.md
    ├── results.csv
    ├── tasks/<id>/       # prompt.md, starter/, hidden-tests/, reference/, notes.md
    ├── harness/          # run.sh, score.sh, parse-run.ts, setups/, package.json (pinned runtime + test deps)
    └── runs/             # one folder per run: stream-json transcript + score output
```

Eval sandboxes live **outside** this repo and are created by the harness: `~/midnight-eval-sandboxes/<setup>/<task>-r<n>/`

---

## Part 1 — The build: consent attestation contract

**Scenario**: a participant proves to a study or clinic that they've consented, without revealing who they are. Demo only.

**MVP**
- **Register**: participant adds a consent commitment for a study ID. Their secret stays private (witness).
- **Prove**: participant proves active consent for study X without revealing which commitment is theirs.
- **Revoke**: only the holder of the secret can revoke. A revoked consent can't be proven.
- **Public ledger** exposes only what's necessary. Nothing that links a person to a study.

Likely shape: commitments in a Merkle-tree ledger type plus a nullifier set. Confirm against `compact-examples` before building, and explain the choice to me.

**Decide with me before writing code (Day 2).** Record each decision in 3–5 lines in `contract/DESIGN.md`:

1. **Linkability.** How does "prove" check that consent isn't revoked without publishing a value (e.g., a reused nullifier) that links one person's proofs to each other or to their revocation?
2. **What the verifier sees.** What public effect does a successful proof have, and how is it bound to a specific request from the study or clinic? If an unbound proof could be replayed or reused by someone else, replay protection moves into the MVP.
3. **Ledger contents.** List every public field and why it's needed. Small per-study counts plus timing can identify participants; note how the design handles that.

**Interface first.** Fix the exported circuit names and signatures before implementing. Task 6 reuses them, and its hidden tests are these tests.

**Tests** (run against the compiled contract in a local simulator; no devnet or deployment needed, but confirm the pattern in `compact-examples`):
- register → prove succeeds
- revoke → prove fails
- non-holder can't revoke
- ledger holds no plaintext secrets
- if decision 1 allows it: two proofs by the same participant share no public value

**Review**: run the `compact-core` privacy/code review on the finished contract and record what it finds.

**Stretch** (park unless ahead of schedule): prove an eligibility attribute (e.g., age ≥ 18) without revealing the value; a minimal frontend via `midnight-dapp-dev`.

Log every snag in `FRICTION_LOG.md` as it happens, including setup.

---

## Part 2 — The scorecard

### Setups

Same model, effort settings, machine, Claude Code version, Compact toolchain and permission flags in every setup. Web search and fetch stay enabled in every setup (Claude Code's default); the harness logs every web lookup.

| ID | Setup | What it represents |
|----|-------|--------------------|
| A | Claude Code, no Midnight tooling | Baseline: an agent with no Midnight help |
| B | A + Kapa MCP | Docs grounding only: roughly what a Cursor/Copilot user can get today |
| R | B + a short rules file (`CLAUDE.md` in the sandbox) telling the agent to compile with the Compact CLI and fix all errors before saying it's done | Docs plus a cheap verification habit any agent could get from a rules file |
| C | B + all 16 Midnight Expert plugins (GitHub main @ `212d7c2c`) | Midnight's recommended full setup |
| P | C with the PR #290 patch (Midnight Expert @ `5697c55`, `midnight-expert#290`) | Measures the upstream contribution (Part 3); task 02 only, 6 runs |
| M | B + the local compile MCP server (`compile-mcp/`, built and copied outside the repo per run) | Part 4: a compile tool any MCP client can use, with no plugins and no rules file |

A→B shows what docs grounding adds. B→R shows what a compile-before-done rule adds. R→C shows what Midnight Expert adds beyond docs and compile discipline.

The Compact CLI is installed in every setup, because a real developer would have it. The question is whether the agent knows to use it.

Setup C's plugin set: the 16 plugins `install.sh` installs, loaded with `--plugin-dir` from a local clone of GitHub main checked out at `212d7c2c` (`~/midnight-eval-sandboxes/_tooling/midnight-expert`). `run.sh` refuses to start a C run if the clone has moved. Optional tier 2: the same tasks against the stable marketplace, to measure what its staleness costs users.

### Harness and isolation

Every scored run goes through `evals/harness/run.sh <setup> <task> <run>`, started from a plain terminal. Don't start it from inside a Claude Code session or VS Code, which add environment variables and editor context. The script:

1. Creates a fresh sandbox containing only the task's starter files (plus the rules file for R).
2. Runs headless Claude Code in the sandbox, launched with `env -i` so no `CLAUDE_*` variables leak in:
   - `CLAUDE_CONFIG_DIR=~/.claude-eval`: a separate, clean Claude Code config with no personal plugins, skills, agents, CLAUDE.md, memory or claude.ai connectors. Log in once and keep it identical all week.
   - `claude -p "<prompt.md>" --model claude-sonnet-5-5 --output-format stream-json --verbose --max-turns 50 --mcp-config setups/<none|kapa>.mcp.json --strict-mcp-config --permission-mode bypassPermissions --disallowedTools "Bash(compact update *)" "Bash(compact self *)" "Bash(compact clean *)"`, plus 16 `--plugin-dir` flags for C. The deny list stops an agent from changing the shared toolchain mid-week.
   - A 20-minute wall-clock cap via `gtimeout` (coreutils).
   - A per-run access policy (`setups/eval-settings.json`, saved as `runs/<id>/settings.json`). The agent can read its own sandbox, the toolchain (`~/.compact`, `~/.local/bin`, `~/.nvm`), caches (`~/.npm`, `~/.cache/midnight`), `/tmp`, and the pinned plugin clone, and nothing else in `$HOME`. The OS enforces this for Bash through Claude Code's sandbox; permission rules enforce it for Claude's file tools. This was added after an unrestricted agent searched the whole disk (FRICTION_LOG F-08).
3. **Checks the init event.** The first stream-json event lists the loaded model, tools, MCP servers and plugins. The run is void if anything falls outside the setup's allowlist (e.g., any `mcp__` tool in A).
4. Runs Phase 2 if needed (see below) via `--resume <session-id>`.
5. Runs `score.sh` and appends one row to `results.csv`, then saves the transcript and score output to `evals/runs/<setup>-<task>-r<n>/`.

**Day 1 checks:**
- ~~Kapa sign-in works under `~/.claude-eval` in headless mode.~~ Resolved 2026-11-05: after one interactive `/mcp` sign-in, headless runs report `midnight` as `connected`, with tools `search_midnight_knowledge_sources` and `give_feedback`.
- ~~`--strict-mcp-config` might block MCP servers that Midnight Expert plugins provide.~~ Resolved: the plugins ship no MCP servers.

If Kapa sign-in can't work headless, run B, R and C interactively with the same prompts and caps, and log it as friction.

### Tasks (7)

Each `evals/tasks/<id>/` folder contains:
- `prompt.md`: identical across setups. Names the output file path and the exported circuit names and signatures, so hidden tests can call them.
- `starter/`: files copied into the sandbox.
- `hidden-tests/`: run by `score.sh` and never copied into the sandbox.
- `reference/`: a solution that passes the hidden tests with the pinned compiler. No passing reference, no task.
- `notes.md`: acceptance criteria, scoring notes, and the only allowed answers to clarifying questions.

1. **Counter**: ledger counter with increment and read. Baseline and harness smoke test.
2. **Token**: mint, transfer, burn. Hidden tests check the resulting ledger state.
3. **Private input**: store a commitment to a private value. Hidden tests check that the value never appears in ledger state.
4. **Disclosure trap**: a requirement whose naive solution leaks a witness value. Pass = hidden tests pass **and** the only disclosed value is the intended one (hidden test on ledger state + manual review of every `disclose()`). Compiling isn't enough, because wrapping everything in `disclose()` compiles.
5. **Sealed-bid vote**: commit/reveal voting with correct disclosure rules. First to cut if Day 2 slips, since it overlaps most with tasks 3–4.
6. **Consent attestation**: the Part 1 spec and interface. Hidden tests = the Part 1 tests.
7. **Fix-it**: a contract with 2–3 seeded bugs, taken from real failures in the Part 1 build and in tier-1 runs of tasks 1–5.

The frontend task is parked in `NEXT_STEPS.md`.

### Run protocol

- **Phase 1 (autonomous)**: one headless call with the task prompt. If the agent stops without claiming done, or asks a clarifying question, resume once with "continue" or with the answer from `notes.md`. That doesn't count as an intervention.
- Score `compiled_first` and `tests_pass_first` with `score.sh`, not the agent's claim.
- **Phase 2 (assisted)**: if it doesn't compile, resume with the compiler output, max 3 times. Each paste = 1 intervention. Then score `compiled_final` and `tests_pass_final`.
- **Volume**:
  - Tier 1 (required): 7 tasks × 4 setups × 1 run = 28 runs.
  - Tier 2 (if the harness is stable by Day 3): 2 more runs of tasks 1, 4 and 6 in every setup (+24 runs), giving 3 runs per cell for those tasks.
- Report small samples as counts ("2 of 3 runs"), never as percentages.

### Metrics — `results.csv` columns

```
date,setup,task,run,model,compact_version,harness_commit,compiled_first,compiled_final,tests_pass_first,tests_pass_final,verified_before_claiming_done,interventions,hallucinated_apis,privacy_errors,agent_turns,minutes,cost_usd,web_lookups,mcp_calls,skill_calls,failure_tags,notes
```

**Automated** (`score.sh` + `parse-run.ts`): `compiled_*`, `tests_pass_*`, `verified_before_claiming_done`, `interventions`, `agent_turns`, `minutes`, `cost_usd`, `web_lookups`, `mcp_calls`, `skill_calls`.
**Manual** (my review of the transcript): `hallucinated_apis`, `privacy_errors`, `failure_tags`, `notes`.

- `verified_before_claiming_done`: the agent ran the compiler after its last edit to a `.compact` file and before its final message. Computed from the transcript. (This is Midnight Expert's core promise.)
- `hallucinated_apis`: distinct non-existent syntax, stdlib or SDK names. Start from unknown-identifier and parse errors in the first independent compile, then add any found on review.
- `privacy_errors`: unintended disclosure, or disclosure-related compile errors.
- `harness_commit`: the repo commit at run time. It pins tasks, hidden tests and setup configs.
- `mcp_calls` / `skill_calls`: whether the agent actually used the tooling it had.
- `failure_tags` (use only these): `invented-syntax`, `stale-syntax`, `disclosure`, `sdk-mismatch`, `toolchain`, `false-success`, `loop-or-gave-up`, `docs-gap`, `tool-not-used`.

`rubric.md` defines each field with one worked example.

### Environment record (fill in on Day 1)

| Item | Value |
|------|-------|
| OS | macOS 26.6.2 (arm64) |
| Claude Code version | 2.1.220 |
| Model and effort/thinking settings | `claude-sonnet-5-5`; effort left at default (no `--effort`) |
| Harness permission flags | `--permission-mode bypassPermissions` + deny `compact update/self/clean`; throwaway sandboxes outside the repo |
| Compact CLI, compiler and `language_version` | CLI 0.5.3; compiler 0.36.0 (b5d9e4dfc, released 2026-11-03); language 0.28.0 |
| Node | 22.23.1 |
| `@midnight-ntwrk/compact-runtime` version | 0.21.0 (hidden tests; matches compiler 0.36.0) |
| Midnight Expert source and install method | GitHub main @ `212d7c2c` (2026-10-28). Repo build: project-scope GitHub marketplace. Eval runs: `--plugin-dir` from a pinned local clone |
| Midnight Expert plugins and versions (setup C) | compact-cli-dev 0.6.0, compact-core 0.12.0, compact-examples 0.5.0, core-concepts 0.3.2, midnight-cq 0.4.0, midnight-dapp-dev 0.6.0, midnight-expert 0.8.1, midnight-fact-check 0.5.0, midnight-indexer 0.3.0, midnight-node 0.3.0, midnight-plugin-utils 0.1.1, midnight-status-codes 0.11.0, midnight-tooling 0.4.0, midnight-verify 0.14.1, midnight-wallet 0.6.0, proof-server 0.2.0 |
| MCP servers loaded per setup (from the init event) | A: none. B, R, C, P: `midnight` (Kapa) only. C and P add 88 plugin skills and 22 agents, no MCP servers. M: `midnight` (Kapa) + `compact` (compile-mcp 0.1.0) |
| Baseline loaded in every setup (not Midnight-specific) | Claude Code built-in plugins (`cc-plugin-agents-md`, `cc-plugin-telemetry`, `cc-plugin-privacy`, `cc-plugin-plugin-authoring`, all `@builtin`), Claude Code's bundled skills, and account-synced `anthropic-skills:*` (docs, docx, pdf, pptx, xlsx, …). Identical across setups; the full list is in each run's init event |
| Kapa MCP URL and auth | https://midnight.mcp.kapa.ai, sign-in required |
| Docker (only if devnet or proof server is needed) | 28.1.1 (installed; not yet needed) |
| Dates of runs | A, B, R, C, P: 2026-11-05. M: 2026-11-11. 61 scored rows in `evals/results.csv` |

---

## Part 3 — Upstream contribution (half a day, Day 4)

Pick the most important gap in the data: the most frequent failure in setup C, or the highest-severity friction item. Then either:

- open a pull request to midnight-expert (e.g., fix a stale or missing reference in a skill), rerun the affected task(s) in C with the patched plugin loaded via `--plugin-dir`, and report before/after; or
- file a detailed issue (via `/midnight-expert:feedback` or GitHub) with repro steps, a transcript excerpt and a proposed fix.

Link it from `FRICTION_LOG.md` and the README.

---

## Part 4 — Stretch: local Compact compile MCP server

Only after Day 5, or instead of tier-2 repeats if the Day 3 checkpoint is hit early.

**Why**: since `midnight-mcp` was retired (25 June 2026), agents outside Claude Code (Cursor, Copilot, Claude Desktop) have no tool for compiling Compact, only Kapa's docs Q&A.

**Scope**: TypeScript, official MCP SDK, stdio transport, published to npm so `npx` works in any client. Marked unofficial; no "midnight" in the package name.

**Tools**
- `compile_contract(path)` → `{ ok, compiler_version, errors: [{ file, line, column, message }] }`, using the developer's locally installed compiler. Its description tells the agent to call it after every change to a `.compact` file and before saying the contract works.
- `toolchain_info()` → installed compiler and language version (so the agent writes the right `pragma`), or install steps if the compiler is missing.
- Optional: `format_contract(path)` via `compact format`.

**Out of scope**: docs search (Kapa does it), deploy or wallet tools, a hosted compiler.

**Safety**: run the compiler with `execFile` (no shell), accept only paths inside the workspace root, cap run time and output size.

**Tests**: eval reference solutions compile; real Phase 1 failures fail with the expected errors.

**Measure**: setup M = B + this server (no plugins, no rules file). Compare with B, R and C on tasks 3, 4 and 6, plus one manual smoke run in Cursor or VS Code Copilot.

---

## Friction log format (`FRICTION_LOG.md`)

| ID | Setup / task | What happened | Repro | Severity (blocker / major / minor) | Likely cause (missing skill / stale reference / toolchain / docs gap / model) | Suggested fix | Filed upstream |
|----|--------------|---------------|-------|------------------------------------|------------------------------------------------------------------------------|---------------|----------------|

File clear bugs via `/midnight-expert:feedback` or a GitHub issue, and link them here.

## README (write last)

Rules: findings before method. Plain language. Each finding = one claim + one number + why it matters. One "Limits" section instead of hedging every sentence. Under ~600 words plus the scorecard table.

Outline:
1. What this is (2 sentences)
2. Three findings
3. Scorecard table
4. How it was run (setups, versions, harness, protocol)
5. Limits: pilot size, single model, single machine, and that the same person built Part 1 with setup C and wrote the tasks
6. Friction highlights, issues filed, and the upstream contribution
7. What I'd build next → `NEXT_STEPS.md`
8. The consent contract

`NEXT_STEPS.md`: ideas to test against the data, not assume:
- Bringing compile-verification to non-Claude-Code agents (rules files, or a thin MCP server wrapping the compiler). Setup R gives a first data point. Prior art: the deprecated `midnight-mcp` had a `compile-contract` tool backed by a hosted compiler; the third-party `midnight-nextjs-mcp` has a local one but hasn't been published since Jan 2026.
- Turning this harness into a recurring regression suite for Midnight Expert releases. Claude Code's `claude plugin eval` (early access as of Nov 2026) compares plugin vs. no-plugin runs and may fit.
- Accuracy evals for Kapa's answers
- Adoption and usefulness metrics for the AI dev tools
- Parked tasks: frontend (Vite + React DApp wired to the counter; pass = builds and type-checks), eligibility proofs

## Week plan

- **Day 1 — Setup and harness**: check OS and prerequisites; install the current Compact toolchain; create the `~/.claude-eval` config; register the marketplace; install Midnight Expert at project scope in this repo; run both doctors; fill in the environment record. Scaffold the repo, `rubric.md`, the `results.csv` header and the harness. Build task 1 (counter) end to end: reference solution, hidden test, and one harness run per setup that writes a real CSV row. Settle both Day 1 checks.
- **Day 2 — Tasks and design**: write tasks 2–5 with references and hidden tests; freeze 1–5 and start tier-1 runs in the background. Settle the Part 1 design decisions with me, fix the interface, and write task 6.
- **Day 3 — Build**: finish the consent contract, tests and privacy review. Draft task 7 from real failures. Freeze 6–7 and run them. **Checkpoint:** tier-1 results for all tasks; the repo could be published from here.
- **Day 4 — Depth**: tier-2 repeats, manual scoring, friction log, upstream contribution.
- **Day 5 — Write**: `NEXT_STEPS.md`, then `README.md`. Publish the repo. File remaining upstream issues.

### Definition of done

- [x] Consent contract compiles, tests pass, `DESIGN.md` decisions recorded, privacy review run and recorded
- [x] Every task has a passing reference solution and hidden tests
- [x] 28 tier-1 runs scored through the harness, transcripts in `evals/runs/`
- [x] `FRICTION_LOG.md` with repro steps
- [x] One upstream contribution (PR with before/after, or detailed issue) linked
- [x] README findings-first; `NEXT_STEPS.md` grounded in the data
- [x] Environment, versions and harness flags recorded

## Kickoff prompt for the first session

> Read CLAUDE.md. Let's do Day 1. First check my OS and what's installed (node, docker, claude version, Compact toolchain) and tell me what's missing or outdated. Then scaffold the repo layout, rubric.md, the results.csv header, and the harness skeleton (run.sh, score.sh, setups/). Then build task 1 end to end (reference solution, hidden test, score.sh working against it) before writing any other task. Don't start the consent contract yet.
