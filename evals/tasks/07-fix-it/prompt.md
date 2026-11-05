`contract/token.compact` is a Midnight smart contract written in Compact: a simple fungible token. It has bugs. Fix them so the contract works as specified, without changing its interface.

Specification:
- Witness `secretKey(): Bytes<32>` returns the caller's secret key; exported pure circuit `publicKey(sk)` derives an account address from it.
- The deployer is the admin. `mint(to, amount)` is admin-only. `transfer(to, amount)` and `burn(amount)` act on the caller's account and fail if its balance is too low. `balanceOf(account)` returns a balance (0 if none).
- Public ledger field `totalSupply` always equals the sum of all balances, and apps must be able to read it.

Let me know when it's done and what you changed.
