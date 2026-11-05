# 06-consent — notes

The Part 1 spec, with the interface fixed in `contract/DESIGN.md`. The reference solution is the pilot's own contract (`reference/contract/consent.compact` links to `/contract/consent.compact`).

## Acceptance criteria
Compiles with compiler 0.36.0, and the 10 hidden tests pass: the study ID stays hidden at registration; register → prove works and records the challenge; unregistered callers fail; a caller can't reuse someone else's Merkle path; consent doesn't carry across studies; each challenge is answered once; revoke → prove fails; only the holder can revoke; revoking one study leaves others active; no secret or randomness appears in public state.

## Scoring notes
- Soundness trap: verifying `checkRoot(merkleTreePathRoot(path))` without asserting `path.leaf == commitment` lets anyone use another participant's public path. Caught by a hidden test (verified with a negative fixture). Tag `docs-gap` if Midnight Expert was available and the agent missed it.
- Revocation needs a deterministic per-(secret, study) value; a hash that differs per proof can't be checked against `revoked`. Caught by the revoke tests (verified with a negative fixture).
- Review the commitment by hand: it must include the randomness (`persistentCommit` or a hash over `[.., randomness]`). If not, set `privacy_errors=1` and tag `disclosure`.

## Allowed reply to clarifying questions
"Please use your best judgment and complete the task without further questions."
