// Minimal local simulator for compiled Compact contracts, written against
// @midnight-ntwrk/compact-runtime 0.21.0 (the runtime compiler 0.36.0 targets).
//
// Why not @openzeppelin/compact-simulator? Its latest release (0.4.1) pins
// compact-runtime 0.19.0, and code from compiler 0.36.0 calls
// checkRuntimeVersion('0.21.0'). A small helper we control avoids that mismatch.
//
// Note: from compiler 0.36.0 / runtime 0.21.0, circuits are async (they return Promises).

import * as rt from '@midnight-ntwrk/compact-runtime';

export type CompiledModule = {
  Contract: new (witnesses: any) => any;
  ledger: (state: any) => any;
};

/** Load the compiled contract that score.ts points CONTRACT_MODULE at. */
export async function loadCompiledContract(): Promise<CompiledModule> {
  const path = process.env.CONTRACT_MODULE;
  if (!path) throw new Error('CONTRACT_MODULE is not set; run hidden tests through score.sh');
  return (await import(path)) as CompiledModule;
}

export type DeployOptions<PS> = {
  witnesses?: Record<string, unknown>;
  privateState?: PS;
  constructorArgs?: unknown[];
  coinPublicKey?: string; // 64 hex chars
};

export class Sim<PS = Record<string, never>> {
  private constructor(
    private readonly mod: CompiledModule,
    private readonly contract: any,
    private readonly address: string,
    private contractState: any,
    public privateState: PS,
    private zswap: any,
  ) {}

  static async deploy<PS>(mod: CompiledModule, opts: DeployOptions<PS> = {}): Promise<Sim<PS>> {
    const coinPK = opts.coinPublicKey ?? '0'.repeat(64);
    const contract = new mod.Contract(opts.witnesses ?? {});
    const init = await contract.initialState(
      rt.createConstructorContext(opts.privateState ?? ({} as PS), coinPK),
      ...(opts.constructorArgs ?? []),
    );
    return new Sim<PS>(
      mod,
      contract,
      rt.dummyContractAddress(),
      init.currentContractState,
      init.currentPrivateState,
      init.currentZswapLocalState,
    );
  }

  /** Call an exported circuit and keep the resulting ledger and private state. */
  async call<R = unknown>(circuit: string, ...args: unknown[]): Promise<R> {
    const fn = this.contract.impureCircuits?.[circuit] ?? this.contract.circuits?.[circuit];
    if (typeof fn !== 'function') throw new Error(`circuit not exported: ${circuit}`);
    const ctx = rt.createCircuitContext<PS>({
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
}
