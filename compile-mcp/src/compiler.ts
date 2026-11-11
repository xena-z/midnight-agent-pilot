// Runs the locally installed Compact compiler and turns its output into structured results.
// No shell is involved: every command goes through execFile with a fixed argument list.
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const MAX_OUTPUT_BYTES = 256 * 1024;
export const INSTALL_STEPS = [
  'The Compact toolchain was not found on PATH.',
  'Install it: curl --proto =https --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh',
  'Then install a compiler: compact update',
  'More: https://github.com/midnightntwrk/compact',
].join('\n');

export interface CompileError {
  file: string | null;
  line: number | null;
  column: number | null;
  message: string;
}

export interface CompileResult {
  ok: boolean;
  compiler_version: string | null;
  errors: CompileError[];
  duration_ms: number;
  output_dir?: string;
  timed_out?: boolean;
  raw_output?: string;
}

export interface ToolchainInfo {
  installed: boolean;
  cli_version: string | null;
  compiler_version: string | null;
  language_version: string | null;
  runtime_version: string | null;
  pragma: string | null;
  install_steps?: string;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  notFound: boolean;
}

export function run(cmd: string, args: string[], opts: { cwd?: string; timeoutMs: number }): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd: opts.cwd, timeout: opts.timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, killSignal: 'SIGKILL', windowsHide: true },
      (err, stdout, stderr) => {
        const e = err as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
        resolve({
          code: e ? (typeof e.code === 'number' ? e.code : null) : 0,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
          timedOut: Boolean(e?.killed),
          notFound: e?.code === 'ENOENT',
        });
      },
    );
  });
}

/** Parse compiler output. Each error starts with `Exception: <file> line <n> char <m>:` followed by indented lines. */
export function parseErrors(output: string): CompileError[] {
  const errors: CompileError[] = [];
  const blocks = output.split(/^Exception: /m).slice(1);
  for (const block of blocks) {
    const [head, ...rest] = block.replace(/\s+$/, '').split('\n');
    const loc = /^(.*?) line (\d+) char (\d+):\s*(.*)$/.exec(head);
    const body = rest.map((l) => l.replace(/^ {2}/, '')).join('\n').trim();
    if (loc) {
      const inline = loc[4].trim();
      errors.push({
        file: loc[1],
        line: Number(loc[2]),
        column: Number(loc[3]),
        message: [inline, body].filter(Boolean).join('\n'),
      });
    } else {
      errors.push({ file: null, line: null, column: null, message: [head.trim(), body].filter(Boolean).join('\n') });
    }
  }
  return errors;
}

/** Resolve `p` against `root` and refuse anything outside it (after following symlinks). */
export async function resolveInside(root: string, p: string): Promise<string> {
  const realRoot = await realpath(root);
  const abs = path.resolve(realRoot, p);
  let real: string;
  try {
    real = await realpath(abs);
  } catch {
    throw new Error(`File not found: ${p}`);
  }
  const rel = path.relative(realRoot, real);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path is outside the workspace root (${realRoot}): ${p}`);
  }
  return real;
}

/** Same check for an output directory that may not exist yet: its nearest existing parent must be inside root. */
export async function resolveOutDir(root: string, p: string): Promise<string> {
  const realRoot = await realpath(root);
  const abs = path.resolve(realRoot, p);
  let probe = abs;
  for (;;) {
    try {
      const real = await realpath(probe);
      const rel = path.relative(realRoot, real);
      if (rel.startsWith('..') || path.isAbsolute(rel)) break;
      return path.join(real, path.relative(probe, abs));
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
  }
  throw new Error(`Output directory is outside the workspace root (${realRoot}): ${p}`);
}

export class Compiler {
  constructor(
    readonly root: string,
    readonly bin = 'compact',
  ) {}

  async compilerVersion(): Promise<string | null> {
    const r = await run(this.bin, ['compile', '--version'], { timeoutMs: 15_000 });
    return r.code === 0 ? r.stdout.trim().split(/\s+/)[0] || null : null;
  }

  async toolchainInfo(): Promise<ToolchainInfo> {
    const cli = await run(this.bin, ['--version'], { timeoutMs: 15_000 });
    if (cli.notFound || cli.code !== 0) {
      return { installed: false, cli_version: null, compiler_version: null, language_version: null, runtime_version: null, pragma: null, install_steps: INSTALL_STEPS };
    }
    const [compiler, language, runtime] = await Promise.all([
      this.compilerVersion(),
      run(this.bin, ['compile', '--language-version'], { timeoutMs: 15_000 }),
      run(this.bin, ['compile', '--runtime-version'], { timeoutMs: 15_000 }),
    ]);
    const lang = language.code === 0 ? language.stdout.trim() : null;
    const short = lang?.split('.').slice(0, 2).join('.');
    return {
      installed: true,
      cli_version: cli.stdout.trim().replace(/^compact\s+/, '') || null,
      compiler_version: compiler,
      language_version: lang,
      runtime_version: runtime.code === 0 ? runtime.stdout.trim() : null,
      pragma: short ? `pragma language_version >= ${short};` : null,
      ...(compiler ? {} : { install_steps: 'The compact CLI is installed but has no compiler. Run: compact update' }),
    };
  }

  async compile(file: string, opts: { outDir?: string; skipZk?: boolean; timeoutMs?: number } = {}): Promise<CompileResult> {
    const started = Date.now();
    const src = await resolveInside(this.root, file);
    if (!src.endsWith('.compact')) throw new Error(`Not a .compact file: ${file}`);
    if (!(await stat(src)).isFile()) throw new Error(`Not a file: ${file}`);
    const keep = opts.outDir !== undefined;
    const out = keep ? await resolveOutDir(this.root, opts.outDir!) : await mkdtemp(path.join(tmpdir(), 'compact-mcp-'));
    const realRoot = await realpath(this.root);
    const args = ['compile', ...(opts.skipZk === false ? [] : ['--skip-zk']), path.relative(realRoot, src), out];
    try {
      const [version, r] = await Promise.all([
        this.compilerVersion(),
        run(this.bin, args, { cwd: realRoot, timeoutMs: opts.timeoutMs ?? 120_000 }),
      ]);
      if (r.notFound) {
        return { ok: false, compiler_version: null, errors: [{ file: null, line: null, column: null, message: INSTALL_STEPS }], duration_ms: Date.now() - started };
      }
      const output = `${r.stderr}${r.stderr && r.stdout ? '\n' : ''}${r.stdout}`;
      const errors = parseErrors(output);
      const ok = r.code === 0 && !r.timedOut && errors.length === 0;
      if (!ok && errors.length === 0) {
        errors.push({
          file: null,
          line: null,
          column: null,
          message: r.timedOut ? `Compiler timed out after ${opts.timeoutMs ?? 120_000} ms` : output.trim() || `Compiler exited with code ${r.code}`,
        });
      }
      return {
        ok,
        compiler_version: version,
        errors,
        duration_ms: Date.now() - started,
        ...(keep && ok ? { output_dir: path.relative(realRoot, out) || '.' } : {}),
        ...(r.timedOut ? { timed_out: true } : {}),
        ...(!ok && errors.every((e) => e.line === null) ? { raw_output: output.slice(0, 4000) } : {}),
      };
    } finally {
      if (!keep) await rm(out, { recursive: true, force: true });
    }
  }

  async format(file: string, check: boolean): Promise<{ ok: boolean; changed: boolean | null; output: string }> {
    const src = await resolveInside(this.root, file);
    if (!src.endsWith('.compact')) throw new Error(`Not a .compact file: ${file}`);
    const realRoot = await realpath(this.root);
    const r = await run(this.bin, ['format', ...(check ? ['--check'] : []), path.relative(realRoot, src)], { cwd: realRoot, timeoutMs: 60_000 });
    const output = `${r.stderr}${r.stdout}`.trim();
    // `compact format` exits 1 both when --check finds a diff and when it can't parse the file; only the first prints a diff.
    const hasDiff = /^\s*[+-]\s+\d+ \|/m.test(output);
    if (r.code !== 0 && !hasDiff) {
      return { ok: false, changed: null, output: `${output}\nThe formatter could not parse this file. Run compile_contract to see the errors.` };
    }
    if (check) return { ok: true, changed: r.code !== 0, output };
    return { ok: r.code === 0, changed: null, output };
  }
}
