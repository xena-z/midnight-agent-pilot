Create a Midnight smart contract written in Compact, saved at `contract/token.compact`: a simple fungible token whose balances are kept on the public ledger.

Use exactly these names and types, and don't add any other witnesses:
- Witness `secretKey(): Bytes<32>` returns the caller's secret key. A user's account address is derived from it.
- Exported pure circuit `publicKey(sk: Bytes<32>): Bytes<32>` returns the account address for a secret key.
- The account that deploys the contract is the admin.
- `mint(to: Bytes<32>, amount: Uint<64>): []` adds `amount` to account `to`. Only the admin can mint.
- `transfer(to: Bytes<32>, amount: Uint<64>): []` moves `amount` from the caller's account to `to`. It fails if the caller's balance is too low.
- `burn(amount: Uint<64>): []` destroys `amount` from the caller's account. It fails if the caller's balance is too low.
- `balanceOf(account: Bytes<32>): Uint<64>` returns an account's balance (0 if it has none).
- Public ledger field `totalSupply` (a `Uint<64>`) always equals the sum of all balances.

Let me know when it's done, and explain what the public ledger shows after a mint, a transfer and a burn.
