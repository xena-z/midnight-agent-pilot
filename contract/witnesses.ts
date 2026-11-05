// Participant-side witnesses for consent.compact (runs on the participant's device, never on-chain).
// Compile first: compact compile contract/consent.compact contract/managed
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/contract/index.js';

/** Kept only on the participant's device. Both values must be 32 random bytes. */
export type ConsentPrivateState = {
  secret: Uint8Array;
  randomness: Uint8Array;
};

type Ctx = WitnessContext<Ledger, ConsentPrivateState>;

export const witnesses = {
  consentSecret: ({ privateState }: Ctx): [ConsentPrivateState, Uint8Array] => [privateState, privateState.secret],

  consentRandomness: ({ privateState }: Ctx): [ConsentPrivateState, Uint8Array] => [privateState, privateState.randomness],

  // Finds the Merkle path for this participant's own commitment in the public tree.
  consentPath: ({ privateState, ledger }: Ctx, commitment: Uint8Array) => {
    const path = ledger.consents.findPathForLeaf(commitment);
    if (!path) throw new Error('No registered consent for this study on this device');
    return [privateState, path] as const;
  },
};
