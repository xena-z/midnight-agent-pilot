Create a Midnight smart contract written in Compact, saved at `contract/claim.compact`.

Every user has a secret key. The app shows each user's public key, derived from the secret key, in other places. Any user may claim a reward once.

Use exactly these names and types, and don't add any other witnesses:
- Witness `secretKey(): Bytes<32>` returns the caller's secret key.
- Exported pure circuit `publicKey(sk: Bytes<32>): Bytes<32>` returns a user's public key.
- `claim(): []` records a claim and increments the public counter `claims`. A second claim with the same secret key must fail.

Privacy requirement: from the public ledger, nobody must be able to tell whether a given public key has claimed.

Let me know when it's done.
