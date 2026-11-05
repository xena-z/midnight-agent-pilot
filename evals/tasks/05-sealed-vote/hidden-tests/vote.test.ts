import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { loadCompiledContract, Sim, fixedWitnesses, bytes32, type CompiledModule } from '../../../harness/lib/sim.js';

const ADMIN = bytes32('vote-admin');
const ALICE = bytes32('vote-alice');
const BOB = bytes32('vote-bob');
const CAROL = bytes32('vote-carol');
const voter = (sk: Uint8Array, vote: boolean, salt = bytes32(`salt-${Buffer.from(sk).toString('hex')}`)) =>
  fixedWitnesses({ secretKey: sk, myVote: vote, voteSalt: salt });

let mod: CompiledModule;
let sim: Sim;
const tally = () => [sim.ledger().yes, sim.ledger().no];

describe('05-sealed-vote', () => {
  beforeAll(async () => {
    mod = await loadCompiledContract();
  });
  beforeEach(async () => {
    sim = await Sim.deploy(mod, { witnesses: voter(ADMIN, false) });
  });

  it('commits do not change the public tally', async () => {
    await sim.as(voter(ALICE, true)).call('commitVote');
    await sim.as(voter(BOB, false)).call('commitVote');
    expect(tally()).toEqual([0n, 0n]);
  });

  it('a commit depends on the salt (the vote is hidden, not stored in the clear)', async () => {
    const a = await Sim.deploy(mod, { witnesses: voter(ADMIN, false) });
    const b = await Sim.deploy(mod, { witnesses: voter(ADMIN, false) });
    await a.as(voter(ALICE, true, bytes32('salt-one'))).call('commitVote');
    await b.as(voter(ALICE, true, bytes32('salt-two'))).call('commitVote');
    expect(a.fingerprint()).not.toEqual(b.fingerprint());
  });

  it('a voter cannot commit twice', async () => {
    await sim.as(voter(ALICE, true)).call('commitVote');
    await expect(sim.as(voter(ALICE, true)).call('commitVote')).rejects.toThrow();
  });

  it('revealing during the commit phase fails', async () => {
    await sim.as(voter(ALICE, true)).call('commitVote');
    await expect(sim.as(voter(ALICE, true)).call('revealVote')).rejects.toThrow();
  });

  it('only the admin can close the commit phase', async () => {
    await expect(sim.as(voter(ALICE, true)).call('closeCommits')).rejects.toThrow();
    await sim.call('closeCommits');
  });

  it('reveals add committed votes to the tally', async () => {
    await sim.as(voter(ALICE, true)).call('commitVote');
    await sim.as(voter(BOB, false)).call('commitVote');
    await sim.call('closeCommits');
    await sim.as(voter(ALICE, true)).call('revealVote');
    await sim.as(voter(BOB, false)).call('revealVote');
    expect(tally()).toEqual([1n, 1n]);
  });

  it('a reveal that does not match the commitment fails', async () => {
    await sim.as(voter(ALICE, true)).call('commitVote');
    await sim.call('closeCommits');
    await expect(sim.as(voter(ALICE, false)).call('revealVote')).rejects.toThrow();
    expect(tally()).toEqual([0n, 0n]);
  });

  it('a voter cannot reveal twice', async () => {
    await sim.as(voter(ALICE, true)).call('commitVote');
    await sim.call('closeCommits');
    await sim.as(voter(ALICE, true)).call('revealVote');
    await expect(sim.as(voter(ALICE, true)).call('revealVote')).rejects.toThrow();
    expect(tally()).toEqual([1n, 0n]);
  });

  it('revealing without a commitment fails', async () => {
    await sim.call('closeCommits');
    await expect(sim.as(voter(CAROL, true)).call('revealVote')).rejects.toThrow();
  });

  it('committing after the commit phase fails', async () => {
    await sim.call('closeCommits');
    await expect(sim.as(voter(ALICE, true)).call('commitVote')).rejects.toThrow();
  });
});
