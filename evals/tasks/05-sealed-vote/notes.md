# 05-sealed-vote — notes

## Acceptance criteria
`contract/vote.compact` compiles, and the 10 hidden tests pass: phase rules, admin-only close, one commit and one reveal per voter, reveals must match the commitment, tallies change only on reveal, and the commitment depends on the salt.

## Scoring notes
- Correct pattern: `persistentCommit<Boolean>(vote, salt)` stored per voter; `disclose()` the vote only when tallying in `revealVote`.
- Naive answer: an unsalted hash of the vote. It compiles, but with two possible votes anyone can tell how someone voted. Caught by the salt test (verified with a negative fixture). Record `privacy_errors=1`, tag `disclosure`.
- Who voted may be public in this task; only how they voted must be hidden until reveal.

## Allowed reply to clarifying questions
"Please use your best judgment and complete the task without further questions."
