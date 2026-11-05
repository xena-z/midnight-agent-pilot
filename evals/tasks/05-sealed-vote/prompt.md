Create a Midnight smart contract written in Compact, saved at `contract/vote.compact`: a yes/no vote with a commit phase and a reveal phase.

Use exactly these names and types, and don't add any other witnesses:
- Witness `secretKey(): Bytes<32>` returns the caller's secret key.
- Witness `myVote(): Boolean` returns the caller's vote (`true` means yes). It returns the same value in both phases.
- Witness `voteSalt(): Bytes<32>` returns 32 random bytes chosen by the caller, the same in both phases.
- Exported pure circuit `publicKey(sk: Bytes<32>): Bytes<32>` returns a voter's public key.
- The account that deploys the contract is the admin. The contract starts in the commit phase.
- `commitVote(): []` works only during the commit phase. It records the caller's vote so that nobody can tell how they voted. One commit per voter.
- `closeCommits(): []` ends the commit phase and starts the reveal phase. Only the admin can call it.
- `revealVote(): []` works only during the reveal phase. It reveals the caller's committed vote and adds it to the public counters `yes` and `no`. It must fail if the vote doesn't match what the caller committed. One reveal per voter.

Let me know when it's done.
