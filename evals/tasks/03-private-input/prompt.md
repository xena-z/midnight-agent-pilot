Create a Midnight smart contract written in Compact, saved at `contract/commitment.compact`.

A user has a private number (for example, a sealed price) that must never appear on the public ledger. The contract stores only a commitment to it, which the user can open later.

Use exactly these names and types, and don't add any other witnesses:
- Witness `secretValue(): Uint<64>` returns the private number.
- Witness `secretSalt(): Bytes<32>` returns 32 random bytes chosen by the user.
- `commit(): []` stores the commitment in the public ledger field `commitment` (a `Bytes<32>`).
- `matches(value: Uint<64>, salt: Bytes<32>): Boolean` returns whether `value` and `salt` open the stored commitment.

Let me know when it's done.
