# Next steps

Draft. Each item is a hypothesis to test against the scorecard data, not a conclusion. This file gets rewritten on Day 5.

- **Compile verification outside Claude Code.** Rules files, or a small MCP server wrapping the local compiler (see CLAUDE.md, Part 4). Setup R gives a first data point. Prior art: the retired `midnight-mcp` had a `compile-contract` tool backed by a hosted compiler; the third-party `midnight-nextjs-mcp` has a local one but hasn't been published since January 2026.
- **A release regression suite for Midnight Expert.** Re-run this harness against each plugin release. Claude Code's `claude plugin eval` (early access as of November 2026) compares plugin vs. no-plugin runs and may fit.
- **Publishing hygiene** (from F-01 to F-03): keep the stable channel current, bump versions on every content change, and show the pinned commit in `/midnight-expert:doctor`.
- **Accuracy evals for Kapa's answers.**
- **Adoption and usefulness metrics** for the AI dev tools.
- **Parked tasks:** frontend (Vite + React DApp wired to the counter; pass = builds and type-checks), eligibility proofs.
