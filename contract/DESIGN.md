# Consent attestation — design

Demo only. A participant registers consent for a study, proves active consent to a clinic without revealing which registration is theirs, and can revoke it. Decisions made 2026-11-05.

Patterns come from Midnight Expert's verified examples (GitHub main @ `212d7c2c`): `compact-core/compact-privacy-disclosure/examples/NullifierDoubleSpend.compact` and `PrivateVoting.compact`.

## Decision 1 — Linkability: per-study pseudonym

To check that consent hasn't been revoked, `prove()` publishes a pseudonym derived from the participant's secret and the study ID, `hash("consent:pseudonym", secret, studyId)`, and checks it isn't in the `revoked` set. `revoke()` adds that pseudonym to the set.

- Proofs by the same person **for the same study** share a pseudonym, so the clinic can tell they come from the same consenter. It still can't tell who that is.
- Proofs for **different studies** can't be linked, because the study ID is part of the hash.
- Rejected: fully unlinkable proofs with revocation. That needs zero-knowledge non-membership proofs, which aren't in the standard library.

## Decision 2 — What the clinic sees: an answered one-time challenge

The clinic gives the participant a random one-time code off-chain. `prove(studyId, challenge)` records `challenge → studyId` in the `answered` map; the clinic then checks that its code appears there with the right study.

- Replay protection is built in: each code can be answered only once.
- Known limitation: a participant could pass the code to someone else who also consented to the same study. Preventing that requires tying the proof to a real-world identity, which this design avoids on purpose.

## Decision 3 — Ledger contents: study ID hidden at registration

The study ID goes inside the consent commitment, so registrations for all studies sit in one anonymity set. The compiler treats exported circuit arguments as private: writing `studyId` to the ledger without `disclose()` fails to compile (checked with compiler 0.36.0).

| Ledger field | Type | Public because |
|---|---|---|
| `consents` | `HistoricMerkleTree<10, Bytes<32>>` | Holds commitments; membership proofs don't reveal which leaf. "Historic" keeps old proofs valid after new registrations. |
| `revoked` | `Set<Bytes<32>>` | Revoked per-study pseudonyms; must be public so `prove()` can check them. |
| `answered` | `Map<Bytes<32>, Bytes<32>>` | Challenge → study ID; this is what the clinic reads. A study ID becomes public only when someone proves consent for it. |
| `registrations` | `Counter` | Total registrations only; no per-study counts. |

## Interface (task 6 reuses this exactly)

```compact
witness consentSecret(): Bytes<32>;       // participant's long-term secret, stored off-chain
witness consentRandomness(): Bytes<32>;   // blinding for the commitment, stored off-chain
witness consentPath(commitment: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

export circuit register(studyId: Bytes<32>): [];
export circuit prove(studyId: Bytes<32>, challenge: Bytes<32>): [];
export circuit revoke(studyId: Bytes<32>): [];
```

- `register`: commitment = `persistentCommit([domain, secret, studyId], randomness)`; insert into `consents`; increment `registrations`.
- `prove`: re-derive the commitment; check the Merkle path is for *this* commitment (`path.leaf == commitment`) and against a valid root; assert the pseudonym isn't revoked and the challenge is unused; record the challenge.
- `revoke`: same membership check, then add the pseudonym to `revoked`. Only someone holding the secret and randomness can produce both the proof and the pseudonym.

## Known limits (go in the README)

- **Anonymity set size**: with few registrations, any proof is easy to attribute. Timing (register, then prove soon after) also leaks.
- **Challenge forwarding**: see decision 2.
- **Transaction metadata**: whatever links a participant's transactions at the network or fee level is outside the contract. Open question to check in Midnight's docs.
- **Open registration** (from the compact-core review, High): anyone can register any study ID, so a proof shows "someone holds a registration for this study", not that they were enrolled. A real system would gate `register` on a study-authority credential checked in-circuit. Out of scope for this demo.
- **Tree capacity** (from the compact-core review, High): depth 10 holds 1,024 registrations, and unauthenticated registration can fill it. A real system needs a larger depth, epochs, or gated registration.
- **Low-entropy secrets** can be brute-forced; the witness must return 32 random bytes.
