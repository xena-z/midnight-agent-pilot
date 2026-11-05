import { describe, it, expect, beforeAll } from 'vitest';
import { loadCompiledContract, Sim, fixedWitnesses, bytes32, type CompiledModule } from '../../../harness/lib/sim.js';

// A distinctive 64-bit value, so a leak can't be confused with random bytes.
const VALUE = 9876543210123456789n;
const SALT_1 = bytes32('commit-salt-1');
const SALT_2 = bytes32('commit-salt-2');

let mod: CompiledModule;
async function committed(value: bigint, salt: Uint8Array): Promise<Sim> {
  const sim = await Sim.deploy(mod, { witnesses: fixedWitnesses({ secretValue: value, secretSalt: salt }) });
  await sim.call('commit');
  return sim;
}

describe('03-private-input', () => {
  beforeAll(async () => {
    mod = await loadCompiledContract();
  });

  it('commit() stores a 32-byte commitment', async () => {
    const sim = await committed(VALUE, SALT_1);
    const c: Uint8Array = sim.ledger().commitment;
    expect(c).toBeInstanceOf(Uint8Array);
    expect(c.length).toBe(32);
    expect(c.some((b) => b !== 0)).toBe(true);
  });

  it('the private value never appears in public state', async () => {
    const sim = await committed(VALUE, SALT_1);
    expect(sim.publicStateContainsNumber(VALUE)).toBe(false);
  });

  it('the salt never appears in public state', async () => {
    const sim = await committed(VALUE, SALT_1);
    expect(sim.publicStateContains(SALT_1)).toBe(false);
  });

  it('matches() accepts the right value and salt', async () => {
    const sim = await committed(VALUE, SALT_1);
    expect(await sim.call<boolean>('matches', VALUE, SALT_1)).toBe(true);
  });

  it('matches() rejects a wrong value', async () => {
    const sim = await committed(VALUE, SALT_1);
    expect(await sim.call<boolean>('matches', VALUE + 1n, SALT_1)).toBe(false);
  });

  it('matches() rejects a wrong salt', async () => {
    const sim = await committed(VALUE, SALT_1);
    expect(await sim.call<boolean>('matches', VALUE, SALT_2)).toBe(false);
  });

  it('the commitment depends on the salt (so small values cannot be guessed)', async () => {
    const a = await committed(VALUE, SALT_1);
    const b = await committed(VALUE, SALT_2);
    expect(a.ledger().commitment).not.toEqual(b.ledger().commitment);
  });

  it('the commitment depends on the value', async () => {
    const a = await committed(VALUE, SALT_1);
    const b = await committed(VALUE + 1n, SALT_1);
    expect(a.ledger().commitment).not.toEqual(b.ledger().commitment);
  });
});
