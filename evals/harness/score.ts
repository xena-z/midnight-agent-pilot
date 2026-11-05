// Independent scorer: compiles a contract with the pinned compiler and runs the task's hidden tests.
// Never trusts the agent's own claims or its own compile output.
//
// Usage (from evals/):
//   npx tsx harness/score.ts --task 01-counter --src <sandbox-or-reference-dir> --work .work/<id>/<label> [--json out.json]

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const EVALS = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COMPILER_PIN = '0.36.0';

type Task = { id: string; contract_path: string; interface: { circuits: string[]; ledger: string[] } };

export type Score = {
  task: string;
  src: string;
  compiler_version: string;
  found: boolean;
  compact_files_found: string[];
  compiled: boolean;
  compile_seconds: number;
  compile_output: string;
  interface_ok: boolean | null;
  interface_missing: string[];
  tests_ran: boolean;
  tests_total: number;
  tests_passed: number;
  tests_pass: boolean;
  test_failures: string[];
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function findCompactFiles(dir: string, base = dir, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'managed') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) findCompactFiles(p, base, out);
    else if (name.endsWith('.compact')) out.push(relative(base, p));
  }
  return out;
}

async function exec(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs: number }) {
  try {
    const r = await run(cmd, args, { ...opts, timeout: opts.timeoutMs, maxBuffer: 20 * 1024 * 1024 });
    return { code: 0, out: `${r.stdout}${r.stderr}` };
  } catch (e: any) {
    return { code: typeof e.code === 'number' ? e.code : 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}${e.killed ? '\n[killed: timeout]' : ''}` };
  }
}

export async function score(taskId: string, src: string, work: string): Promise<Score> {
  const task: Task = JSON.parse(readFileSync(join(EVALS, 'tasks', taskId, 'task.json'), 'utf8'));
  const contract = join(src, task.contract_path);
  const s: Score = {
    task: taskId, src, compiler_version: COMPILER_PIN, found: existsSync(contract),
    compact_files_found: existsSync(src) ? findCompactFiles(src) : [],
    compiled: false, compile_seconds: 0, compile_output: '', interface_ok: null, interface_missing: [],
    tests_ran: false, tests_total: 0, tests_passed: 0, tests_pass: false, test_failures: [],
  };
  if (!s.found) {
    s.compile_output = `contract not found at expected path ${task.contract_path}`;
    return s;
  }

  // Compiled output must live under evals/ so the generated code resolves the pinned compact-runtime.
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const managed = join(work, 'managed');
  const t0 = Date.now();
  const c = await exec('compact', ['compile', `+${COMPILER_PIN}`, contract, managed], { timeoutMs: 5 * 60_000 });
  s.compile_seconds = Math.round((Date.now() - t0) / 100) / 10;
  s.compile_output = c.out.trim();
  s.compiled = c.code === 0 && existsSync(join(managed, 'contract', 'index.js'));
  if (!s.compiled) return s;

  // Interface check: the prompt names the circuits and ledger fields the hidden tests rely on.
  const info = JSON.parse(readFileSync(join(managed, 'compiler', 'contract-info.json'), 'utf8'));
  const circuits = new Set<string>((info.circuits ?? []).map((x: any) => x.name));
  const ledger = new Set<string>((info.ledger ?? []).filter((x: any) => x.exported !== false).map((x: any) => x.name));
  s.interface_missing = [
    ...task.interface.circuits.filter((n) => !circuits.has(n)).map((n) => `circuit:${n}`),
    ...task.interface.ledger.filter((n) => !ledger.has(n)).map((n) => `ledger:${n}`),
  ];
  s.interface_ok = s.interface_missing.length === 0;

  const report = join(work, 'vitest.json');
  const t = await exec(
    'npx',
    ['vitest', 'run', `tasks/${taskId}/hidden-tests`, '--reporter=json', `--outputFile=${report}`],
    { cwd: EVALS, env: { ...process.env, CONTRACT_MODULE: join(managed, 'contract', 'index.js') }, timeoutMs: 5 * 60_000 },
  );
  if (existsSync(report)) {
    const r = JSON.parse(readFileSync(report, 'utf8'));
    s.tests_ran = true;
    s.tests_total = r.numTotalTests ?? 0;
    s.tests_passed = r.numPassedTests ?? 0;
    for (const f of r.testResults ?? [])
      for (const a of f.assertionResults ?? [])
        if (a.status !== 'passed') s.test_failures.push(`${a.title}: ${(a.failureMessages ?? []).join(' ').split('\n')[0]}`);
    s.tests_pass = s.tests_total > 0 && s.tests_passed === s.tests_total;
  } else {
    s.test_failures.push(`vitest produced no report (exit ${t.code}): ${t.out.split('\n').slice(-5).join(' ')}`);
  }
  return s;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const task = arg('task'), src = arg('src'), work = arg('work'), json = arg('json');
  if (!task || !src || !work) {
    console.error('usage: score.ts --task <id> --src <dir> --work <dir> [--json <file>]');
    process.exit(2);
  }
  const s = await score(task, resolve(src), resolve(work));
  if (json) writeFileSync(json, JSON.stringify(s, null, 2) + '\n');
  console.log(
    `${task}  found=${s.found} compiled=${s.compiled} interface_ok=${s.interface_ok} ` +
      `tests=${s.tests_passed}/${s.tests_total} tests_pass=${s.tests_pass}`,
  );
  if (!s.compiled) console.log(s.compile_output.split('\n').slice(0, 15).join('\n'));
  for (const f of s.test_failures) console.log(`  FAIL ${f}`);
}
