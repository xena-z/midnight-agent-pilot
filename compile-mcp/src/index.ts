// Unofficial MCP server that compiles Compact contracts with the locally installed compiler.
// Not affiliated with Midnight Foundation.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Compiler } from './compiler.js';

export const VERSION = '0.1.0';

export function rootFromArgs(argv: string[]): string {
  const i = argv.indexOf('--root');
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  return process.env.COMPACT_MCP_ROOT || process.cwd();
}

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> });
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true });

export function createServer(compiler: Compiler): McpServer {
  const server = new McpServer({ name: 'compact-compile', version: VERSION });

  server.registerTool(
    'compile_contract',
    {
      title: 'Compile a Compact contract',
      description:
        'Compile a Compact (.compact) smart contract with the locally installed Compact compiler and return its errors with file, line and column. ' +
        'Call this after every change to a .compact file, and before saying a contract works or is done: Compact changes often, and code that looks right frequently fails to compile ' +
        '(reserved words such as `from`, disclosure rules for witness values, ledger operation names). Fix every error and compile again until ok is true. ' +
        'By default it skips zero-knowledge key generation (fast) and discards the output; pass out_dir to keep the generated TypeScript and artifacts.',
      inputSchema: {
        path: z.string().describe('Path to the .compact file, relative to the workspace root'),
        out_dir: z.string().optional().describe('Keep compiler output here (relative to the workspace root). Omit to discard it.'),
        zk: z.boolean().optional().describe('Also generate proving keys (slow, minutes). Default false.'),
      },
      outputSchema: {
        ok: z.boolean(),
        compiler_version: z.string().nullable(),
        errors: z.array(z.object({ file: z.string().nullable(), line: z.number().nullable(), column: z.number().nullable(), message: z.string() })),
        duration_ms: z.number(),
        output_dir: z.string().optional(),
        timed_out: z.boolean().optional(),
        raw_output: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path, out_dir, zk }) => {
      try {
        return json(await compiler.compile(path, { outDir: out_dir, skipZk: !zk, timeoutMs: zk ? 900_000 : 120_000 }));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    'toolchain_info',
    {
      title: 'Compact toolchain info',
      description:
        'Report the installed Compact CLI, compiler, language and runtime versions, and the pragma line to use. ' +
        'Call this before writing a new contract so the pragma and syntax match the installed compiler, and so TypeScript code uses a matching @midnight-ntwrk/compact-runtime version. ' +
        'If the toolchain is missing, it returns install steps.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(await compiler.toolchainInfo()),
  );

  server.registerTool(
    'format_contract',
    {
      title: 'Format a Compact contract',
      description: 'Format a .compact file in place with `compact format`, or with check=true report whether it is already formatted without changing it.',
      inputSchema: {
        path: z.string().describe('Path to the .compact file, relative to the workspace root'),
        check: z.boolean().optional().describe('Only check; do not modify the file. Default false.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path, check }) => {
      try {
        return json(await compiler.format(path, Boolean(check)));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  return server;
}

export { Compiler };
