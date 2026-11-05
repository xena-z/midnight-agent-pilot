# Next steps

Each item comes from the pilot data (`evals/results.csv`, `FRICTION_LOG.md`). Each one is a hypothesis to test, not a conclusion.

1. **Make the soundness checks hard to miss.** The only security bug (task 6: a Merkle path not tied to the caller) appeared in 2 of 9 runs without Midnight Expert and 0 of 3 with it. Next test: put this check in Kapa's answers and in a short rules file, then rerun task 6 in setups A and R 5 times each.
2. **Find out why agents don't call Kapa.** The agents made 0 Kapa calls in 33 runs that had it. Next test: rewrite the tool description (e.g., "use before writing Compact syntax you haven't verified with the compiler"), and give the agent tasks that need recent changes, such as runtime 0.21's async circuits.
3. **Keep the stable channel current** (F-01 to F-03): republish stable, bump versions whenever content changes (a CI check could enforce this), and have `/midnight-expert:doctor` show the pinned commit and its date.
4. **Fill small docs gaps found by agents:** a reserved-words list that includes `from` (F-11), when `export` is required on ledger fields (F-12), and the compiler/runtime versions the testing skill supports (F-04).
5. **Turn this harness into a regression suite.** Run it against each Midnight Expert release and compiler release; a full tier-1 run costs about $5. Claude Code's `claude plugin eval` (early access) may replace parts of it.
6. **Write harder tasks.** Tasks 1–5 didn't separate the setups. Next candidates: writing TypeScript tests against runtime 0.21, multi-contract flows, and a DApp frontend.
7. **Compile checks outside Claude Code.** The retired `midnight-mcp` had a compile tool; nothing replaces it for Cursor or Copilot users. A small local MCP server is sketched in CLAUDE.md (Part 4). Setup R suggests a rules file already gives most of the benefit when the agent can run a shell.
