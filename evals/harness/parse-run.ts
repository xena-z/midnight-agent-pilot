// Reads Claude Code stream-json transcripts from one eval run.
//
//   npx tsx harness/parse-run.ts check-init <setup> <phase1.jsonl>
//       Exit 0 if the loaded model/MCP servers/plugins match the setup, 1 otherwise (run is void).
//   npx tsx harness/parse-run.ts last-result <file.jsonl>
//       Print the session id and whether the final message asks a question (for the one allowed reply).
//   npx tsx harness/parse-run.ts row <run-dir>
//       Print one results.csv row built from <run-dir>/meta.json, phase*.jsonl and score-*.json.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const CSV_COLUMNS = [
  'date', 'setup', 'task', 'run', 'model', 'compact_version', 'harness_commit',
  'compiled_first', 'compiled_final', 'tests_pass_first', 'tests_pass_final',
  'verified_before_claiming_done', 'interventions', 'hallucinated_apis', 'privacy_errors',
  'agent_turns', 'minutes', 'cost_usd', 'web_lookups', 'mcp_calls', 'skill_calls', 'hook_outputs',
  'compile_attempts', 'compile_failures',
  'failure_tags', 'notes',
] as const;

const EXPECTED_PLUGINS = 16;
const COMPILE_RE = /\bcompact\s+compile\b|\bcompactc\b/;
const COMPACT_FILE_RE = /\.compact\b/;

type Event = Record<string, any>;

function readEvents(file: string): Event[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim().startsWith('{'))
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e): e is Event => e !== null);
}

/** Every tool call in order, including calls made inside subagents. */
function toolUses(events: Event[]): { name: string; input: any }[] {
  const out: { name: string; input: any }[] = [];
  for (const e of events) {
    if (e.type !== 'assistant') continue;
    for (const block of e.message?.content ?? []) if (block.type === 'tool_use') out.push({ name: block.name, input: block.input ?? {} });
  }
  return out;
}

function isCompactEdit(t: { name: string; input: any }): boolean {
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(t.name)) return COMPACT_FILE_RE.test(String(t.input.file_path ?? ''));
  if (t.name === 'Bash') {
    const cmd = String(t.input.command ?? '');
    return COMPACT_FILE_RE.test(cmd) && /(>|tee\s|sed\s+-i|cp\s|mv\s)/.test(cmd) && !COMPILE_RE.test(cmd);
  }
  return false;
}

function isCompile(t: { name: string; input: any }): boolean {
  return t.name === 'Bash' && COMPILE_RE.test(String(t.input.command ?? ''));
}

/** Did the agent run the compiler after its last edit to a .compact file (phase 1 only)? */
export function verifiedBeforeDone(events: Event[]): boolean {
  const tools = toolUses(events);
  let lastEdit = -1, lastCompile = -1;
  tools.forEach((t, i) => { if (isCompactEdit(t)) lastEdit = i; if (isCompile(t)) lastCompile = i; });
  return lastCompile >= 0 && lastCompile > lastEdit;
}

function results(events: Event[]): Event[] { return events.filter((e) => e.type === 'result'); }

/** Compiler runs and how many of them failed (phase 1: what the agent fixed on its own). */
export function compileStats(events: Event[]): { attempts: number; failures: number } {
  const resultsById = new Map<string, { isError: boolean; text: string }>();
  for (const e of events) {
    if (e.type !== 'user') continue;
    for (const b of e.message?.content ?? []) {
      if (b?.type !== 'tool_result') continue;
      const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '');
      resultsById.set(b.tool_use_id, { isError: !!b.is_error, text });
    }
  }
  let attempts = 0, failures = 0;
  for (const e of events) {
    if (e.type !== 'assistant') continue;
    for (const b of e.message?.content ?? []) {
      if (b.type !== 'tool_use' || b.name !== 'Bash') continue;
      const cmd = String(b.input?.command ?? '');
      if (!COMPILE_RE.test(cmd) || /--(version|language-version|runtime-version|ledger-version|help)\b/.test(cmd)) continue;
      attempts++;
      const r = resultsById.get(b.id);
      if (r && (r.isError || /Exception:|parse error|potential witness-value disclosure/.test(r.text))) failures++;
    }
  }
  return { attempts, failures };
}

/** Setups other than C must never touch Midnight Expert's files. */
function checkContamination(setup: string, file: string): string[] {
  if (setup === 'C' || setup === 'P') return [];
  const hits = toolUses(readEvents(file)).filter((t) => /_tooling|midnight-expert/.test(JSON.stringify(t.input)));
  return hits.length ? [`setup ${setup} touched Midnight Expert files in ${hits.length} tool call(s)`] : [];
}

function checkInit(setup: string, file: string): string[] {
  const init = readEvents(file).find((e) => e.type === 'system' && e.subtype === 'init');
  if (!init) return ['no init event'];
  const problems: string[] = [];
  const model = process.env.EVAL_MODEL ?? 'claude-sonnet-5-5';
  if (init.model !== model) problems.push(`model ${init.model} != ${model}`);
  if (init.apiKeySource && init.apiKeySource !== 'none') problems.push(`apiKeySource=${init.apiKeySource} (expected subscription login)`);
  const servers: { name: string; status: string }[] = init.mcp_servers ?? [];
  // Plugins built into Claude Code (source "<name>@builtin") load in every setup once logged in; they're baseline.
  const plugins: { name: string; source?: string; path?: string }[] = (init.plugins ?? []).filter(
    (p: any) => p.path !== 'builtin' && !String(p.source ?? '').endsWith('@builtin'),
  );
  const mcpTools = (init.tools ?? []).filter((t: string) => t.startsWith('mcp__'));
  if (setup === 'A') {
    if (servers.length) problems.push(`A must load no MCP servers, got ${servers.map((s) => s.name)}`);
    if (mcpTools.length) problems.push(`A must have no MCP tools, got ${mcpTools.length}`);
  } else {
    const names = servers.map((s) => s.name).sort().join(',');
    if (names !== 'midnight') problems.push(`expected only the Kapa server "midnight", got [${names}]`);
    const kapa = servers.find((s) => s.name === 'midnight');
    if (kapa && kapa.status !== 'connected') problems.push(`Kapa server status=${kapa.status} (sign in under the eval config)`);
    if (mcpTools.some((t: string) => !t.startsWith('mcp__midnight__'))) problems.push('unexpected non-Kapa MCP tools');
  }
  if (setup === 'C' || setup === 'P') {
    if (plugins.length !== EXPECTED_PLUGINS) problems.push(`C expects ${EXPECTED_PLUGINS} plugins, got ${plugins.length}`);
  } else if (plugins.length) {
    problems.push(`${setup} must load no plugins, got ${plugins.map((p) => p.name)}`);
  }
  return problems;
}

function lastResult(file: string) {
  const r = results(readEvents(file)).at(-1);
  const text = String(r?.result ?? '').trim();
  return { session_id: r?.session_id ?? '', asks_question: /\?\s*$/.test(text.slice(-300)), is_error: !!r?.is_error };
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(dir: string): string {
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const files = readdirSync(dir).filter((f) => /^phase.*\.jsonl$/.test(f)).sort();
  const all = files.flatMap((f) => readEvents(join(dir, f)));
  const phase1 = files.filter((f) => f.startsWith('phase1')).flatMap((f) => readEvents(join(dir, f)));
  const tools = toolUses(all);
  const res = results(all);
  const first = JSON.parse(readFileSync(join(dir, 'score-first.json'), 'utf8'));
  const final = JSON.parse(readFileSync(join(dir, 'score-final.json'), 'utf8'));
  const notes: string[] = [...(meta.notes ?? [])];
  if (first.found === false) notes.push('contract not at expected path');
  if (first.interface_ok === false) notes.push(`interface missing: ${first.interface_missing.join(' ')}`);
  const values: Record<(typeof CSV_COLUMNS)[number], unknown> = {
    date: meta.date,
    setup: meta.setup,
    task: meta.task,
    run: meta.run,
    model: meta.model,
    compact_version: first.compiler_version,
    harness_commit: meta.harness_commit,
    compiled_first: first.compiled,
    compiled_final: final.compiled,
    tests_pass_first: first.tests_pass,
    tests_pass_final: final.tests_pass,
    verified_before_claiming_done: verifiedBeforeDone(phase1),
    interventions: meta.interventions,
    hallucinated_apis: '', // manual review
    privacy_errors: '', // manual review
    agent_turns: res.reduce((n, r) => n + (r.num_turns ?? 0), 0),
    minutes: meta.minutes,
    cost_usd: Math.round(res.reduce((n, r) => n + (r.total_cost_usd ?? 0), 0) * 100) / 100,
    web_lookups: tools.filter((t) => t.name === 'WebSearch' || t.name === 'WebFetch').length,
    mcp_calls: tools.filter((t) => t.name.startsWith('mcp__')).length,
    skill_calls: tools.filter((t) => t.name === 'Skill').length,
    // Plugin hooks (e.g. SessionStart) can inject guidance without any tool call; count the ones that returned output.
    hook_outputs: all.filter((e) => e.type === 'system' && e.subtype === 'hook_response' && String(e.output ?? '').trim()).length,
    compile_attempts: compileStats(phase1).attempts,
    compile_failures: compileStats(phase1).failures,
    failure_tags: '', // manual review
    notes: notes.join('; '),
  };
  return CSV_COLUMNS.map((c) => csvCell(values[c])).join(',');
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'check-init') {
  const problems = checkInit(a, b);
  if (problems.length) { console.log(`VOID: ${problems.join('; ')}`); process.exit(1); }
  console.log('init ok');
} else if (cmd === 'check-contamination') {
  const problems = checkContamination(a, b);
  if (problems.length) { console.log(`VOID: ${problems.join('; ')}`); process.exit(1); }
  console.log('no contamination');
} else if (cmd === 'last-result') {
  console.log(JSON.stringify(lastResult(a)));
} else if (cmd === 'row') {
  console.log(row(a));
} else if (cmd === 'header') {
  console.log(CSV_COLUMNS.join(','));
} else {
  console.error('usage: parse-run.ts check-init <setup> <file> | last-result <file> | row <run-dir> | header');
  process.exit(2);
}
