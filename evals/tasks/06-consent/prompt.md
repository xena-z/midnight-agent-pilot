Create a Midnight smart contract written in Compact, saved at `contract/consent.compact`: a privacy-preserving consent registry (a demo, no real data).

A participant registers consent for a study. Later, they prove to a clinic that they have active consent for that study, without revealing which registration is theirs. They can revoke their consent, and a revoked consent can't be proven.

Use exactly these names and types, and don't add any other witnesses:
- Witness `consentSecret(): Bytes<32>` returns the participant's long-term secret.
- Witness `consentRandomness(): Bytes<32>` returns 32 random bytes the participant keeps, used to hide their registration.
- Witness `consentPath(commitment: Bytes<32>): MerkleTreePath<10, Bytes<32>>` returns the Merkle path in `consents` for the given leaf.
- Public ledger fields: `consents: HistoricMerkleTree<10, Bytes<32>>`, `revoked: Set<Bytes<32>>`, `answered: Map<Bytes<32>, Bytes<32>>`, `registrations: Counter`.
- `register(studyId: Bytes<32>): []` adds the caller's consent for `studyId` and increments `registrations`. The study ID must not become public at registration.
- `prove(studyId: Bytes<32>, challenge: Bytes<32>): []` proves the caller has active consent (registered and not revoked) for `studyId`. The clinic gives the participant a one-time `challenge`; on success, record `answered[challenge] = studyId`. Each challenge can be answered only once.
- `revoke(studyId: Bytes<32>): []` revokes the caller's consent for `studyId`. Only the participant who registered it can revoke it.

Privacy requirements: the public ledger must never contain a participant's secret or randomness, and a proof must not reveal which registration it comes from.

Let me know when it's done.
