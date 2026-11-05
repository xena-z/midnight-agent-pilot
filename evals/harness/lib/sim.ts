// Minimal local simulator for compiled Compact contracts, written against
// @midnight-ntwrk/compact-runtime 0.21.0 (the runtime compiler 0.36.0 targets).
//
// Why not @openzeppelin/compact-simulator? Its latest release (0.4.1) pins
// compact-runtime 0.19.0, and code from compiler 0.36.0 calls
// checkRuntimeVersion('0.21.0'). A small helper we control avoids that mismatch.
//
// Note: with compiler 0.36.0 / runtime 0.21.0, impure circuits are async (they return Promises);
// pure circuits are synchronous functions on `pureCircuits`.

import { createHash } from 'node:crypto';
import * as rt from '@midnight-ntwrk/compact-runtime';

export type CompiledModule = {
  Contract: new (witnesses: any) => any;
  ledger: (state: any) => any;
  pureCircuits?: Record<string, (...args: any[]) => any>;
};

/** A witness implementation: (context) => [privateState, value]. */
export type WitnessFn = (context: any) => [any, any];
export type Witnesses = Record<string, WitnessFn>;

/** Witnesses that return fixed values and leave private state untouched. */
export function fixedWitnesses(values: Record<string, unknown>): Witnesses {
  const w: Witnesses = {};
  for (const [name, value] of Object.entries(values)) w[name] = ({ privateState }) => [privateState, value];
  return w;
}

/** Deterministic 32 bytes for a label, e.g. bytes32('alice-secret'). */
export function bytes32(label: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(label).digest());
}

export const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

/** Load the compiled contract that score.ts points CONTRACT_MODULE at. */
export async function loadCompiledContract(): Promise<CompiledModule> {
  const path = process.env.CONTRACT_MODULE;
  if (!path) throw new Error('CONTRACT_MODULE is not set; run hidden tests through score.sh');
  return (await import(path)) as CompiledModule;
}

export type DeployOptions = {
  witnesses?: Witnesses;
  privateState?: unknown;
  constructorArgs?: unknown[];
  coinPublicKey?: string; // 64 hex chars
};

export class Sim {
  private constructor(
    private readonly mod: CompiledModule,
    private witnesses: Witnesses,
    private readonly address: string,
    private contractState: any,
    public privateState: any,
    private zswap: any,
  ) {}

  static async deploy(mod: CompiledModule, opts: DeployOptions = {}): Promise<Sim> {
    const coinPK = opts.coinPublicKey ?? '0'.repeat(64);
    const witnesses = opts.witnesses ?? {};
    const contract = new mod.Contract(witnesses);
    const init = await contract.initialState(
      rt.createConstructorContext(opts.privateState ?? {}, coinPK),
      ...(opts.constructorArgs ?? []),
    );
    return new Sim(mod, witnesses, rt.dummyContractAddress(), init.currentContractState, init.currentPrivateState, init.currentZswapLocalState);
  }

  /** Call an exported circuit as the default caller (the deploy-time witnesses). */
  call<R = unknown>(circuit: string, ...args: unknown[]): Promise<R> {
    return this.callWith(this.witnesses, circuit, ...args);
  }

  /** Call an exported circuit with different witnesses, e.g. as another user. State is shared. */
  as(witnesses: Witnesses) {
    return { call: <R = unknown>(circuit: string, ...args: unknown[]) => this.callWith<R>(witnesses, circuit, ...args) };
  }

  /** Call a pure circuit (no state, no witnesses). */
  pure<R = unknown>(circuit: string, ...args: unknown[]): R {
    const fn = this.mod.pureCircuits?.[circuit];
    if (typeof fn !== 'function') throw new Error(`pure circuit not exported: ${circuit}`);
    return fn(...args) as R;
  }

  private async callWith<R>(witnesses: Witnesses, circuit: string, ...args: unknown[]): Promise<R> {
    const contract = new this.mod.Contract(witnesses);
    const fn = contract.impureCircuits?.[circuit] ?? contract.circuits?.[circuit];
    if (typeof fn !== 'function') throw new Error(`circuit not exported: ${circuit}`);
    const ctx = rt.createCircuitContext({
      circuitId: circuit,
      contractAddress: this.address,
      coinPublicKeyOrZswapState: this.zswap,
      contractState: this.contractState,
      privateState: this.privateState,
    });
    const res = await fn(ctx, ...args);
    const cc = res.context.callContext;
    this.contractState = cc.currentQueryContext.state;
    if (cc.currentPrivateState !== undefined) this.privateState = cc.currentPrivateState;
    if (cc.currentZswapLocalState !== undefined) this.zswap = cc.currentZswapLocalState;
    return res.result as R;
  }

  /** Decoded public ledger, via the contract's generated ledger() function. */
  ledger(): any {
    const s = this.contractState;
    return this.mod.ledger(s?.data ?? s);
  }

  /** The raw public state, fully encoded (cells included). */
  private encoded(): any {
    const s = this.contractState;
    const charged = s?.data ?? s;
    return (charged?.state ?? charged).encode();
  }

  /** Every byte string stored anywhere in the public contract state, as hex. */
  publicBytes(): string[] {
    const out: string[] = [];
    const walk = (v: any, depth: number): void => {
      if (depth > 64 || v == null) return;
      if (v instanceof Uint8Array) { out.push(hex(v)); return; }
      if (v instanceof Map) { for (const [k, x] of v) { walk(k, depth + 1); walk(x, depth + 1); } return; }
      if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
      if (typeof v === 'object') for (const x of Object.values(v)) walk(x, depth + 1);
    };
    walk(this.encoded(), 0);
    return out;
  }

  /** Canonical text of the whole public state. Equal fingerprints mean identical public state. */
  fingerprint(): string {
    const canon = (v: any): any => {
      if (v instanceof Uint8Array) return `0x${hex(v)}`;
      if (typeof v === 'bigint') return `${v}n`;
      if (v instanceof Map) return [...v].map(([k, x]) => [canon(k), canon(x)]).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
      if (Array.isArray(v)) return v.map(canon);
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, canon(x)]));
      return v;
    };
    return JSON.stringify(canon(this.encoded()));
  }

  /** True if these bytes appear anywhere in the public contract state. */
  publicStateContains(bytes: Uint8Array): boolean {
    const needle = hex(bytes);
    return this.publicBytes().some((b) => b.includes(needle));
  }

  /** True if this unsigned integer appears in the public state (cells store little-endian, trailing zeros trimmed). */
  publicStateContainsNumber(n: bigint): boolean {
    let le = '';
    for (let x = n; x > 0n; x >>= 8n) le += (Number(x & 0xffn)).toString(16).padStart(2, '0');
    return this.publicBytes().some((b) => b.includes(le));
  }
}
