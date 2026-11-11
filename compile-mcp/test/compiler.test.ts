import { chmod, mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Compiler, parseErrors } from '../src/compiler.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const tasks = path.join(repo, 'evals/tasks');

let ws: string;
beforeAll(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'ccm-test-'));
});
afterAll(async () => {
  await rm(ws, { recursive: true, force: true });
});

const PRAGMA = 'pragma language_version >= 0.22;\nimport CompactStandardLibrary;\n';

describe('parseErrors', () => {
  it('splits several located errors with multi-line messages', () => {
    const out = [
      'Exception: disc.compact line 6 char 28:',
      '  potential witness-value disclosure must be declared but is not:',
      '    witness value potentially disclosed:',
      '      the return value of witness secret at line 3 char 1',
      'Exception: disc.compact line 6 char 42:',
      '  potential witness-value disclosure must be declared but is not:',
    ].join('\n');
    const errs = parseErrors(out);
    expect(errs).toHaveLength(2);
    expect(errs[0]).toMatchObject({ file: 'disc.compact', line: 6, column: 28 });
    expect(errs[0].message).toContain('the return value of witness secret');
    expect(errs[1]).toMatchObject({ line: 6, column: 42 });
  });
  it('keeps errors without a location', () => {
    expect(parseErrors('Exception: something broke\n')).toEqual([{ file: null, line: null, column: null, message: 'something broke' }]);
  });
  it('returns nothing for clean output', () => {
    expect(parseErrors('Compiling 2 circuits:\n')).toEqual([]);
  });
});

describe('compile_contract against the real compiler', () => {
  it('compiles every eval reference solution', async () => {
    const c = new Compiler(repo);
    const ids = (await readdir(tasks)).filter((d) => !d.startsWith('.'));
    let n = 0;
    for (const id of ids) {
      const dir = path.join(tasks, id, 'reference');
      for (const f of (await readdir(dir, { recursive: true })).map(String).filter((f) => f.endsWith('.compact'))) {
        const rel = path.relative(repo, path.join(dir, f));
        const r = await c.compile(rel);
        expect(r.ok, `${rel}: ${JSON.stringify(r.errors)}`).toBe(true);
        expect(r.compiler_version).toMatch(/^\d+\.\d+\.\d+$/);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(7);
  }, 300_000);

  it('reports the seeded bugs in the fix-it starter (a real Phase 1 failure: `const from`)', async () => {
    const dir = path.join(tasks, '07-fix-it/starter');
    const f = (await readdir(dir, { recursive: true })).find((f) => String(f).endsWith('.compact'))!;
    const r = await new Compiler(repo).compile(path.relative(repo, path.join(dir, String(f))));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain('found keyword "from"');
    expect(r.errors[0].line).toBeGreaterThan(0);
    expect(r.errors[0].file).toMatch(/\.compact$/);
  }, 120_000);

  it('reports every disclosure error with its location', async () => {
    await writeFile(
      path.join(ws, 'disc.compact'),
      `${PRAGMA}witness secret(): Field;\nexport ledger x: Field;\nexport ledger y: Field;\nexport circuit f(): [] { x = secret(); y = secret(); }\n`,
    );
    const r = await new Compiler(ws).compile('disc.compact');
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(2);
    expect(r.errors.map((e) => e.column)).toEqual([28, 42]);
    expect(r.errors[0].message).toMatch(/^potential witness-value disclosure must be declared/);
  }, 60_000);

  it('keeps output only when out_dir is given', async () => {
    await writeFile(path.join(ws, 'ok.compact'), `${PRAGMA}export ledger c: Counter;\nexport circuit inc(): [] { c.increment(1); }\n`);
    const c = new Compiler(ws);
    const r = await c.compile('ok.compact', { outDir: 'build/ok' });
    expect(r).toMatchObject({ ok: true, output_dir: 'build/ok' });
    expect((await stat(path.join(ws, 'build/ok/contract/index.js'))).isFile()).toBe(true);
    const r2 = await c.compile('ok.compact');
    expect(r2.ok).toBe(true);
    expect(r2.output_dir).toBeUndefined();
  }, 60_000);
});

describe('format_contract', () => {
  it('checks, formats, and refuses to guess on a syntax error', async () => {
    await writeFile(path.join(ws, 'u.compact'), `${PRAGMA}export ledger c:Counter;\nexport circuit inc():[]{c.increment(1);}\n`);
    await writeFile(path.join(ws, 'broken.compact'), `${PRAGMA}export circuit f(): [] { const from = 1; }\n`);
    const c = new Compiler(ws);
    expect(await c.format('u.compact', true)).toMatchObject({ ok: true, changed: true });
    expect(await c.format('u.compact', false)).toMatchObject({ ok: true });
    expect(await c.format('u.compact', true)).toMatchObject({ ok: true, changed: false });
    expect(await c.format('broken.compact', true)).toMatchObject({ ok: false, changed: null, output: expect.stringContaining('compile_contract') });
  }, 60_000);
});

describe('safety', () => {
  it('rejects paths outside the workspace root', async () => {
    const c = new Compiler(ws);
    await expect(c.compile('../x.compact')).rejects.toThrow(/outside the workspace root|not found/i);
    await expect(c.compile(path.join(repo, 'contract/consent.compact'))).rejects.toThrow(/outside the workspace root/);
  });
  it('rejects a symlink that escapes the root', async () => {
    await symlink(path.join(repo, 'contract/consent.compact'), path.join(ws, 'escape.compact'));
    await expect(new Compiler(ws).compile('escape.compact')).rejects.toThrow(/outside the workspace root/);
  });
  it('rejects an out_dir outside the root, and non-.compact files', async () => {
    await writeFile(path.join(ws, 'a.compact'), `${PRAGMA}export circuit f(): [] {}\n`);
    await writeFile(path.join(ws, 'notes.txt'), 'hi');
    const c = new Compiler(ws);
    await expect(c.compile('a.compact', { outDir: '../elsewhere' })).rejects.toThrow(/outside the workspace root/);
    await expect(c.compile('notes.txt')).rejects.toThrow(/Not a \.compact file/);
  });
  it('treats file names as data, not shell input', async () => {
    const name = 'x; touch pwned $(id).compact';
    await writeFile(path.join(ws, name), `${PRAGMA}export circuit f(): [] {}\n`);
    const r = await new Compiler(ws).compile(name);
    expect(r.ok).toBe(true);
    expect((await readdir(ws)).some((f) => f.startsWith('pwned'))).toBe(false);
  }, 60_000);
  it('returns install steps when the toolchain is missing', async () => {
    const c = new Compiler(ws, path.join(ws, 'no-such-compact'));
    expect(await c.toolchainInfo()).toMatchObject({ installed: false, install_steps: expect.stringContaining('compact-installer.sh') });
    const r = await c.compile('a.compact');
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain('compact-installer.sh');
  });
  it('kills a compiler that runs past the time limit', async () => {
    const bin = path.join(ws, 'slow-compact');
    await writeFile(bin, '#!/bin/sh\nif [ "$2" = "--version" ]; then echo 0.0.0; exit 0; fi\nsleep 30\n');
    await chmod(bin, 0o755);
    const r = await new Compiler(ws, bin).compile('a.compact', { timeoutMs: 500 });
    expect(r).toMatchObject({ ok: false, timed_out: true });
    expect(r.duration_ms).toBeLessThan(10_000);
  }, 20_000);
});

describe('MCP server over stdio', () => {
  it('lists the tools and compiles through a real client', async () => {
    await mkdir(path.join(ws, 'mcp'), { recursive: true });
    await writeFile(path.join(ws, 'mcp/bad.compact'), `${PRAGMA}export circuit f(): Field { const from = 1; return from; }\n`);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve(here, '../dist/cli.js'), '--root', path.join(ws, 'mcp')],
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
      stderr: 'pipe',
    });
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(['compile_contract', 'format_contract', 'toolchain_info']);
      expect(tools.find((t) => t.name === 'compile_contract')!.description).toContain('before saying a contract works');

      const info = (await client.callTool({ name: 'toolchain_info', arguments: {} })).structuredContent as any;
      expect(info).toMatchObject({ installed: true, pragma: expect.stringMatching(/^pragma language_version >= \d+\.\d+;$/) });

      const res = (await client.callTool({ name: 'compile_contract', arguments: { path: 'bad.compact' } })).structuredContent as any;
      expect(res.ok).toBe(false);
      expect(res.errors[0]).toMatchObject({ file: 'bad.compact', line: 3 });
      expect(res.errors[0].message).toContain('found keyword "from"');

      const outside = await client.callTool({ name: 'compile_contract', arguments: { path: '../disc.compact' } });
      expect(outside.isError).toBe(true);
    } finally {
      await client.close();
    }
  }, 120_000);
});
