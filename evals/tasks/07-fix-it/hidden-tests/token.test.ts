import { describe, it, expect, beforeEach } from 'vitest';
import { loadCompiledContract, Sim, fixedWitnesses, bytes32, type CompiledModule } from '../../../harness/lib/sim.js';

const ADMIN = bytes32('token-admin');
const ALICE = bytes32('token-alice');
const BOB = bytes32('token-bob');
const as = (sk: Uint8Array) => fixedWitnesses({ secretKey: sk });

let mod: CompiledModule;
let sim: Sim;
let pkAlice: Uint8Array;
let pkBob: Uint8Array;
const balance = (pk: Uint8Array) => sim.call<bigint>('balanceOf', pk);

describe('07-fix-it', () => {
  beforeEach(async () => {
    mod ??= await loadCompiledContract();
    sim = await Sim.deploy(mod, { witnesses: as(ADMIN) });
    pkAlice = sim.pure<Uint8Array>('publicKey', ALICE);
    pkBob = sim.pure<Uint8Array>('publicKey', BOB);
  });

  it('publicKey is deterministic and differs per secret key', () => {
    expect(sim.pure<Uint8Array>('publicKey', ALICE)).toEqual(pkAlice);
    expect(pkAlice).not.toEqual(pkBob);
  });

  it('starts with zero supply and zero balances', async () => {
    expect(sim.ledger().totalSupply).toBe(0n);
    expect(await balance(pkAlice)).toBe(0n);
  });

  it('the admin can mint', async () => {
    await sim.call('mint', pkAlice, 100n);
    expect(await balance(pkAlice)).toBe(100n);
    expect(sim.ledger().totalSupply).toBe(100n);
  });

  it('a non-admin cannot mint', async () => {
    await expect(sim.as(as(ALICE)).call('mint', pkAlice, 1n)).rejects.toThrow();
    expect(sim.ledger().totalSupply).toBe(0n);
  });

  it('transfer moves tokens from the caller and keeps the supply', async () => {
    await sim.call('mint', pkAlice, 100n);
    await sim.as(as(ALICE)).call('transfer', pkBob, 30n);
    expect(await balance(pkAlice)).toBe(70n);
    expect(await balance(pkBob)).toBe(30n);
    expect(sim.ledger().totalSupply).toBe(100n);
  });

  it('transfer fails when the balance is too low', async () => {
    await sim.call('mint', pkAlice, 10n);
    await expect(sim.as(as(ALICE)).call('transfer', pkBob, 11n)).rejects.toThrow();
    expect(await balance(pkAlice)).toBe(10n);
    expect(await balance(pkBob)).toBe(0n);
  });

  it('a user cannot spend from someone else’s account', async () => {
    await sim.call('mint', pkAlice, 10n);
    await expect(sim.as(as(BOB)).call('transfer', pkBob, 5n)).rejects.toThrow();
    expect(await balance(pkAlice)).toBe(10n);
  });

  it('burn reduces the caller’s balance and the supply', async () => {
    await sim.call('mint', pkBob, 50n);
    await sim.as(as(BOB)).call('burn', 20n);
    expect(await balance(pkBob)).toBe(30n);
    expect(sim.ledger().totalSupply).toBe(30n);
  });

  it('burn fails when the balance is too low', async () => {
    await sim.call('mint', pkBob, 5n);
    await expect(sim.as(as(BOB)).call('burn', 6n)).rejects.toThrow();
    expect(sim.ledger().totalSupply).toBe(5n);
  });

  it('secret keys never appear in public state', async () => {
    await sim.call('mint', pkAlice, 100n);
    await sim.as(as(ALICE)).call('transfer', pkBob, 30n);
    await sim.as(as(BOB)).call('burn', 10n);
    for (const sk of [ADMIN, ALICE, BOB]) expect(sim.publicStateContains(sk)).toBe(false);
  });
});
