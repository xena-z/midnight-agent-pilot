# compact-compile-mcp

An unofficial MCP server that lets any AI coding agent compile [Compact](https://docs.midnight.network) smart contracts with the compiler installed on your machine. Use it in Cursor, VS Code Copilot, Claude Desktop or Claude Code. Not affiliated with Midnight Foundation.

Agents writing Compact often produce code that looks right but doesn't compile: reserved words like `from`, disclosure rules for witness values, renamed ledger operations. This server gives the agent the compiler's real errors, with file, line and column, so it can fix them before saying it's done. The community `midnight-mcp` server used to provide a compile tool but was retired in June 2026. Kapa's Midnight MCP answers docs questions but doesn't compile.

> Not yet published to npm. Until it is, build from source (below) and point your client at `dist/cli.js`.

## Tools

| Tool | What it does |
|---|---|
| `compile_contract(path, out_dir?, zk?)` | Compiles a `.compact` file. Returns `{ ok, compiler_version, errors: [{ file, line, column, message }], duration_ms }`. By default it skips proving-key generation and discards the output. Pass `out_dir` to keep the generated TypeScript, or `zk: true` for full keys. |
| `toolchain_info()` | Reports the installed CLI, compiler, language and runtime versions, plus the matching `pragma` line. Returns install steps if the toolchain is missing. |
| `format_contract(path, check?)` | Runs `compact format`, or with `check: true` reports whether the file is already formatted. |

The `compile_contract` description tells the agent to compile after every change to a `.compact` file, and before saying a contract works.

## Requirements

- Node.js 20 or later
- The Compact toolchain (`compact` on your `PATH`):
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  compact update
  ```

## Setup

The server compiles only files inside its **workspace root**: the `--root` argument, else `COMPACT_MCP_ROOT`, else the directory it was started in. Set it to your project folder.

**Claude Code**
```bash
claude mcp add compact -- npx -y compact-compile-mcp --root "$PWD"
```

**VS Code** (`.vscode/mcp.json`)
```json
{
  "servers": {
    "compact": { "type": "stdio", "command": "npx", "args": ["-y", "compact-compile-mcp", "--root", "${workspaceFolder}"] }
  }
}
```

**Cursor** (`.cursor/mcp.json`) and **Claude Desktop** (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "compact": { "command": "npx", "args": ["-y", "compact-compile-mcp", "--root", "/absolute/path/to/your/project"] }
  }
}
```

From source: `npm ci && npm run build`, then use `node /path/to/compile-mcp/dist/cli.js --root …` as the command.

## Safety

- The compiler runs with `execFile` and a fixed argument list, never a shell. A file name like `x; rm -rf ~.compact` is passed as data.
- Paths are resolved with symlinks followed and must stay inside the workspace root. That applies to both the source file and `out_dir`.
- Each compile has a time limit (2 minutes, or 15 with `zk: true`), and output is capped at 256 KB.
- It uses your installed compiler only. It makes no network calls, and doesn't install or update anything.

## Does it help?

In the [Midnight agent pilot](../README.md), setup M (Claude Code + Kapa + this server, with no plugins and no rules file) ran the same 11 tasks as the other setups:
- **Tool use:** every agent called `compile_contract` (11 of 11), usually after `toolchain_info`. All their compiling went through it, though they could also have run the compiler from a shell.
- **Results:** every hidden test passed (11 of 11), for $0.95 in total.

For comparison, Kapa, which was also connected, got 0 calls. The pilot ran in Claude Code, where the agent has a shell anyway. The bigger expected benefit is in clients where it doesn't, and that's untested.

## Tests

```bash
npm test
```

15 tests, using the real compiler, check that:
- every pilot reference solution compiles;
- a real agent failure (`const from`) and seeded bugs are reported with their locations;
- multi-error disclosure output is parsed correctly;
- paths outside the root and symlink escapes are refused, and file names are never run as shell input;
- a missing toolchain returns install steps, and a hung compiler is stopped at the time limit;
- an MCP client can list and call every tool over stdio.

## Licence

Apache-2.0
