import { describe, it, expect, beforeEach } from 'vitest';
import { loadCompiledContract, Sim, type CompiledModule } from '../../../harness/lib/sim.js';

let mod: CompiledModule;
let sim: Sim;

describe('01-counter', () => {
  beforeEach(async () => {
    mod ??= await loadCompiledContract();
    sim = await Sim.deploy(mod);
  });

  it('exposes a public ledger field named round, starting at 0', () => {
    expect(sim.ledger().round).toBe(0n);
  });

  it('increment() adds exactly 1 to round', async () => {
    await sim.call('increment');
    expect(sim.ledger().round).toBe(1n);
  });

  it('increment() accumulates across calls', async () => {
    await sim.call('increment');
    await sim.call('increment');
    await sim.call('increment');
    expect(sim.ledger().round).toBe(3n);
  });

  it('current() returns the value of round', async () => {
    await sim.call('increment');
    await sim.call('increment');
    expect(await sim.call<bigint>('current')).toBe(2n);
  });
});
