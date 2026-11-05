// Tests for the consent attestation contract (Part 1). They also serve as the hidden tests for eval task 06.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadCompiledContract, Sim, bytes32, type CompiledModule, type Witnesses } from '../../../harness/lib/sim.js';

const STUDY_X = bytes32('study-x');
const STUDY_Y = bytes32('study-y');
const ALICE = { secret: bytes32('alice-secret'), randomness: bytes32('alice-randomness') };
const BOB = { secret: bytes32('bob-secret'), randomness: bytes32('bob-randomness') };

// Witnesses as a participant's device would supply them. `seen` records the commitments the
// contract asked paths for, so a test can later hand another participant's path to the contract.
function participant(p: { secret: Uint8Array; randomness: Uint8Array }, seen: Uint8Array[] = [], forcePathFor?: () => Uint8Array): Witnesses {
  return {
    consentSecret: ({ privateState }) => [privateState, p.secret],
    consentRandomness: ({ privateState }) => [privateState, p.randomness],
    consentPath: (({ privateState, ledger }: any, commitment: Uint8Array) => {
      seen.push(commitment);
      const target = forcePathFor ? forcePathFor() : commitment;
      // If there's no such leaf, return a well-formed path that the on-chain root check must reject.
      const path = ledger.consents.findPathForLeaf(target) ?? ledger.consents.pathForLeaf(0n, target);
      return [privateState, path];
    }) as any,
  };
}

let mod: CompiledModule;
let sim: Sim;
const challenge = (n: number) => bytes32(`clinic-challenge-${n}`);

describe('06-consent', () => {
  beforeAll(async () => {
    mod = await loadCompiledContract();
  });
  beforeEach(async () => {
    sim = await Sim.deploy(mod, { witnesses: participant(ALICE) });
  });

  it('register counts the registration without revealing the study', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    expect(sim.ledger().registrations).toBe(1n);
    expect(sim.publicStateContains(STUDY_X)).toBe(false);
  });

  it('register -> prove succeeds and records the challenge for that study', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await sim.as(participant(ALICE)).call('prove', STUDY_X, challenge(1));
    expect(sim.ledger().answered.member(challenge(1))).toBe(true);
    expect(sim.ledger().answered.lookup(challenge(1))).toEqual(STUDY_X);
  });

  it('an unregistered participant cannot prove', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await expect(sim.as(participant(BOB)).call('prove', STUDY_X, challenge(1))).rejects.toThrow();
    expect(sim.ledger().answered.member(challenge(1))).toBe(false);
  });

  it('a participant cannot pass someone else’s Merkle path as their own', async () => {
    const aliceCommitments: Uint8Array[] = [];
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await sim.as(participant(ALICE, aliceCommitments)).call('prove', STUDY_X, challenge(1));
    const bobUsingAlicesPath = participant(BOB, [], () => aliceCommitments[0]);
    await expect(sim.as(bobUsingAlicesPath).call('prove', STUDY_X, challenge(2))).rejects.toThrow();
  });

  it('consent for one study does not prove consent for another', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await expect(sim.as(participant(ALICE)).call('prove', STUDY_Y, challenge(1))).rejects.toThrow();
  });

  it('a challenge can be answered only once (replay protection)', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await sim.as(participant(BOB)).call('register', STUDY_X);
    await sim.as(participant(ALICE)).call('prove', STUDY_X, challenge(1));
    await expect(sim.as(participant(ALICE)).call('prove', STUDY_X, challenge(1))).rejects.toThrow();
    await expect(sim.as(participant(BOB)).call('prove', STUDY_X, challenge(1))).rejects.toThrow();
  });

  it('revoke -> prove fails', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await sim.as(participant(ALICE)).call('prove', STUDY_X, challenge(1));
    await sim.as(participant(ALICE)).call('revoke', STUDY_X);
    await expect(sim.as(participant(ALICE)).call('prove', STUDY_X, challenge(2))).rejects.toThrow();
  });

  it('a non-holder cannot revoke someone else’s consent', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await expect(sim.as(participant(BOB)).call('revoke', STUDY_X)).rejects.toThrow();
    await sim.as(participant(ALICE)).call('prove', STUDY_X, challenge(1));
    expect(sim.ledger().answered.member(challenge(1))).toBe(true);
  });

  it('revoking one study leaves the participant’s other studies active', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await sim.as(participant(ALICE)).call('register', STUDY_Y);
    await sim.as(participant(ALICE)).call('revoke', STUDY_X);
    await sim.as(participant(ALICE)).call('prove', STUDY_Y, challenge(1));
    await expect(sim.as(participant(ALICE)).call('prove', STUDY_X, challenge(2))).rejects.toThrow();
  });

  it('the public ledger never holds a secret or randomness', async () => {
    await sim.as(participant(ALICE)).call('register', STUDY_X);
    await sim.as(participant(BOB)).call('register', STUDY_X);
    await sim.as(participant(ALICE)).call('prove', STUDY_X, challenge(1));
    await sim.as(participant(BOB)).call('revoke', STUDY_X);
    for (const v of [ALICE.secret, ALICE.randomness, BOB.secret, BOB.randomness]) {
      expect(sim.publicStateContains(v)).toBe(false);
    }
  });
});
