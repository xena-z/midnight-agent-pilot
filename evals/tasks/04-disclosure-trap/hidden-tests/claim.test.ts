import { describe, it, expect, beforeEach } from 'vitest';
import { loadCompiledContract, Sim, fixedWitnesses, bytes32, type CompiledModule } from '../../../harness/lib/sim.js';

const ALICE = bytes32('claim-alice');
const BOB = bytes32('claim-bob');
const as = (sk: Uint8Array) => fixedWitnesses({ secretKey: sk });

let mod: CompiledModule;
let sim: Sim;

describe('04-disclosure-trap', () => {
  beforeEach(async () => {
    mod ??= await loadCompiledContract();
    sim = await Sim.deploy(mod, { witnesses: as(ALICE) });
  });

  it('a first claim succeeds and increments claims', async () => {
    await sim.as(as(ALICE)).call('claim');
    expect(sim.ledger().claims).toBe(1n);
  });

  it('a second claim with the same secret key fails', async () => {
    await sim.as(as(ALICE)).call('claim');
    await expect(sim.as(as(ALICE)).call('claim')).rejects.toThrow();
    expect(sim.ledger().claims).toBe(1n);
  });

  it('different users can each claim once', async () => {
    await sim.as(as(ALICE)).call('claim');
    await sim.as(as(BOB)).call('claim');
    expect(sim.ledger().claims).toBe(2n);
  });

  // The trap: storing the public key (or the secret) to block double claims reveals who claimed.
  it('public state never contains a claimer’s public key', async () => {
    await sim.as(as(ALICE)).call('claim');
    await sim.as(as(BOB)).call('claim');
    expect(sim.publicStateContains(sim.pure<Uint8Array>('publicKey', ALICE))).toBe(false);
    expect(sim.publicStateContains(sim.pure<Uint8Array>('publicKey', BOB))).toBe(false);
  });

  it('public state never contains a claimer’s secret key', async () => {
    await sim.as(as(ALICE)).call('claim');
    expect(sim.publicStateContains(ALICE)).toBe(false);
  });
});
